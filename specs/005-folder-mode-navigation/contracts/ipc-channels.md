# Contract: IPC Channels

**Feature**: [../spec.md](../spec.md) | **Source**: `src/preload.js` (`window.folioAPI`), `src/main.js` (`ipcMain`), `src/renderer/renderer.js`

The renderer reaches the main process only through `window.folioAPI` (contextBridge, `contextIsolation: true`, `nodeIntegration: false`). This feature adds two members and extends four existing channels. Every handler resolves the calling window with `sessionFor(event.sender)`.

## New channels

### `navigate` (renderer → main, request/response)

| Aspect | Contract |
|--------|----------|
| Bridge | `folioAPI.navigate(payload)` → `ipcRenderer.invoke('navigate', payload)` (`e2e2877`) |
| Payload | `{ path: string }` for an explorer row or a Find in Files result (006); `{ href: string, fromPath: string \| null }` for a preview link (`href` is the raw attribute; `fromPath` is renderer `state.path`) |
| Handler | `ipcMain.handle('navigate', async (event, payload) => …)`; no session → `{ ok: false }`; otherwise `resolveNavTarget(payload)` from `src/folder.js` |
| Responses | `{ ok: true }` Markdown displayed · `{ ok: false, canceled: true }` user cancelled the unsaved-changes prompt · `{ ok: false, external: true }` non-Markdown target handled by `openExternalTarget()` (blocked, cancelled or opened) · `{ ok: false }` nothing to do, `folder-empty` or `missing` |
| Side effects | Dialogs (see [link-navigation.md](./link-navigation.md)); on success main sends `load-document` with `{ path, content, baseUrl, anchor }` and rebuilds the menu |
| Validation | `href` coerced with `String()`; decoding errors fall back to the raw text; an invalid `file://` URL or a relative `href` without `fromPath` resolves to nothing; existence and type are decided by `fs.statSync()` in main; the renderer ignores the reply (`navigateTo()` only logs a rejection) |
| Trust note | `fromPath` and `path` are taken from the renderer as-is; see [../plan.md](../plan.md) → Complexity Tracking |

### `open-folder` (main → renderer, event)

| Aspect | Contract |
|--------|----------|
| Bridge | `folioAPI.onOpenFolder(cb)` → `ipcRenderer.on('open-folder', …)` (`e2e2877`) |
| Payload | `{ root: string, name: string, tree: TreeNode[] }` from `openFolder()`, or `null` from `doCloseFolder()` (`4a9cc98`); `TreeNode` is defined in [../data-model.md](../data-model.md) |
| Renderer | `setFolder(payload, !!payload)`: replace `state.folder`/`state.tree`, reset `state.expanded`, expand ancestors of the displayed file, title the pane, dismiss the Find in Files box (006), re-render, and show the pane (payload) or hide it (`null`). Until `4a9cc98` the call was `setFolder(payload, true)`. |
| Ordering | `openFolder()` sends `open-folder` before `loadFile()` of the entry document, so the tree exists when the first `load-document` triggers `syncFileTree()`. |

## Existing channels extended

| Channel | Direction | Change | Commit |
|---------|-----------|--------|--------|
| `get-init` | renderer → main (invoke) | Response gains `folder: { root, name, tree } \| null` and `settings.filesVisible: boolean`. Today `folder` is non-null and `filesVisible` is `true` only when the window was created for a folder (`session.pendingOpenFolder`, see 003/007), and the history is seeded with the initial document (`resetHistory(session, document.path)`, `4ebcdb2`). `e2e2877` filled them from the stored `folder` setting until `5c48052`. | `e2e2877`, `5c48052`, `4ebcdb2` |
| `load-document` | main → renderer (event) | Payload gains `anchor: string \| null`; the renderer stores it in `state.pendingAnchor` and scrolls after rendering. | `e2e2877` |
| `command` | main → renderer (event) | New name `toggle-files`. | `e2e2877` |
| `state-changed` | renderer → main (send) | New key `filesVisible`, stored only when `typeof state.filesVisible === 'boolean'`. | `e2e2877` |

## Existing channel reused

| Channel | Use by this feature | Guard |
|---------|---------------------|-------|
| `open-external` (`folioAPI.openExternal(url)`, from `bd8f5ef`) | `wireLinks()` sends `http:`, `https:` and `mailto:` link clicks | Main opens only URLs matching `^https?://` with `shell.openExternal()`; everything else, including `mailto:`, is ignored |

## Not exposed

No channel lists directories, reads arbitrary files or opens paths on the renderer's behalf; folder scanning, link classification and OS hand-off happen only inside the `navigate` and Open Folder flows in main.
