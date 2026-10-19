# Research: Folder Mode, Link Navigation & Back/Forward History

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-14 (reconstructed 2026-10-18)

Phase 0 of the retroactive plan. Every decision below is mined from the code comments and commit messages of `e2e2877`, `356cf20`, `4a9cc98`, `8062af5`, `f8f17fa` and `4ebcdb2`. The Technical Context of [plan.md](./plan.md) had no open unknowns; these entries record why the shipped design looks the way it does.

### 1. Where folder logic and link resolution live

- **Decision**: Put tree scanning, entry and index-document selection and link resolution in a new module, `src/folder.js`, that depends only on `fs`, `path` and `url`. The main process calls it; the renderer never touches the file system and asks main to navigate through a single invoke channel, `navigate`.
- **Rationale**: The module header says it is "Pure (fs + path + url) so it can be unit tested without booting Electron", and the `e2e2877` message calls it a "pure module (tree scan, entry-doc + nav-target resolution) shared by main and reused for testing". This matches constitution VI (Electron-free logic) and III (no file-system access in the privileged renderer). Requiring `src/folder.js` from plain Node works, which keeps a future test runner cheap.
- **Alternatives considered**: Inline helpers in `src/main.js` (harder to test in isolation). Resolving links in the renderer with `new URL(href, baseUrl)` and letting the window follow `file://` URLs: before `e2e2877`, `wireLinks()` only intercepted `http(s)` links, so other links navigated the window itself; the renderer also cannot classify a target (Markdown, folder, other file, missing) without file-system access.

### 2. What the explorer lists

- **Decision**: List only files with one of seven Markdown extensions (`MD_EXTS`); skip names starting with `.` and the `SKIP_DIRS` set (`node_modules`, `.git`, `.obsidian`, `.vscode`, `.idea`); include a folder only if it transitively contains Markdown; sort folders before files, each with `localeCompare(…, { numeric: true, sensitivity: 'base' })`; stop descending at `MAX_TREE_DEPTH = 16`. The renderer starts with every folder collapsed except the ancestors of the displayed document (`356cf20`).
- **Rationale**: The `scanFolder()` comment: "Folders are included only if they (transitively) contain markdown, so the explorer stays focused on navigable content. Hidden entries and heavy/asset dirs are skipped; a depth cap guards against pathological trees / symlink loops." Constitution VI requires bounded scans. `356cf20`: "The file explorer now starts with all folders collapsed, expanding only the path down to the active document so it stays visible."
- **Alternatives considered**: Listing every file (noise, and clicks on non-Markdown files would route to the external-open prompt). Pre-expanding all top-level folders, which `e2e2877` did and `356cf20` replaced. Lazy per-folder scanning on expand (more round trips; the single synchronous scan runs only on Open Folder). An entry-count cap (not implemented; depth is the only bound).

### 3. Which document represents a folder

- **Decision**: One ordered, case-insensitive list, `INDEX_DOC_NAMES = ['_index.md', 'readme.md', 'index.md']`, drives both the Open Folder entry document (`entryDocFor()`, top level of the tree, falling back to the first Markdown file depth-first, files of a level before its subfolders) and folder-link targets (`folderIndexDoc()`, an on-disk lookup with no fallback; none found → `folder-empty`).
- **Rationale**: `e2e2877` describes a folder link opening "that folder's _index.md (falling back to README.md)"; `index.md` was in both lists from the start. `8062af5` unified the two lists ("Canonical set of 'folder entry document' filenames … Both entryDocFor (explorer tree) and folderIndexDoc (on-disk lookup) are driven from this single list") and replaced `e2e2877`'s `fs.existsSync` probes of `_index.md`, `README.md`, `readme.md`, `index.md` with a `readdirSync` scan compared in lower case, so variants such as `Readme.md` resolve on case-sensitive file systems too ("Case-insensitive on all platforms"). A folder link that has no index shows a message rather than an arbitrary page, so a link never lands somewhere the author did not intend.
- **Alternatives considered**: Separate, slightly different lists per caller (the `e2e2877` state). Giving folder links the same first-Markdown fallback as Open Folder (not done). Accepting index files with any Markdown extension (only `.md` names are recognized).

### 4. Navigation as a typed request to the main process

