# Data Model: Find in Document & Find in Files

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All state introduced by this feature is in memory and per window, apart from the main-process search
caches, which are shared by the whole process. No setting is added to `folio-settings.json`. Wire
formats are specified in [contracts/ipc-search-files.md](./contracts/ipc-search-files.md); element
ids and highlight names are in [contracts/find-ui-dom.md](./contracts/find-ui-dom.md).

## 1. FindState: in-page find bar (renderer, per window)

**Lives in**: `state.find` in `src/renderer/renderer.js` (`2a26dea`).

| Field | Type | Default | Rules |
|---|---|---|---|
| `open` | boolean | `false` | `true` exactly while `#folio-find` is visible. |
| `query` | string | `''` | The raw field value, not trimmed. It is set on every `runFind()`. It is not reset when the bar closes, because the field keeps its text for the next time the bar opens. |
| `matches` | `Range[]` | `[]` | Non-overlapping ranges inside non-blank text nodes under `#write`, in document order and case-insensitive. Rebuilt from scratch on every query change and on every `renderPreview()` while the bar is open. `[]` when the query is empty or the Highlight API is unavailable. |
| `index` | integer | `-1` | The current match, `0 … matches.length - 1`. Set to `0` whenever matches are recomputed, and `-1` when there are none. |

**Derived display**: `#folio-find-count` shows `` `${index + 1}/${matches.length}` `` when there are
matches, `0/0` when `query` is non-empty and there are no matches, and an empty string otherwise.

**State transitions**:

```text
          Ctrl/Cmd+F in rendered view, or result hand-off (§3)
 Closed ──────────────────────────────────────────────────────▶ Open
   ▲                                                              │ input event   → recompute; index = 0 (or -1)
   │  Esc in field / ✕ button / setSourceMode(true)               │ Enter / ↓     → index = (index + 1) % n
   └──────────────────────────────────────────────────────────────┤ Shift+Enter/↑ → index = (index - 1 + n) % n
      (highlights cleared, matches = [], index = -1;              │ renderPreview → recompute on the new DOM; index = 0
       field text kept)                                           │ Ctrl/Cmd+F    → refocus + select; recompute
```

## 2. Highlight registrations (renderer, per window)

**Lives in**: the `CSS.highlights` registry. It is written by `runFind()` and `setCurrentMatch()` and
cleared by `clearFindHighlights()` (`2a26dea`).

| Name | Value | Priority | Lifecycle |
|---|---|---|---|
| `folio-find` | `new Highlight(...matches)` | default (0) | Replaced on every recompute and deleted when the bar closes. |
| `folio-find-current` | `new Highlight(matches[index])` | `1`, painted above `folio-find` | Replaced on every step and deleted when the bar closes. |

**Validation**: Both entries are guarded by `HIGHLIGHT_SUPPORTED`
(`typeof window.Highlight === 'function' && CSS.highlights`). When the API is missing, nothing is
registered and the bar reports `0/0`.

## 3. PendingFindQuery: hand-off from a result to a document (renderer, per window)

**Lives in**: `state.pendingFindQuery: string`, default `''` (`e126f54`).

| Event | Effect |
|---|---|
| `openSearchResult(path, query)` | Sets the term to the results' trimmed `query`, then calls `navigateTo({ path })`. |
| `loadDocument(doc)`, as its last step | Reads the term and resets it to `''`. If the window is not in source mode, it calls `openFindBar(term)`, which overwrites the find field. |

**Known gap**: When `navigate` is cancelled at the unsaved-changes prompt, or the file cannot be
read, no `load-document` event arrives, so the term stays set until the next document loads in that
window. See research.md ▸ Retroactive findings.

## 4. FileSearchView: Find-in-Files pane (renderer, per window)

**Lives in**: the `#folio-files-search` element (its `hidden` attribute and `value`), the
`fileSearchTimer` timeout handle, and the `hidden` flags of `#folio-files-tree` and
`#folio-files-results` in `src/renderer/renderer.js`. Introduced in `e126f54`; the hidden-until-invoked
behaviour came in `4a9cc98`.

**States**:

| State | Box | Tree | Results |
|---|---|---|---|
| **Hidden** (initial) | hidden, empty | shown | hidden, empty |
| **Open-Empty** | shown, focused | shown | hidden |
| **Pending** | shown | unchanged | unchanged (180 ms timer running) |
| **Showing** | shown | hidden | summary + groups, or "No matches" |

**Transitions**:

