# Contract: UI Elements (toast, line-number gutter)

**Feature**: [spec.md](../spec.md) | **Source**: `src/renderer/index.html`, `src/renderer/app.css`, `src/renderer/renderer.js` | **Introduced in**: `68e67be`

## 1. Transient notice (`#folio-toast`)

**DOM**: the element is placed in `src/renderer/index.html` inside `#folio-content`, after `#folio-link-hint`. That puts it over the document area, which holds both the preview and the source editor, and not over the side panes.

```html
<div id="folio-toast" hidden role="status" aria-live="polite"></div>
```

| Aspect | Contract |
|---|---|
| Accessibility | `role="status"` plus `aria-live="polite"` makes screen readers announce each message without moving focus. While `hidden`, the element is `display: none` and outside the accessibility tree. |
| Interaction | `pointer-events: none` and `user-select: none`: the notice never blocks clicks or takes focus. |
| Placement | `position: absolute; left: 50%; bottom: 24px; z-index: 30`, with a `translate(-50%, 6px)` offset that slides to `translate(-50%, 0)` when shown. |
| Size | `max-width: min(80%, 520px)`, a single line (`white-space: nowrap`) with `text-overflow: ellipsis`. |
| Typography | System UI font stack, `font-size: 12.5px`, `line-height: 1.4`. |
| Light palette | Background `#23252b`, text `#f2f3f5`, 1px `rgba(255,255,255,0.08)` border, radius 7px, shadow `0 6px 20px rgba(0,0,0,0.28)`. |
| Dark palette (`@media (prefers-color-scheme: dark)`) | Background `#303338`, text `#f2f3f5`, border `rgba(255,255,255,0.1)`, shadow `0 6px 20px rgba(0,0,0,0.5)`. |
| Animation | Opacity and transform transition of 0.18 s ease. The `.folio-toast-show` class is the visible state. |
| Timing (`showToast`) | Visible for 1600 ms, then the class is removed; 220 ms later `hidden` is set. A new message clears both timers and restarts the fade-in through a forced reflow. |
| Content | Plain text through `textContent`. Empty or missing text is ignored. |

**Producers**:

- The main process, through `{ name: 'toast', text }`: "Path copied to clipboard" and "Save the document first to copy its path".
- The renderer: "Switch to Source mode (Ctrl/Cmd+/) to format text".

The toast is Folio chrome. Typora themes are not expected to style it, and it loads with `app.css` before the theme layers.

## 2. Line-number gutter (source editor)

**DOM**: CodeMirror's `lineNumbers()` extension renders the gutter inside the editor, which stays mounted under `#typora-source` and keeps the legacy `.CodeMirror` class. Its structure is `.cm-editor.CodeMirror > .cm-scroller > .cm-gutters > .cm-gutter.cm-lineNumbers > .cm-gutterElement`. The gutter is present only while the preference is on, through `lineNumbersCompartment`.

**Styling rules in `src/renderer/app.css`**:

| Selector | Declarations | Origin |
|---|---|---|
| `#typora-source .cm-gutters` | `background: transparent; border: none;` | Earlier rule; it makes the gutter blend into the theme page |
| `#typora-source .cm-lineNumbers .cm-gutterElement` | `color: currentColor; opacity: 0.38; padding: 0 8px 0 12px;` | This feature |
| `#typora-source .cm-activeLineGutter` | `background: transparent; opacity: 0.7;` | This feature; inert because `highlightActiveLineGutter()` is not enabled (research.md, finding 5) |

**Typora compatibility**:

- Bundled and Typora themes style CodeMirror 5's `#typora-source .CodeMirror-gutters`, which the CodeMirror 6 editor does not emit, so these rules are the effective styling.
- Because `app.css` loads before the `folio-theme` layers, a theme that targets the CodeMirror 6 classes can still override them.
- The rules do not touch `#write`, the `.CodeMirror` root class, `typora-sourceview-on` or the theme layer order.

**Known effect**: `currentColor` resolves to the editor's built-in gutter grey (`#6c6c6c`), not the theme's text color, so the numbers look the same in Light and Dark appearance (research.md, finding 5).
