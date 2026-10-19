# Contract: IPC Channels (feature 010)

**Scope**: Channels this feature introduced or changed. All other channels in `window.folioAPI` (`src/preload.js`) belong to earlier features, mainly [001](../../001-markdown-viewer-editor/spec.md) and [007](../../007-multiple-windows/spec.md).

## `appearance-changed` (new in `1ce68e0`)

| Aspect | Contract |
| ------ | -------- |
| Direction | main → renderer (one-way event) |
| Emitter | `nativeTheme.on('updated', …)` in `src/main.js` sends `send(session, 'appearance-changed')` to **every** entry in `sessions`. `send()` skips destroyed windows. |
| Payload | None (`undefined`). The renderer reads the new appearance from `prefers-color-scheme` itself. |
| Preload surface | `window.folioAPI.onAppearanceChanged(cb)` → `listen('appearance-changed', cb)` |
| Renderer handler | `setTimeout(refreshMermaid, 0)`, registered in `boot()` in `src/renderer/renderer.js` |
| Triggers | Any `nativeTheme` update. This includes **Themes → Appearance** changes (`applyAppearance()` sets `nativeTheme.themeSource`, [004](../../004-three-axis-theming/spec.md)), OS light/dark flips while `themeSource === 'system'` ([011](../../011-system-appearance/spec.md)), and other OS theme updates. Handling is idempotent: redrawing with an unchanged palette is harmless. |
| Validation | None needed: there is no payload, and the renderer cannot send on this channel. |
| Why it exists | Chromium updates the `prefers-color-scheme` value after a `nativeTheme` flip but does not fire the media query's `change` event, so script-drawn content (Mermaid SVG) would keep its old palette. |

## `folio-request` / `folio-response`: kind `prepare-export` (changed in `1ce68e0`)

The request/response pair and the `ask()` helper date from `8062af5`. This feature changed only the `prepare-export` kind:

| Aspect | Before `1ce68e0` | After `1ce68e0` |
| ------ | ---------------- | --------------- |
| Main call (`doExportPDF()`) | `ask(session, 'prepare-export', { fallback: true })`, default `timeoutMs` 4000 | `ask(session, 'prepare-export', { fallback: true, timeoutMs: 20000 })` |
| Renderer reply (`handleMainRequest()`) | Leave source mode, return `true` | Leave source mode, then return `whenMermaidSettled().then(() => true)` (a Promise) |
| On timeout | Resolves `true` (fallback) after 4 s | Resolves `true` (fallback) after 20 s |

`onRequest` in `src/preload.js` already `await`s the handler's result before replying on `folio-response`, so Promise replies needed no preload change. Other request kinds (`content`) keep the 4000 ms default.

## Deliberately not added

- **No renderer → main clipboard channel.** The copy button calls `navigator.clipboard.writeText()` in the renderer.
- **No highlighting or diagram channel.** Both run entirely inside the renderer bundle.

## Security review (constitution Principle III, quality gate 5)

- `appearance-changed` carries no data and can only make the renderer re-render its own preview.
- The `prepare-export` change adds no inputs. The main process still picks the target session itself (the focused window, through `withSession`) and matches the reply only by its single-use request id. `doExportPDF()` uses the reply only to end the wait and ignores its value, so a misbehaving renderer can at most make the export wait the full 20 s.
- The CSP in `src/renderer/index.html` is unchanged (`script-src 'self'`).