- **Decision**: The renderer classifies a click: `http:`, `https:` and `mailto:` go to `open-external`; `#…` scrolls in place; everything else becomes `navigate({ href, fromPath })`, and explorer rows send `navigate({ path })`. Main maps the request through `resolveNavTarget()` to `markdown` (unsaved-changes guard, then `loadFile(path, anchor)`), `folder-empty` (info dialog), `external` (guarded OS open, see entry 6), `missing` (warning) or `null` (nothing to do: a pure anchor, a relative link from an untitled document, an unparsable `file://` URL).
- **Rationale**: The `navigateTo()` comment: "Main handles the dirty prompt and, on success, sends back a load-document that updates the view + explorer." One channel for explorer and links means the unsaved-changes guard, history recording (`4ebcdb2`) and explorer sync apply identically to both. The renderer ignores the reply; the visible effect always arrives as `load-document` or a dialog.
- **Alternatives considered**: Separate channels for explorer clicks and links (duplicated guard logic). A renderer-side unsaved-changes guard (the dirty flag and the prompt belong to the main-process `Session`).

### 5. GitHub-style heading identifiers

- **Decision**: `githubSlug()` lower-cases, trims, strips `[^\w\s-]` and turns whitespace runs into `-`; `assignHeadingIds()` keeps existing ids, falls back to `section`, and de-duplicates with `-1`, `-2`, …; the outline uses the same ids. `scrollToAnchor()` decodes the fragment and tries the raw id, then its slug, then a heading whose text slugifies to the same value.
- **Rationale**: `e2e2877`: "GitHub-style heading ids so #anchor links resolve". Documents written for GitHub link to `#some-heading`. The previous scheme (`slugify(text, index)` from `bd8f5ef`) produced ids such as `install-3` that depended on the heading's position, so hand-written anchors could not match them.
- **Alternatives considered**: Keeping index-suffixed ids (rejected for the reason above). A heading-anchor plugin for the Markdown renderer (a new runtime dependency where a few dozen lines of in-repo code suffice; constitution VI prefers small in-repo modules).

### 6. Web links and non-Markdown targets

- **Decision**: Only `http(s)` URLs reach the system browser: the `open-external` handler tests `^https?://`, `setWindowOpenHandler` always denies and forwards `http(s)`, and `will-navigate` cancels every non-`file://` navigation (forwarding `http(s)`). A non-Markdown local file goes through `openExternalTarget()`: refuse paths matching `^(\\\\|//)` ("Blocked opening a network location."), refuse the 28 `UNSAFE_OPEN_EXTENSIONS` ("Blocked opening an executable or script."), otherwise ask "Open this file with its default application?" with `path.resolve(target)` as detail and Cancel as default, then `shell.openPath()`.
- **Rationale**: The `openExternalTarget()` comment: "guarding against the obvious footguns: no UNC/remote paths, no executable/script types, and always an explicit confirmation showing the resolved absolute path so a malicious link can't silently launch anything." `e2e2877` called `shell.openPath(target.path)` directly; `8062af5` ("Fixing some security issues") replaced that call. The window guards' comment: "never let renderer content open new windows or navigate the top frame away from the local app shell (they would inherit the preload bridge)." Constitution III codifies both rules.
- **Alternatives considered**: Never opening non-Markdown files (loses linked PDFs and images). An allowlist of safe types (hard to keep complete across three operating systems). The original unguarded `shell.openPath()` (rejected as unsafe). Handing `mailto:` to the OS mail client (the renderer forwards it, but main only accepts `http(s)`; see Retroactive findings).

### 7. Back/Forward history model

- **Decision**: Each `Session` holds `history` (array of `{ path, anchor }`) and `historyIndex`. `loadFile()` records every displayed real file unless called with `{ record: false }`; `recordHistory()` drops forward entries and only updates the anchor when the file is already the current entry; `resetHistory()` empties the stack for built-in and untitled documents and Close Folder, and seeds it at window start and on Open Folder; `navigateHistory()` checks the file still exists, runs the unsaved-changes guard, moves the index and reloads without recording. The Go menu's enabled state comes from `canGoBack()`/`canGoForward()` of the focused window.
- **Rationale**: `4ebcdb2`: "Track a per-session, browser-style history of the file documents the user has viewed … Forward entries are truncated on a new navigation; a repeat of the current doc only updates its anchor … Built-in Welcome/Untitled docs and Close Folder reset the history so Back/Forward stay disabled outside a reading context … enabled state reflects the focused session and refreshes on focus via rebuildMenu." Keeping history in main, next to `loadFile()` and the guard, makes every entry point (links, explorer, Open, Open Recent, Find in Files results) record it with no extra code.
- **Alternatives considered**: History in the renderer (the menu needs it per focused window in main, and loading happens in main). Browser history through real window navigation (the window never navigates; entry 6). Including untitled documents (they have no path to return to).

