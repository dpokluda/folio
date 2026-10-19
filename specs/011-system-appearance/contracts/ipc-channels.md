# Contract: IPC — appearance change notification

**Feature**: [011-system-appearance](../spec.md) | **Sources**: `src/main.js`, `src/preload.js`, `src/renderer/renderer.js`

**`0bbcf84` added no IPC channel and no `window.folioAPI` method.** This contract records the existing channel System relies on and the trigger the channel gained. The channel itself belongs to [010-mermaid-diagrams-code-blocks](../../010-mermaid-diagrams-code-blocks/spec.md).

## `appearance-changed`

| Property | Value |
|---|---|
| Direction | main → renderer (one-way event) |
| Introduced | `1ce68e0` (2026-08-12), for manual Light/Dark switches |
| Sender | `nativeTheme.on('updated', () => { for (const session of sessions.values()) send(session, 'appearance-changed'); })` in `src/main.js` |
| Trigger | Every `nativeTheme` `'updated'` event. **New with `0bbcf84`**: under `themeSource = 'system'` this includes light/dark changes made by the OS, whether by hand, by macOS Auto or by a schedule. Explicit menu picks trigger it too, because setting `themeSource` emits `'updated'`. |
| Recipients | Every live `Session`; `send()` skips destroyed windows. Focused, background and minimized windows alike. |
| Payload | None. The renderer reads the new scheme itself from `prefers-color-scheme`. |
| Preload surface | `window.folioAPI.onAppearanceChanged(cb)` → `ipcRenderer.on('appearance-changed', …)` (`src/preload.js`) |
| Renderer handling | `window.folioAPI.onAppearanceChanged(() => setTimeout(refreshMermaid, 0))`. A timer is used instead of `requestAnimationFrame` so that background windows run it. `refreshMermaid()` returns early in source mode or when the preview has no `[data-folio-mermaid]` placeholder; otherwise it calls `renderPreview()`. |
| Ordering | No ordering guarantee relative to the CSS restyle. The timer defers the redraw until the page "has settled on the new appearance before mermaid reads it". |
| Validation | None needed: there is no payload and no renderer → main counterpart. |

### Why the event exists

From the comment above the listener in `src/main.js`: "Chromium updates the media query's *value* in the renderer but does not dispatch a `change` event for it, so anything that has to react in script (mermaid diagrams bake their palette into the generated SVG) needs an explicit nudge."

### Security review (constitution Gate 5, Principle III)

- **No write path**: no renderer → main channel can change the appearance. `actions.setAppearance` is reachable only from menu items with literal values.
- **No data exposure**: the event carries nothing the renderer could not already read with `matchMedia`.
- **Hardened rendering preserved**: the redraw re-runs `renderPreview()`, which re-sanitizes the HTML with DOMPurify, and Mermaid keeps `securityLevel: 'strict'`.
- **Sender check**: `sessionFor(event.sender)` is not involved, because this is a broadcast from main and no renderer-supplied state is trusted.

## Related channels (unchanged)

| Channel | Direction | Relevance |
|---|---|---|
| `set-theme` (`{ files }`) | main → renderer | Style and Page width layers (004). Not sent for appearance changes, which load no stylesheet. |
| `folio-request` / `folio-response`, kind `prepare-export` | main ↔ renderer | `doExportPDF()` waits for `whenMermaidSettled()`, which includes a redraw already in progress (010). The appearance is not changed for export. |
