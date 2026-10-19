# Contract: Settings File Schema (`folio-settings.json`)

**Feature**: [001 spec](../spec.md) | **Source**: `src/store.js` (`DEFAULTS`, `MAX_RECENT`, `Store`), `src/main.js` (`state-changed` handler, `persistWindowBounds`, `get-init`)

## Location and format

- Path: `path.join(app.getPath('userData'), 'folio-settings.json')`, in Electron's per-user `userData`
  directory.
- Format: a single JSON object, UTF-8, pretty-printed with 2-space indentation.
- It is rewritten synchronously after every `set()`, `addRecent()` and `clearRecent()` (`_flush()`).
- Shared by every window of the running app. Per-document state never lives here (constitution
  Principle IV).

## Keys introduced by this feature

| Key | Type | Default | Written by | Read by / restored | Validation |
|---|---|---|---|---|---|
| `theme` | `string` | `'fluent.css'` | Themes menu (`actions.setTheme`, 001) | `get-init` sent it to the page, which applied `<link id="theme-style">` | Legacy since 004: `migrateLegacyTheme()` maps it onto `styleFamily`, `appearance` and `pageWidth`, then the key is deleted. |
| `recentFiles` | `string[]` (absolute paths) | `[]` | `addRecent()` on open, save, Save As and launch targets; `clearRecent()` | File ▸ Open Recent (`rebuildMenu`) | Empty paths are ignored; duplicates move to the front; truncated to `MAX_RECENT = 10`. |
| `window` | `{ width: number, height: number }` | `{ width: 1100, height: 820 }` | `persistWindowBounds()` when a window closes (clean or after the prompt) | `createWindow()` size | Merged one level deep with the defaults on load. The window enforces at least 640 × 480. Only the size is stored, not the position. |
| `sourceMode` | `boolean` | `false` | `state-changed` | `get-init.settings`, then `setSourceMode(true)` at boot | Persisted only if `typeof === 'boolean'`. |
| `outlineVisible` | `boolean` | `false` | `state-changed` | Not restored since `5c48052` (003): `get-init` always sends `false` | Persisted only if `typeof === 'boolean'`. |
| `zoom` | `number` (integer step) | `0` | `state-changed` | `get-init.settings`, then `applyZoom()` | Persisted only if `typeof === 'number'`. The page clamps steps to −5…15 and the factor to 0.5–2.5. |

Keys added by later specs: `styleFamily`, `appearance`, `pageWidth` (004); `filesVisible`, `folder`
(005); `lineNumbers` (008).

## Load and save behavior

1. If the file exists, it is parsed as JSON.
2. `data = { ...DEFAULTS, ...parsed }`, plus 004's migration. `data.window` is merged with
   `DEFAULTS.window`. Unknown keys are kept and written back.
3. Any read or parse error is logged (`[folio] failed to read settings, using defaults:`) and the app
   continues with `DEFAULTS`. It never crashes.
4. A write failure is logged (`[folio] failed to persist settings:`). The in-memory value stays in
   effect for the session.

## Example (as written by 001 at `bd8f5ef`)

```json
{
  "theme": "fluent.css",
  "recentFiles": [
    "/Users/me/notes/todo.md"
  ],
  "window": {
    "width": 1100,
    "height": 820
  },
  "sourceMode": false,
  "outlineVisible": false,
  "zoom": 0
}
```