### 8. Closing a folder and remembering the last one

- **Decision**: `doCloseFolder()` (`4a9cc98`) runs the guard, clears `session.currentFolder`, writes `folder: null` and `filesVisible: false`, sends `open-folder` with `null`, and shows Welcome through `loadBuiltinDoc()`; File > Close Folder is enabled only when `hasFolder`. The last folder is written on every Open Folder. `e2e2877` restored it at launch from `store.get('folder')`; `5c48052` (003) replaced that with startup driven by the launch argument, and the keys are still written.
- **Rationale**: `4a9cc98`: "New File menu command (enabled only when a folder is open) that clears the explorer, forgets the folder, and returns to the Welcome document … Refactored openBuiltinDoc into a reusable loadBuiltinDoc so the close path reuses the Welcome load without a double dirty-prompt." `5c48052`: "Folio no longer restores the previously opened folder/pane state on launch. Startup now depends solely on the launch argument."
- **Alternatives considered**: Closing to an empty untitled document (Welcome matches what a launch without arguments shows). Keeping restore-on-launch (superseded by 003's startup rule).

### 9. Keyboard shortcuts

- **Decision**: Open Folder… `Ctrl/Cmd+Shift+O`; Close Folder `Ctrl/Cmd+Shift+W`; Toggle File Explorer `Cmd+Alt+E` on macOS and a `Ctrl+Alt+E` label with a renderer key handler on Windows/Linux; Go > Back/Forward `Cmd+[`/`Cmd+]` on macOS and `Alt+Left`/`Alt+Right` elsewhere.
- **Rationale**: `356cf20` swapped Open Folder (was `Ctrl/Cmd+Shift+K`) with Toggle Outline, which puts Open Folder on the same letter as Open… (`Ctrl/Cmd+O`). Toggle File Explorer started as `CmdOrCtrl+Shift+E` (`e2e2877`); `68e67be` (008) gave that chord to Format > Code Block and moved the toggle to `Ctrl/Cmd+Alt+E`, baking the hint into the label on Windows/Linux because "Chromium's Windows menu renderer prints Ctrl+Alt accelerators in a non-standard 'Alt+Ctrl+…' order". Back/Forward follow each platform's browser convention, as constitution V names explicitly.
- **Alternatives considered**: A single `CmdOrCtrl+[`/`]` binding everywhere (not the convention on Windows and Linux). Native `Ctrl+Alt` accelerators on Windows/Linux (rejected in `68e67be` for the label-order reason above).

### 10. Link-target hover hint

- **Decision**: One overlay element (`#folio-link-hint`) pinned bottom-left of the content area, filled by `mouseover`/`mouseout` delegation on `#write`, hidden on `mouseleave` of the preview, on every `renderPreview()` and when source mode starts. `linkHintText()` mirrors click resolution: fragments as written, scheme-less relative links resolved against `state.baseUrl` and shown as a decoded path, everything else `decodeURI(href)`. The element has `pointer-events: none`, truncates with an ellipsis and has light and dark palettes.
- **Rationale**: Comments: "Browser-style status hint: while the pointer is over a link in the rendered preview, show its target in a small overlay pinned to the bottom-left. Wired once via event delegation on #write so it survives re-renders", and "Resolve relative targets against the open document so the hint shows where the link actually points, mirroring how clicks are resolved."
- **Alternatives considered**: Native `title` tooltips (Markdown already uses `title` for author-supplied link titles, and native tooltips appear only after a delay). Per-link listeners added in `wireLinks()` on every render (delegation is wired once and survives re-renders).

## Retroactive findings

### README ↔ code drift

1. **Last folder "remembered between launches"**: README (How to use → Open a folder) still says so. Since `5c48052` (003) the `folder` and `filesVisible` settings are written (Open Folder, every explorer toggle, Close Folder) but never read; the startup view comes only from the launch argument. Fix: reword the README sentence (or drop the dead keys).
2. **Hover hint undocumented**: `f8f17fa` added the link-target hint but changed README punctuation only. The Documentation gate expects a README line.
3. **Index and entry documents**: README says a folder link opens `_index.md` "(falling back to `README.md`)". Code also accepts `index.md`, matches all three in any letter case, and, on Open Folder only, falls back to the first Markdown file. The "Nothing to display for this folder." dialog likewise suggests only `_index.md (or README.md)`.
4. **External targets and `mailto:`**: README does not describe the block and confirmation dialogs for non-Markdown targets. `wireLinks()` (`e2e2877`) sends `mailto:` links to `open-external` with the comment "External links open in the OS browser / mail client", but the main handler (from `bd8f5ef`) accepts only `^https?://`, so `mailto:` clicks do nothing.

### Commit message ↔ code

5. **Back/Forward over a deleted file**: `4ebcdb2` says `navigateHistory` "skips entries whose file has since disappeared". The code shows "That document is no longer available." and leaves `historyIndex` unchanged, so entries beyond the missing one in that direction stay unreachable until new navigation truncates them.
6. **`file://` links**: `resolveNavTarget()` converts `file://` URLs with `fileURLToPath()`, but such links never reach it. markdown-it's default link validation renders `[x](file:///…)` and `<file:///…>` as plain text (verified by rendering with the project's markdown-it 14), and DOMPurify's default URI allow-list strips any remaining `file:` `href` (raw HTML) as well as every drive-letter `href` such as `C:/…`, whether it came from Markdown or raw HTML (per DOMPurify's documented default; not exercised here, since DOMPurify needs a DOM). On Windows, absolute links therefore work only when written `/`-rooted, which resolves on the current drive.

