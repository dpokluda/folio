# Contract: Code-Fence Copy Button

**Scope**: The copy-to-clipboard button added to rendered code fences in `#write` (`1ce68e0`). Implemented by `addCopyButtons()`, `addCopyButton()`, `flashCopyButton()` and `setCopyButtonLabel()` in `src/renderer/renderer.js`, plus the `.folio-copy` rules in `src/renderer/app.css`.

## 1. Which blocks get a button

| Block | Button? | Why |
| ----- | ------- | --- |
| `#write pre.md-fences` whose `code` (or the `pre` itself) has non-blank `textContent` | Yes | Swept by `addCopyButtons()` right after the sanitized HTML is injected |
| The fallback `pre.md-fences` of a diagram that failed to draw | Yes | Added explicitly by `renderMermaidError()` because it is created after the sweep |
| Fence with empty or whitespace-only content | No | "Nothing worth copying" |
| Successfully drawn diagram | No | It is a `div.folio-mermaid`, not a `pre.md-fences` |
| Indented code block (`<pre><code>` without `md-fences`), front-matter box (`pre.md-front-matter`), inline code | No | Not matched by the selector |

Adding a button is idempotent: a `pre` that already has a `:scope > .folio-copy` child is skipped.

## 2. Markup

```html
<pre class="md-fences">
  <code class="cm-s-inner language-js">…</code>
  <button type="button" class="folio-copy" title="Copy code" aria-label="Copy code" contenteditable="false">
    <svg viewBox="0 0 16 16" aria-hidden="true">…</svg>
  </button>
</pre>
```

- The button is the **last child of the `pre`**, after the `code` element. It contains **no text** (icon only), so find-in-document, the outline builder and text selections never pick up a "Copy" label.
- `contenteditable="false"` and `user-select: none` keep it out of editing and selection.

## 3. Interaction

| Input | Result |
| ----- | ------ |
| Pointer enters the fence | Button fades in (`opacity` 0 → 1, 0.12 s transition) |
| Pointer leaves the fence | Button fades out unless it is in a confirmation state |
| `Tab` / `Shift+Tab` | The native button is in the tab order. `:focus-visible` reveals it. |
| Click, `Enter` or `Space` | `preventDefault()`, `stopPropagation()`, then `navigator.clipboard.writeText(text)` |

**Clipboard payload**: `code.textContent.replace(/\n$/, '')`. This is plain text exactly as written in the document, without highlight markup and without the single trailing newline every fence ends with. Intentional trailing blank lines are kept.

## 4. States and timing

| State | Icon | Label (`title` + `aria-label`) | Class | Light colour | Dark colour |
| ----- | ---- | ------------------------------ | ----- | ------------ | ----------- |
| idle | copy | `Copy code` | — | `#57606a` (hover `#24292f`) on `rgba(246,248,250,0.94)` | `#8b949e` (hover `#e6edf3`) on `rgba(28,31,36,0.94)` |
| done | check | `Copied` | `folio-copy-done` | `#1a7f37` | `#3fb950` |
| failed | copy | `Copy failed` | `folio-copy-failed` | `#b31d28` | `#f85149` |

- `done` and `failed` are pinned visible (`opacity: 1`) for **1400 ms**, then revert to `idle`.
- Each button has its own timer, kept in a `WeakMap`, so several fences can confirm at once. Activating the same button again restarts its timer.

## 5. Layout

- `#write pre.md-fences { position: relative; }` makes the fence the containing block. Themes do not position `.md-fences`, and fences do not scroll, so no wrapper element is needed.
- `#write .folio-copy`: `position: absolute; top: 6px; right: 6px; z-index: 2;`, 26×26 px, 6 px radius, 1 px border, 14×14 px icon.

## 6. Print / PDF

```css
@media print { #write .folio-copy { display: none; } }
```

Export to PDF prints the live preview, so the button is removed from every printed or exported page.

## 7. Guarantees

- No new IPC: the clipboard write happens in the renderer.
- The button never changes document text or dirty state.
