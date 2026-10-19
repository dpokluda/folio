# Contract: Theme IPC Payloads

**Feature**: [../spec.md](../spec.md) | **Changed by**: `1f452ec` | **Source**: `ipcMain.handle('get-init')`, `pushTheme()`/`pushThemeAll()` in `src/main.js`; `onSetTheme`/`getInit` in `src/preload.js` (unchanged); `boot()`/`applyTheme()` in `src/renderer/renderer.js`

No channel or `window.folioAPI` method is added. Both channels already existed in 001; this feature changes their theme payloads.

## `get-init` (renderer → main, `ipcRenderer.invoke`, via `window.folioAPI.getInit()`)

Theme-related fields of the response:

| Field | Type | Status | Meaning |
|-------|------|--------|---------|
| `themesBaseUrl` | string | unchanged | `file:` URL of `themesDir()` with a trailing separator |
| `themeFiles` | `string[]` | **added** | `composeThemeFiles()`: 2–3 paths relative to `themesBaseUrl`, in cascade order |
| `themes` | `string[]` | **removed** | 001's list of top-level theme files |
| `theme` | string | **removed** | 001's active theme file |

The renderer calls `applyTheme(init.themeFiles)` during `boot()`, before restoring view state and loading the document.

## `set-theme` (main → renderer, `webContents.send`, via `window.folioAPI.onSetTheme(cb)`)

| Version | Payload |
|---------|---------|
| 001 | `string` — a single theme file name |
| 004 (`1f452ec`) | `{ files: string[] }` — the composed layer list |

- Sent after a Style or Page width change: to the single window in `1f452ec`, to every window's Session via `pushThemeAll()` since `8062af5` ([007-multiple-windows](../../007-multiple-windows/spec.md)).
- Not sent for Appearance changes; Appearance is `nativeTheme.themeSource`, which reaches every window without a message.
- `applyTheme(payload)` accepts either an array or `{ files }`; a missing or empty list is ignored (the current layers stay).

## Validation and security (constitution Principle III)

- The renderer never chooses a theme file: lists are built in the main process from the whitelists `STYLE_FAMILIES` and `PAGE_WIDTHS`, and `themesBaseUrl` is computed by the main process.
- There is no renderer → main channel for changing the theme; the selection changes only through the native Themes menu.
- Payloads carry only relative file names; the renderer prefixes them with `themesBaseUrl` and loads them as stylesheets (no script), within the existing CSP (`style-src 'self' 'unsafe-inline' file:`).

## Later additions (not part of this feature)

`appearance-changed` (main → renderer, `1ce68e0`, [010-mermaid-diagrams-code-blocks](../../010-mermaid-diagrams-code-blocks/spec.md)) re-renders diagrams when `nativeTheme` updates; `applyTheme()` also refreshes diagrams once the new layers have loaded.
