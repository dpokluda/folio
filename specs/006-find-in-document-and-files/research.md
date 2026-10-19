# Research: Find in Document & Find in Files

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Phase 0 of `/speckit-plan`, reconstructed on 2026-10-18. The Technical Context had no unresolved
unknowns, because every value was read from the shipped code. The decisions below
come from the code comments and commit messages of `2a26dea`, `e126f54`, `4a9cc98` and `8062af5`.
"Alternatives considered" lists the options that those comments explicitly reject, or that the
shipped design visibly avoids.

### 1. Painting matches in the rendered view

**Decision**: Mark matches with the CSS Custom Highlight API. `findRangesIn()` collects `Range`
objects over the text nodes of `#write`. `runFind()` and `setCurrentMatch()` register them as two
named highlights: `folio-find` for every match, and `folio-find-current` for the current match, with
`priority = 1` so that it paints on top. Both are styled by `::highlight()` rules in
`src/renderer/app.css`. The code feature-detects the API with `HIGHLIGHT_SUPPORTED` and degrades to
"no matches" when it is missing.

**Rationale**: The `src/renderer/renderer.js` comment and the `2a26dea` message say that "nothing in
the DOM is mutated" and that highlights "never disturb layout", "survive theme swaps / re-renders"
and are "trivially cleared on re-render". Leaving `#write` untouched keeps the Typora DOM contract
(Principle I). The API ships in the Chromium 126 runtime of Electron 31.7.7, which the commit cites
as "Chromium 126", so no dependency was needed (Principle VI).

**Alternatives considered**:
- Wrapping matches in `<mark>` elements inside `#write`. This mutates theme-styled markup, can split
  text runs, and has to be undone on every keystroke and every re-render.
- Electron's `webContents.findInPage`. It needs a main-process round trip, searches the whole window
  (explorer, outline and status bar included) instead of only the page, and paints with Chromium's
  own find colours.

### 2. One shortcut, behaviour per mode

**Decision**: Keep the existing Edit ▸ Find… item (`CmdOrCtrl+F`, from `bd8f5ef`) and branch on the
mode in the renderer's `handleCommand()`. In the rendered view, `find` calls `openFindBar()`. In
source mode, it calls `openSearchPanel(editor)` on the next animation frame. The editor keeps its
`search({ top: true })` panel and `searchKeymap`.

**Rationale**: The `2a26dea` message: "Previously it forced a switch into the CodeMirror source
editor; now a small find bar opens over the preview … Source mode still uses CodeMirror's own search
panel." Readers stay in the view they chose. The editor panel already offers the editing-oriented
options (match case, regexp, by word, replace), and those belong in source mode, because the preview
is not an editing surface (Principle II).

**Alternatives considered**:
- The original behaviour: force source mode, then open the editor panel. It was dropped because it
  pulled readers out of the rendered page.
- One find bar for both modes. It would duplicate the editor panel and need its own highlighting in
  source mode.

### 3. Keeping find in step with re-renders and mode switches

**Decision**: `renderPreview()` ends with `if (state.find.open) runFind(state.find.query)`, and
`setSourceMode(true)` calls `closeFindBar()`. Each recompute makes the first match current again.

**Rationale**: The comment in `renderPreview()` reads: "Old match ranges point into the replaced DOM;
recompute if find is open." Every path that replaces `#write` goes through `renderPreview()`, so one
hook covers them all: loading a document, Reload, the path change after Save As, and the diagram
redraw on an appearance change that later features (010, 011) added. Over the hidden preview in
source mode the bar has no purpose.

**Alternatives considered**:
- Closing the bar on every re-render. A live reload would lose the user's term.
- Keeping the old ranges. They would reference detached nodes and paint nothing.

### 4. Matching semantics

**Decision**: Both surfaces use plain, case-insensitive substring matching (`toLowerCase()` with
`indexOf()` or `includes()`). Neither has regex, whole-word or case options. The find bar matches
inside individual non-blank text nodes of `#write`, without overlaps and in document order. Find in
Files matches inside each line of the raw Markdown source (`split(/\r?\n/)`).

**Rationale**: `2a26dea` says "Case-insensitive incremental search", and `e126f54` says
"(case-insensitive, markdown-only, capped results)". Matching per line gives the line numbers and
excerpts that the result list shows. Matching per text node maps straight onto `Range`s without a
flattened text index. Source mode's editor panel already provides the advanced options.

**Alternatives considered**:
- Regex and case toggles in the find bar: more UI for a viewer.
- Matching phrases across formatting boundaries: needs concatenated text plus a mapping of offsets
  back to ranges.
- Matching rendered text in Find in Files: every file would have to be rendered.

### 5. Where the folder search runs

