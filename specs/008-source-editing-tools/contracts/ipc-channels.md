# Contract: IPC Channels (changes only)

**Feature**: [spec.md](../spec.md) | **Source**: `src/main.js`, `src/preload.js` (unchanged), `src/renderer/renderer.js` | **Introduced in**: `68e67be`

This feature adds **no new channel and no new `window.folioAPI` method**. It adds payload shapes to existing channels and one field each to two existing messages. `src/preload.js` is not touched; `git show --stat 68e67be` does not list it.

## `command` (main → renderer, existing; `window.folioAPI.onCommand`)

**Change to the renderer handler**: `window.folioAPI.onCommand((payload) => handleCommand(payload))`. `handleCommand` now receives the whole payload object; before this feature it received only `payload.name`. This lets a command carry data.

| `name` | Extra fields | Sent by (`src/main.js`) | Target | Renderer effect |
|---|---|---|---|---|
| `format` | `format`: one of `bold`, `italic`, `underline`, `strikethrough`, `code`, `codeblock`, `link`, `math`, `mathblock`, `h1`…`h6` | `actions.format(kind)` | Focused window (`sendFocused`) | `applyFormat(payload.format)`. Unknown values only refocus the editor. Outside source mode it shows the formatting hint toast. |
| `toggle-line-numbers` | none | `actions.toggleLineNumbers()` | Focused window (`sendFocused`) | `setLineNumbers(!state.lineNumbers)` |
| `toast` | `text`: string | `copyDocumentPath()` | The focused window's Session (`send(session, …)`) | `showToast(payload.text)`. Empty or missing text is ignored, and text is set with `textContent`. |

**Origin guarantee**: every value above is produced by main-process code from the static menu template or fixed strings. None is echoed from renderer input.

## `state-changed` (renderer → main, existing; `window.folioAPI.setState`)

**New field**: `lineNumbers: boolean`, sent by `persistState()` together with `sourceMode`, `outlineVisible`, `filesVisible` and `zoom`.

| Field | Validation in main | Effect |
|---|---|---|
| `lineNumbers` | Accepted only if `typeof state.lineNumbers === 'boolean'`; other types are ignored | `store.set('lineNumbers', value)`, then `rebuildMenu()` so the View > Show Line Numbers check mark matches the stored value |

The handler does not resolve a Session because the value is an app-wide preference.

## `get-init` (renderer → main, `invoke`, existing; `window.folioAPI.getInit`)

**New reply field**: `settings.lineNumbers`, the raw value of `store.get('lineNumbers')`. `boot()` applies `state.lineNumbers = !!s.lineNumbers` before the editor is lazily created.

## Clipboard

Folio writes the clipboard only in the main process, with `clipboard.writeText(session.currentPath)` inside `copyDocumentPath()`. The renderer neither reads nor writes it for this feature, and no channel accepts a path from the renderer.

## Principle III review

| Check | Result |
|---|---|
| New preload surface | None |
| New renderer → main capability | None. `state-changed` only gains a type-checked boolean. |
| Renderer-supplied state trusted by main | No. The copied path comes from the focused window's Session. |
| HTML injection | None. Toast text uses `textContent`. |
