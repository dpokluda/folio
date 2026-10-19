# Contract: IPC Channels for Multiple Windows

**Feature**: [../spec.md](../spec.md) | **Sources**: `src/main.js`, `src/preload.js` (`window.folioAPI` via `contextBridge`), `src/renderer/renderer.js`

This contract covers what `8062af5` added, removed or re-scoped so that several windows can share one main process. Channels owned by other features are listed only where their routing changed.

## Added: main → renderer request/response

### `folio-request` (main → renderer)

| Property | Value |
|---|---|
| Sent by | `ask(session, kind, { timeoutMs = 4000, fallback = null })` in `src/main.js` |
| Transport | `session.win.webContents.send('folio-request', payload)`. It goes only to the window that owns the Session. |
| Payload | `{ id: number, kind: 'content' \| 'prepare-export' }`. `id` comes from the process-wide counter `nextRequestId`, which starts at 1. |
| Pending state | `pendingRequests.set(id, { resolve, timer })`. When the timer fires, the entry is deleted and the promise resolves to `fallback`. |

### `folio-response` (renderer → main)

| Property | Value |
|---|---|
| Sent by | the preload's `onRequest` wrapper: `ipcRenderer.send('folio-response', { id, value })` |
| Handled by | `ipcMain.on('folio-response', (_e, { id, value } = {}) => …)` |
| Matching | `pendingRequests.get(id)`. An unknown or expired `id` is ignored. Otherwise the timer is cleared, the entry deleted and the promise resolved with `value`. |
| Not validated | The sender is not compared with the window that was asked, and the type of `value` is not checked. See [research.md, finding 4](../research.md#retroactive-findings). |

### Preload surface: `folioAPI.onRequest(handler)`

- It registers a single `ipcRenderer.on('folio-request', …)` listener.
- For each `{ id, kind }` it awaits `handler(kind)`, which may return a value or a Promise, and replies `{ id, value }`. If the handler throws, `value` is `null`.
- It is the only main-initiated question the page can answer. `kind` is an opaque string that only the page's handler interprets. The bridge exposes no eval, file or shell access (Principle III).

### Page handler: `handleMainRequest(kind)` in `src/renderer/renderer.js`

The page registers it with `window.folioAPI.onRequest(...)` as the last step of `boot()`, after `get-init` and all other listeners.

| `kind` | Returns | Side effects |
|---|---|---|
| `content` | `currentText()`: the editor's text in source mode, otherwise the loaded document text | none |
| `prepare-export` | `true`. Since 010 this is a Promise that resolves once Mermaid diagrams have finished drawing. | leaves source mode if it is on |
| anything else | `null` | none |

### Main-side callers

| Caller | `kind` | Fallback after 4 s | Effect of the fallback |
|---|---|---|---|
| `doSave(session)` | `content` | `null` | returns `false` without writing and without a message. A pending close stays cancelled. |
| `doSaveAs(session)` | `content` | `null` | returns `false` after the file dialog, without writing. |
| `doExportPDF(session)` | `prepare-export` | `true` | the export continues and prints `session.win`. |

## Removed

- The page global `window.folio = { getContent, prepareForExport }`, which lived in the page's main world.
- The main-process calls `mainWindow.webContents.executeJavaScript('window.folio.getContent()')` and `executeJavaScript('window.folio.prepareForExport()')`. They ran in the main world and bypassed context isolation.

## Re-scoped: channels that now resolve the caller's window

| Channel | Direction | Payload | Resolution | Validation |
|---|---|---|---|---|
| `get-init` | renderer → main (`invoke`) | none | `sessionFor(event.sender)`. It consumes that Session's `pendingOpenFolder`, or else its `pendingOpenPath`, once. | The folder must still be a directory, otherwise Welcome is shown. An unreadable file shows an error box, then Welcome. Without a target the window shows Welcome. |
| `dirty-changed` | renderer → main (`send`) | boolean | the sender's Session. Ignored if there is none. | coerced with `!!value` |
| `navigate` | renderer → main (`invoke`) | navigation payload (005) | the sender's Session, or `{ ok: false }` if there is none | targets and guard defined by 005 |
| `search-files` | renderer → main (`invoke`) | query string (006) | the folder of the sender's Session. Returns an empty result when there is no Session or folder. | defined by 006 |
| `state-changed` | renderer → main (`send`) | `{ sourceMode?, outlineVisible?, filesVisible?, lineNumbers?, zoom? }` | Deliberately **not** per window. It writes the shared store, and the last writer wins. | a `typeof` check per key |
| `open-external` | renderer → main (`send`) | URL string | not per window | only `http(s)` URLs are passed on (001) |

## Re-targeted: main → renderer events

| Channel | Before `8062af5` | After |
|---|---|---|
| `set-theme` | the only window | **every** window, through `pushThemeAll()`, with payload `{ files: string[] }` (the composed layer stack, defined by 004) |
| `load-document`, `open-folder`, `saved`, `document-path-changed` | the only window | only the window of the Session being acted on (`send(session, …)`) |
| `command` | the only window | the focused window (`sendFocused`), or a specific Session (for example `find-in-files`) |

`appearance-changed`, added later by 011, is also sent to every window.

## Principle III review notes

- Every window is built by `createWindow()` with `contextIsolation: true`, `nodeIntegration: false` and the same preload script. No window gets a wider bridge.
- Every handler that touches document state resolves the Session from `event.sender`. None trusts a window id, path or Session id supplied by the page.
- The request/response pair is narrow (two `kind` values) and replaces a main-world `executeJavaScript` bridge.
- Open follow-up: `folio-response` should accept a reply only from the window that was asked, and only a string for `content` (see [research.md, finding 4](../research.md#retroactive-findings)).