### Known limitations

7. **Symbolic links are not listed**: `scanFolder()` relies on `Dirent.isDirectory()`/`isFile()`, both `false` for symlinks (checked with Node on macOS), so linked files and folders never appear in the explorer, and the "symlink loops" concern in the comment never arises. Links to symlinked files still work because `fs.statSync` follows them.
8. **Snapshot explorer**: there is no folder watcher; files added, renamed or deleted (including Save As into the folder) appear only after reopening the folder. A deleted entry reports "Cannot find the linked item.".
9. **`.mkdn` mismatch**: the Windows file association (`package.json`, README) registers `.mkdn`, but `MD_EXTS` contains `.markdn` and not `.mkdn`, so `.mkdn` files are not listed and links to them take the external-open prompt.
10. **ASCII-only slugs**: `\w` in `githubSlug()` is ASCII-only, so non-ASCII letters are dropped (`Úvod` → `vod`), unlike GitHub. Fragments still resolve because `scrollToAnchor()` normalizes them the same way.
11. **Hint path format**: file targets are shown as decoded URL paths without their `#fragment`, so on Windows the hint reads `/C:/notes/a.md`; a `/`-rooted link shows no drive letter although a click resolves it on the current drive. The startup Welcome document carries the bundled sample's location, so the hint resolves its relative links even though clicking them does nothing (untitled document).
12. **Highlight matching ignores case everywhere**: `normPath()` lower-cases paths, so on a case-sensitive file system two files that differ only in case would both be highlighted.
13. **Open Folder without Markdown**: `openFolder()` resets the history before discovering that there is no entry document, so the still-displayed document is not in the history and Back cannot return to it after the next link.

### Hardening follow-ups (Principle III)

14. **Renderer-supplied paths**: `navigate` resolves relative links against `payload.fromPath` and accepts any explorer `payload.path`; using `session.currentPath` and restricting explorer paths to `session.currentFolder` would remove the reliance (see plan.md → Complexity Tracking).
15. **Network paths are touched before they are blocked**: `resolveNavTarget()` calls `fs.statSync()` on the target before `openExternalTarget()` checks for `\\`/`//`, so on Windows a click on a UNC link contacts the share before the "Blocked opening a network location." dialog, and Markdown files on a share are opened like local files.
16. **`file://` top-frame navigation**: the `will-navigate` guard cancels only non-`file://` URLs. Today no preview link can trigger a `file://` navigation, because every link is intercepted in `wireLinks()` and `file:` hrefs are dropped (finding 6); an explicit check that the target is the app shell would make the guard match constitution III on its own.

### Informational

17. **Shortcut history**: Open Folder `Ctrl/Cmd+Shift+K` → `Ctrl/Cmd+Shift+O` (`356cf20`); Toggle File Explorer `Ctrl/Cmd+Shift+E` → `Ctrl/Cmd+Alt+E` (`68e67be`, 008). README shows the current keys.