**Decision**: `searchInFolder(dir, query)` in `src/folder.js` does not depend on Electron. It reuses
the explorer's `scanFolder()` through `collectMarkdownFiles(tree)` and runs in the main process
behind a single invoke channel, `search-files`. The page reaches it as `folioAPI.searchFiles(query)`.

**Rationale**: The renderer has no file-system access (`contextIsolation: true`,
`nodeIntegration: false`), and Principle III asks for a narrow channel with one purpose. The
`e126f54` code comment says: "Pure (fs only) so it can be unit tested without Electron" (Principle
VI). Reusing `scanFolder()` means the search covers exactly the files the explorer shows, with the
same skip list and depth cap.

**Alternatives considered**:
- A generic file-read bridge for the renderer. Principle III prohibits it.
- A separate directory walker for search. Its scope would drift from the explorer's.
- A worker thread or asynchronous I/O. Not adopted: the caps and caches in decisions 7 and 8 bound
  the synchronous search (see Retroactive findings).

### 6. Where the Find-in-Files UI lives and how it closes

**Decision**: The search box (`#folio-files-search`) and the results container
(`#folio-files-results`) sit inside the explorer pane and take turns with `#folio-files-tree`. Since
`4a9cc98`:

- The box starts `hidden`, and `openFileSearch()` reveals it together with the pane.
- Esc calls `hideFileSearch()`, which clears the box, hides it and shows the tree again.
- Clearing the text only calls `showFileTree()`.
- `setFolder()` resets everything.

**Rationale**: `e126f54`: "Results render in the file-explorer pane grouped by file with match
snippets … Clearing the search box restores the file tree." `4a9cc98`: "The search box is now hidden
until Ctrl/Cmd+Shift+F opens it, and Esc (or clearing it) dismisses it and restores the file tree."
When nobody is searching, the explorer stays uncluttered. The results appear where the user already
browses files.

**Alternatives considered**:
- A search box that is always visible. That was the `e126f54` design, and `4a9cc98` replaced it.
- A separate results panel or dialog. It would compete with the outline and the document area.

### 7. Bounding the result set

**Decision**: The limits are `SEARCH_MAX_MATCHES_PER_FILE = 50`, `SEARCH_MAX_TOTAL_MATCHES = 1000`
and `SEARCH_MAX_FILES = 500`. Excerpts are `trim().slice(0, 240)`. `truncated` is
`total >= SEARCH_MAX_TOTAL_MATCHES`, and when it is set the summary gets " (truncated)" appended. The
renderer waits 180 ms after the last keystroke before searching (`scheduleFileSearch()`); Enter
searches at once.

**Rationale**: Principle VI says that "potentially expensive work, such as folder scans and Find in
Files, MUST be bounded with depth caps, result caps and caching". The caps bound both the reply
payload and the number of rows added to the page. The 180 ms wait avoids a search on every
keystroke.

**Alternatives considered**:
- Unbounded results. A common word in a large notes folder could produce tens of thousands of rows.
- Paging or streaming results: more protocol and UI than a viewer needs.
- Searching only on Enter: harder to discover than searching as you type.

### 8. Caching between searches

**Decision** (`8062af5`): `src/folder.js` keeps two module-level caches:

- `markdownFilesFor()` keeps each folder's file list for `FILE_LIST_TTL_MS = 4000`.
- `linesFor()` keeps each file's split lines by path and checks them against
  `fs.statSync(file).mtimeMs` before reuse.

The content cache is cleared when the searched folder changes. `openFolder()` and `doCloseFolder()`
in `src/main.js` call `invalidateSearchCache()`.

**Rationale**: The comment in `src/folder.js`: "so a burst of keystrokes doesn't re-walk the tree
and re-read every file on each query … an edited file is re-read but unchanged ones are reused." The
short time-to-live picks up added files without a watcher, and the modification-time check keeps
results correct after edits.

**Alternatives considered**:
- No caching. That was the `e126f54` behaviour: every query re-walked the tree and re-read every
  file.
- File-system watchers over the whole folder. They cost resources continuously, and the cache only
  has to be fresh when the user searches.
- A cache that never expires. Results would go stale.

### 9. Opening a document from a result

**Decision**: `openSearchResult(path, query)` stores the term in `state.pendingFindQuery` and calls
`navigateTo({ path })`, which goes through the existing, guarded `navigate` channel (005).
`loadDocument()` consumes the pending term as its very last step and calls `openFindBar(q)` unless
the window is in source mode. File headings and match rows behave the same way; the line number of
the clicked row is not used.

**Rationale**: `e126f54`: "clicking a match opens that document and seeds the in-preview find bar so
the term is highlighted". Going through `navigate` brings the unsaved-changes guard and history
recording (Principle IV) without a new channel, and the find bar is reused instead of adding a
second highlighter. Because the term is consumed after the scroll reset in `loadDocument()`, the
first match stays in view.

