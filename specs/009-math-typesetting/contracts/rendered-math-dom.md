# Contract: Rendered Math DOM, Sanitization and Styling

**Feature**: [spec.md](../spec.md) | **Introduced**: `68e67be` (2026-07-16) | **Code**: `renderPreview()` in `src/renderer/renderer.js`, `src/renderer/index.html`, generated `src/renderer/katex/katex.min.css`

This contract fixes where math enters the page, what markup it produces inside `#write`, what the sanitizer keeps, and which styling hooks themes can rely on. It extends the Typora DOM contract of [001](../../001-markdown-viewer-editor/spec.md) and the layer order of [004](../../004-three-axis-theming/spec.md) without changing either.

## 1. Position in the render pipeline

`renderPreview()` runs these steps in order:

1. `splitFrontMatter(currentText())` separates YAML front matter.
2. `md.render(body, env)`: math tokens become KaTeX HTML strings **synchronously**, in document order.
3. The front-matter box is prepended.
4. `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })` filters the whole page, math included.
5. `$write.innerHTML = …` injects the result into `#write`.
6. Post-render passes: `renderMermaidBlocks()` (diagram placeholders only; added in `1ce68e0`), `addCopyButtons()` (`pre.md-fences` only), `hideLinkHint()`, `resolveLocalAssets()` (`img[src]` only), `wireLinks()` (`a[href]` only), `buildOutline()`, `updateStats()`, and `runFind()` when the find bar is open.

Math is never modified after step 5. In `68e67be` step 6 was the same list without the Mermaid and copy-button passes.

## 2. Markup produced (before sanitizing)

Inline formula:

```html
<span class="katex">
  <span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow>…</mrow><annotation encoding="application/x-tex">TeX source</annotation></semantics></math></span>
  <span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:…;vertical-align:…"></span>…</span></span>
</span>
```

Display equation (block form, or a `$$…$$` pair in text):

```html
<p class="katex-block"><span class="katex-display"><span class="katex">…</span></span></p>
```

An inline formula with a display-only environment produces `<span class="katex-display">…</span>` inside the paragraph, without the `<p class="katex-block">` wrapper.

Errors. A `ParseError` with `throwOnError: false` is rendered by KaTeX itself:

```html
<span class="katex-error" title="ParseError: KaTeX parse error: …" style="color:#cc0000">TeX source</span>
```

Any other exception is caught by the plugin, which emits (inline, then block form):

```html
<span class="katex-error" title="TeX source">exception text</span>
<p class="katex-block katex-error" title="TeX source">exception text</p>
```

Unknown or refused commands are drawn as red (`#cc0000`) text nodes inside an otherwise normal `.katex` fragment. Stretchy symbols (wide accents, long arrows, some root signs) use inline `<svg>` with `<path>` or `<line>` elements inside `.katex-html`.

## 3. Sanitization guarantees (DOMPurify defaults plus `ADD_ATTR: ['target']`)

| Part of the KaTeX output | After sanitizing |
|---|---|
| `span` elements with `class`, `style`, `title`, `aria-hidden` | Kept: this is the entire visible layer. |
| `svg`, `path`, `line` with `viewBox`, `preserveAspectRatio`, `d`, `width`, `height` | Kept. |
| MathML presentation elements (`math`, `mrow`, `mi`, `mn`, `mo`, `msup`, `msub`, `mfrac`, `msqrt`, `mroot`, `mtable`, `mtr`, `mtd`, `mtext`, `mspace`, `mstyle`, `mover`, `munder`, `mpadded`, `menclose`, …) | Kept (DOMPurify's default MathML allowlist). |
| `semantics`, `annotation` | Removed. Their content is kept (`KEEP_CONTENT`), so the raw TeX of the annotation remains as a plain text node inside the visually hidden `<math>`. |
| Links, images, event handlers, scripts | Never produced: KaTeX `trust` is off (see [math-syntax.md](./math-syntax.md) §5), and the sanitizer would remove them anyway. |

**Invariant**: any future change to the sanitizer configuration MUST keep `span` with `class`/`style`/`aria-hidden`/`title`, plus `svg`/`path`/`line` with their geometry attributes, or math layout breaks. Math MUST stay inside the sanitized string; it MUST NOT be moved to a post-sanitization pass the way Mermaid diagrams are.

## 4. Styling hooks and colour

- **Stylesheet order in `<head>`**: `app.css`, then `katex/katex.min.css`, then the runtime theme layers (`themes/base.css`, the family overlay, the page-width overlay). Theme rules win at equal specificity.
- **Size**: `.katex { font: normal 1.21em KaTeX_Main, Times New Roman, serif; line-height: 1.2 }`, relative to the surrounding text, so formulas follow the theme's body size and Folio's zoom (CSS `zoom` on `#folio-root`).
- **Colour**: no colour is declared. `.katex * { border-color: currentColor }` and `.katex svg { fill: currentColor; stroke: currentColor }`, so glyphs, fraction bars, root signs and SVG shapes inherit the theme's `color` in Light, Dark and System appearance. No re-render is needed when the appearance changes.
- **Hidden accessible copy**: `.katex .katex-mathml` is clipped to 1px (`clip-path: inset(50%)`, absolutely positioned).
- **Display layout**: `.katex-display { display: block; margin: 1em 0; text-align: center }` and `.katex-display > .katex { white-space: nowrap }`. Equations never wrap, and because `#folio-preview` has `overflow-x: hidden` and Folio adds no math overflow rule, wide equations are clipped at the window edge.
- **Error colour**: `#cc0000`, set inline by KaTeX. It is the same in every appearance and can only be overridden with `!important`.
- **Theme selectors available**: `#write .katex`, `#write .katex-display`, `#write .katex-block`, `#write .katex-error`. None of the bundled themes uses them. Typora's MathJax-editor selectors in `themes/base.css` (`.mathjax-block`, `.md-mathjax-midline`) never match Folio's output.
- **Print/PDF**: there are no math-specific `@media print` rules. `printToPDF` (`printBackground: true`) prints the same styled DOM.

## 5. Other features that read the rendered DOM

| Consumer (owner) | Behavior with math |
|---|---|
| `buildOutline()`, `assignHeadingIds()`, `scrollToAnchor()` ([001](../../001-markdown-viewer-editor/spec.md)) | Use `textContent`: a heading with math yields an outline label and anchor slug containing the formula's characters twice plus raw TeX. |
| In-preview Find, `findRangesIn()` ([006](../../006-find-in-document-and-files/spec.md)) | Walks every text node, including the hidden MathML copy, so matches inside formulas can be counted twice, one of them invisible. |
| `addCopyButtons()` ([010](../../010-mermaid-diagrams-code-blocks/spec.md)) | Only `pre.md-fences`; math is unaffected. |
| `wireLinks()` ([005](../../005-folder-mode-navigation/spec.md)) | Only `a[href]`; math never produces links. |
| `resolveLocalAssets()` ([001](../../001-markdown-viewer-editor/spec.md)) | Only `img[src]`; math never produces images. |
| `updateStats()` ([001](../../001-markdown-viewer-editor/spec.md)) | Counts the source text, so TeX counts as words and characters. |