```text
Hidden ──Ctrl/Cmd+Shift+F (folder open)──▶ Open-Empty     (also reveals the explorer and persists filesVisible = true)
Open-Empty / Showing ──input──▶ Pending ──180 ms──▶ runFileSearch()
any shown state ──Enter──▶ runFileSearch() immediately     (timer cleared)
runFileSearch(): trimmed value === '' ──▶ Open-Empty        (showFileTree())
runFileSearch(): reply ──▶ Showing                          (renderFileResults(data))
any shown state ──Esc──▶ Hidden                             (hideFileSearch(); best-effort refocus of the preview)
any state ──setFolder(payload | null)──▶ Hidden             (folder opened, switched or closed)
```

Toggling the explorer with the Files button or `View ▸ Toggle File Explorer` changes only the pane's
visibility. The box and its results are kept.

## 5. SearchRequest / SearchResult (renderer ↔ main)

**Lives in**: the `search-files` channel; the result is produced by `searchInFolder()` in
`src/folder.js` (`e126f54`).

| Entity | Field | Type | Rules |
|---|---|---|---|
| SearchRequest | `query` | string | The trimmed value of the box. The renderer never sends an empty string. The main process applies `String(query == null ? '' : query)` and lowercases it; if the trimmed result is blank it returns an empty result. |
| SearchResult | `query` | string | Echoes the request unchanged. The renderer uses it for `<mark>` emphasis and for the hand-off in §3. |
| | `files` | FileResult[] | 0 to 500 entries, in explorer order (subfolders first, depth-first; natural, case-insensitive name order), and only files that have at least one match. |
| | `truncated` | boolean | `true` exactly when the total match count reached 1,000. |
| FileResult | `path` | string | Absolute path, used for navigation and as the tooltip. |
| | `name` | string | `path.relative(<folder root>, path)`, with OS separators. |
| | `matches` | Match[] | 1 to 50 entries, in line order. |
| Match | `line` | integer ≥ 1 | 1-based line number after `split(/\r?\n/)`. |
| | `text` | string | `line.trim().slice(0, 240)`. |

**Relationships**: A SearchResult has many FileResults, and a FileResult has many Matches. A
FileResult's `path` always lies inside the requesting window's `Session.currentFolder`.

## 6. Search limits (constants in `src/folder.js`)

| Constant | Value | Effect | Commit |
|---|---|---|---|
| `SEARCH_MAX_MATCHES_PER_FILE` | 50 | Stops reading a file's lines after 50 matches. | `e126f54` |
| `SEARCH_MAX_TOTAL_MATCHES` | 1000 | Ends the whole search and sets `truncated`. | `e126f54` |
| `SEARCH_MAX_FILES` | 500 | Ends the search once 500 files have matches. Does not set `truncated`. | `e126f54` |
| excerpt length | 240 | `text` is capped by `slice(0, 240)` after `trim()`. | `e126f54` |
| typing pause | 180 ms | `scheduleFileSearch()` timeout in `src/renderer/renderer.js`. | `e126f54` |
| `FILE_LIST_TTL_MS` | 4000 | How long a folder's Markdown file list is reused. | `8062af5` |

## 7. Search caches (main process, module scope in `src/folder.js`, `8062af5`)

| Cache | Shape | Validity rule |
|---|---|---|
| `_fileListCache` | `{ dir: string \| null, at: number (epoch ms), files: string[] }` | Reused when `dir` is the searched folder and `Date.now() - at < 4000`. Otherwise `collectMarkdownFiles(scanFolder(dir))` runs again, and `_contentCache` is cleared first if `dir` changed. |
| `_contentCache` | `Map<absolutePath, { mtimeMs: number, lines: string[] }>` | Reused when `fs.statSync(path).mtimeMs` equals the cached `mtimeMs`; otherwise the file is read again. If `stat` or the read fails, `linesFor()` returns `null` and the file is skipped. |

**Invalidation**: `invalidateSearchCache()` resets both caches. It is called from `openFolder()` and
`doCloseFolder()` in `src/main.js`.

**Scope**: There is one pair of caches per process, shared by every window (007). This affects how
much can be reused, never whether results are correct.

## 8. Referenced state (owned by other specs)

| State | Owner | How this feature uses it |
|---|---|---|
| `Session.currentFolder` (`src/main.js`) | 005 / 007 | The only source of the searched root, read through `sessionFor(event.sender)` (`8062af5`). When it is `null`, `actions.findInFiles` shows the "Find in Files searches an open folder." dialog. |
| `filesVisible` setting (`folio-settings.json`) | 005 | Set to `true` when Find in Files reveals the explorer (`setFilesVisible(true)` → `persistState()`). |
| Back/Forward `Session.history` | 005 | Opening a result is recorded like any explorer click (`navigate` → `loadFile()` → `recordHistory()`). |
| `Session.isDirty` | 001 | Read by `confirmDiscardIfDirty()` before a result replaces the document. |
