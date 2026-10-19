# Contract: Startup View (`get-init`)

**Feature**: [../spec.md](../spec.md) | **Implements**: FR-001, FR-002, FR-006, FR-013 to FR-015

**Code**: `ipcMain.handle('get-init', …)` in `src/main.js`; consumer `boot()` in `src/renderer/renderer.js`; bridge `getInit` in `src/preload.js`.

**Introduced/changed by**: the channel exists since the initial build (`bd8f5ef`, 001). This feature changed how its values are chosen: `f96fc39` (document from a launched file, error box, Welcome fallback) and `5c48052` (folder launches, outline never shown, explorer only for a folder, no stored-session restore). 007 (`8062af5`) moved the pending slots onto the per-window `Session`. The bridge surface is unchanged: no new channel, no new `window.folioAPI` method.

## Channel

| Property | Value |
|---|---|
| Name | `get-init` |
| Direction | renderer → main, request/response (`ipcRenderer.invoke`) |
| Bridge | `window.folioAPI.getInit()` |
| Request payload | none |
| Validation | The window's `Session` is resolved with `sessionFor(event.sender)`. What to open comes only from that session's one-shot `pendingOpenFolder`/`pendingOpenPath`, set in the main process by `createWindow(target)`; the renderer cannot choose a path. Each slot is set to `null` before it is used. |

## Response fields driven by this feature

| Field | Type | Value |
|---|---|---|
| `folder` | `{ root: string, name: string, tree: Node[] } \| null` | Set only when `pendingOpenFolder` is still a directory: `tree = scanFolder(dir)` (bounded scan from 005). Otherwise `null`. |
| `document` | `{ path: string \| null, content: string, name: string, baseUrl: string \| null }` | 1. The folder's entry document (`entryDocFor(tree)`), if any and readable. 2. Otherwise `pendingOpenPath`, read as UTF-8. 3. Otherwise the Welcome document: `{ path: null, name: 'Welcome' }` from `samples/welcome.md`, or the built-in text `# Welcome to Folio …` if that file cannot be read. |
| `settings.filesVisible` | `boolean` | `true` only when a folder launch produced `folder` |
| `settings.outlineVisible` | `boolean` | always `false` |
| `settings.sourceMode`, `settings.lineNumbers`, `settings.zoom` | as stored | unchanged by this feature (preferences still apply) |
| `themesBaseUrl`, `themeFiles` | — | owned by 001/004, unchanged |

## Errors and side effects

- An unreadable `pendingOpenPath` shows `dialog.showErrorBox('Folio — cannot open file', '<path>\n\n<message>')` and falls through to the Welcome document.
- An unreadable folder entry document, or a folder that vanished, falls through silently to the Welcome document (a launch target is either a file or a folder, never both).
- When a document comes from a launch, the main process sets `currentPath`/`currentName`, calls `store.addRecent`, clears the dirty flag, starts the file watcher, and rebuilds the menu and title. A folder launch also sets `currentFolder` and writes `store.set('folder', dir)`, which is write-only since `5c48052` (see [../research.md](../research.md#retroactive-findings)).
- Back/forward history is seeded with `document.path` (or empty for the Welcome document).

## Renderer consumption (`boot()`)

`setOutlineVisible(!!settings.outlineVisible)` → `setFolder(folder)` when present → `setFilesVisible(!!settings.filesVisible && !!state.folder)` → `loadDocument(document)` → `setSourceMode(true)` when `settings.sourceMode`.