**Alternatives considered**:
- Scrolling to the clicked line. The rendered page has no source-line markers to map a line number
  onto.
- A result highlight separate from the find bar. That would duplicate UI and state.

### 10. Per-window scoping and IPC hardening

**Decision** (`8062af5`): The `search-files` handler finds the calling window with
`sessionFor(event.sender)` and searches `session.currentFolder`. Without a session or folder, or if
anything throws, it returns an empty result. `actions.findInFiles` checks `focusedSession()` and
parents its dialog to that window.

**Rationale**: `8062af5` moved all per-document state onto per-window Sessions (007). Principle III
says that handlers "MUST resolve the calling window's session from the event sender and MUST NOT
rely on state supplied by the renderer". The page supplies only the query string, so a hostile
document cannot point the search at another directory.

**Alternatives considered**:
- One process-wide current folder. That was the `e126f54` design, and it breaks as soon as windows
  can hold different folders.
- Letting the renderer pass the folder root. Page content could then decide what gets read.

## Retroactive findings

**README ↔ code drift**

- README says that clicking a Find-in-Files match "opens that document with the term highlighted".
  In source mode the document opens in the editor without highlighting, because `loadDocument()`
  calls `openFindBar()` only when `!state.sourceMode`, and the pending term is dropped.
- README says "Press `Esc` (or clear the box) to dismiss the search and return to the file tree."
  Clearing the box does bring the file tree back, but the empty search box stays visible
  (`showFileTree()`). Only Esc hides it (`hideFileSearch()`).
- README omits several things:
  - the find bar's match counter and its Enter, Shift+Enter and Esc keys
  - that both searches ignore case
  - that Find in Files matches the Markdown source, not the rendered text
  - the 50/1,000/500 caps and the "(truncated)" marker
  - the "Find in Files searches an open folder" message

  Find and Find in Files are also missing from README's **Features** list; README describes them
  only under the usage instructions.

**Undocumented behaviour**

- Find in Files sees Markdown files added after the folder was opened, because the file list is
  rebuilt once it is 4 s old. The explorer tree is scanned only when a folder is opened, either
  through File ▸ Open Folder (`openFolder()`) or as a launch target (the `get-init` handler). Search
  can therefore list files that the tree only shows after the folder is reopened.
- Find in Files reads saved files, so it does not see unsaved edits in the open document.
- Opening a result for the document that is already open re-reads it from disk
  (`navigate` → `loadFile()`), after the unsaved-changes guard if the document has unsaved edits.

**Known limitations**

- Clicking a match row opens the document at the first occurrence, not at the clicked line.
- The "(truncated)" marker reflects only the 1,000-match cap, and it also appears when the total is
  exactly 1,000. The 50-per-file and 500-file caps apply without any indicator.
- `state.pendingFindQuery` is not cleared when the unsaved-changes prompt is cancelled or the file
  cannot be read. The next document that loads in that window then opens the find bar with the old
  term.
- Late `searchFiles()` replies are not discarded. A reply that arrives after Esc dismissed the box
  still hides the tree and shows results, with the box hidden. The window for this is narrow,
  because the main process answers synchronously and often from cache.
- The active-file marker in the result list is set when the results render. It is not refreshed
  when a result is opened.
- The find bar walks every non-blank text node under `#write`. Text that is in the page but not
  visible can therefore count as a match, such as the stylesheet embedded in a drawn Mermaid diagram
  (010) or the hidden MathML copy that typeset math keeps for accessibility (009).
- Diagrams are drawn asynchronously after `renderPreview()` has re-run find, so diagram labels count
  only after the term is edited again. The code-fence copy button (010) deliberately has no text
  node, so that it cannot produce false matches.
- The find bar does not match a phrase across text nodes, that is, across formatting boundaries.
  Find in Files does not match across lines.
- The search runs synchronously in the main process. The caps bound the size of its result, not its
  reading:
  - A rare term still reads every Markdown file in the folder once. Only `scanFolder()`'s skip list
    and its 16-level depth cap limit the number of files.
  - The content cache keeps the lines of every file it has read in memory until the folder changes.
- The search caches are shared by the whole process and remember only one folder:
  - Searches that alternate between windows with different folders rescan the folder and drop each
    other's cached text.
  - Opening or closing a folder in any window clears the caches.

  Results stay correct; only the reuse is lost.

**Incidental changes in this feature's commits**

- `2a26dea` also changed the window-title separator from an em dash to a plain hyphen
  (`name - Folio`) in `updateTitle()` in `src/main.js`, and updated the Outline status-button tooltip
  to `Ctrl/Cmd+Shift+K`; that shortcut was remapped later and the tooltip now reads
  `Ctrl/Cmd+Alt+O`. Both belong to 001's title and status-bar presentation.
