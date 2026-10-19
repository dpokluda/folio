# Research: Math Typesetting (TeX)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-16 (reconstructed 2026-10-18)

Decisions are mined from the code comments and the diff of `68e67be`, the installed plugin (`@vscode/markdown-it-katex` 1.1.2: README, `types.d.ts`, `dist/index.js`), the generated `src/renderer/katex/katex.min.css`, and DOMPurify's published allowlists for the locked version (3.4.11). Every Technical Context item was resolved from these sources; nothing was left open.

### 1. Typesetting engine: KaTeX

**Decision**: Typeset with KaTeX 0.16.47 through its synchronous `renderToString`, called while Markdown is rendered, with KaTeX's default HTML+MathML output.

**Rationale**: The comment in `src/renderer/renderer.js` states the intent: "rendered to HTML+MathML by KaTeX". Because `renderToString` is synchronous, formulas are complete inside the string returned by `md.render()`: they pass through the existing sanitizer and are on the page before anything paints or prints. Mermaid, added later in `1ce68e0`, renders asynchronously after sanitization and needed `whenMermaidSettled()` before PDF export; math never did. KaTeX ships its stylesheet and fonts inside the npm package, which makes self-hosting a file copy (entry 7). It is MIT-licensed, and README credits it for math typesetting.

**Alternatives considered**: MathJax, which Typora itself uses. It typesets the live DOM asynchronously after insertion, so it would need a post-sanitization pass and a settle step before PDF export, and it is the heavier dependency. The `$…$` / `$$…$$` syntax is the same, so documents stay portable between the two apps. Rendering to images or through a web service was ruled out by the offline requirement (Principle VI).

### 2. Markdown integration: `@vscode/markdown-it-katex`

**Decision**: Use `@vscode/markdown-it-katex` 1.1.2, registered last in the plugin chain: `.use(taskLists, …).use(footnote).use(emojiPlugin).use(katexPlugin, { throwOnError: false })`.

**Rationale**: README credits KaTeX "via @vscode/markdown-it-katex"; the plugin README says it is what VS Code uses to render math in Markdown, so a document previews the same way in both tools. It adds its inline rules right after markdown-it's `escape` rule (so `\$` is already a literal when math is considered) and its block rule after `blockquote` with `alt: ['paragraph', 'reference', 'blockquote', 'list']` (so `$$` blocks work inside lists and quotes and can interrupt a paragraph). It accepts KaTeX options, and its `katex ^0.16.4` requirement deduplicates with Folio's direct `katex` dependency: the lockfile holds a single `node_modules/katex` (0.16.47), so the stylesheet and fonts copied by `build.js` always match the code that typesets.

**Alternatives considered**: The upstream it was forked from (`@iktakahiro/markdown-it-katex`, per the plugin README), which is not the variant VS Code ships; plugins with more delimiter styles than README promises; hand-written markdown-it rules, which would be more code to maintain for the same result (Principle VI prefers small, well-used dependencies or small in-repo modules).

### 3. Error presentation: `throwOnError: false`

**Decision**: Pass `{ throwOnError: false }` and keep KaTeX's default `errorColor` (`#cc0000`).

**Rationale**: The renderer comment: "throwOnError:false shows the offending source in red instead of aborting the whole render on a typo." With the option off, KaTeX renders a parse error as `<span class="katex-error" title="ParseError: KaTeX parse error: …" style="color:#cc0000">` holding the formula's source, and renders an undefined control sequence as red text inside an otherwise typeset formula. Each formula is a separate `renderToString` call, so any failure is confined to that formula (spec FR-009, FR-010).

**Alternatives considered**: KaTeX's default `throwOnError: true`. With plugin 1.1.2 the plugin's own `try/catch` would still contain the failure, but the page would show the exception text (`ParseError: KaTeX parse error: …`) in the normal text colour instead of the source, plus a console log; the source is more useful for fixing a typo. A per-appearance `errorColor` was not configured (see Retroactive findings).

### 4. Delimiter rules and plugin options left at their defaults

**Decision**: Leave `enableBareBlocks`, `enableFencedBlocks`, `enableMathBlockInHtml` and `enableMathInlineInHtml` unset (off) and accept the plugin's delimiter rules.

**Rationale**: README promises exactly "inline `$…$` and display `$$…$$` TeX formulas". The plugin's inline rule opens only on a `$` that is not preceded by an ASCII letter, digit, underscore, `$` or `\`, and closes only on the next unescaped `$` when it is not followed by an ASCII letter, digit, underscore or `$`, so `$5 and $10` stays literal (the candidate closer is followed by a digit). With the HTML options off, `$` inside raw HTML blocks is never touched by math parsing. With fenced blocks off, a ```` ```math ```` fence remains an ordinary code block (highlighted and given a copy button by [010](../010-mermaid-diagrams-code-blocks/spec.md)). The exact grammar is in [contracts/math-syntax.md](./contracts/math-syntax.md).

**Alternatives considered**: GitHub-style ```` ```math ```` fences and bare `\begin…\end` environments, both available behind those flags, were not enabled. The plugin README describes pandoc rules (no space after the opener or before the closer), but the 1.1.2 code does not enforce the whitespace part, so `$ 5 and $ 10` pairs into a formula; this is documented in the contract rather than worked around.

### 5. Untrusted TeX: KaTeX `trust` and limits left at their defaults

**Decision**: Keep KaTeX's defaults `trust: false`, `maxExpand: 1000` and `strict: "warn"`, and load no contrib extensions (no `mhchem`, no `copy-tex`).

**Rationale**: Principle III treats every document as untrusted. With `trust` off, KaTeX refuses `\href`, `\url`, `\includegraphics`, `\htmlClass`, `\htmlId`, `\htmlStyle` and `\htmlData` and draws the command name in the error colour, so math cannot add links, images or page attributes. The expansion cap turns a self-referencing macro such as `\def\a{\a}\a` into a "Too many expansions" error instead of an endless loop, which applies Principle VI's "bounded work" rule to a single formula. `strict: "warn"` only logs LaTeX-compatibility warnings to the console.

**Alternatives considered**: A `trust` callback that allows `http(s)` links in formulas; not needed for the feature and it would widen the untrusted surface. Loading `mhchem` for chemistry notation; not requested.

### 6. Render order: typeset before sanitizing, and PDF prints the same DOM

**Decision**: Math is typeset inside `md.render(body, env)`; the combined HTML is sanitized once by `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })` and assigned to `$write.innerHTML` in `renderPreview()`. The DOMPurify allowlist is not changed. PDF export relies on the existing `prepare-export` request (leave source mode, which calls `renderPreview()`) followed by `webContents.printToPDF` in `doExportPDF()` (`src/main.js`).

**Rationale**: This keeps the single sanitize-then-inject path introduced in `8062af5` for all math output (Principle III). DOMPurify's default profile allows HTML, SVG and MathML elements and the `class`, `style`, `title` and `aria-*` attributes, so KaTeX's visible layer (`.katex-html`: spans with inline sizes, occasionally `<svg><path>`) survives intact. Because typesetting is synchronous, the page that `printToPDF` captures already contains every formula; in `68e67be` the `prepare-export` handler simply left source mode and returned `true`.

**Alternatives considered**: Rendering math after sanitization, as Mermaid later had to; unnecessary, because DOMPurify strips nothing from KaTeX's visible layer. Extending the allowlist to keep `<semantics>` and `<annotation>` in the hidden MathML copy; not done (see Retroactive findings).

### 7. Self-hosting KaTeX's stylesheet and fonts through a build-time copy

**Decision**: `copyKatexAssets()` in `build.js` copies `node_modules/katex/dist/katex.min.css` and `node_modules/katex/dist/fonts/*.woff2` into `src/renderer/katex/` at the start of every build run. The folder is git-ignored, and `src/renderer/index.html` links `katex/katex.min.css`.

**Rationale**: The `build.js` comment: "Vendor KaTeX's stylesheet + web fonts next to the bundle so math renders offline (no CDN, CSP-friendly). These are generated assets — like bundle.js they're gitignored and recreated on every build." Copying from the installed package keeps the stylesheet and fonts in lockstep with the KaTeX code in the bundle. The `url(fonts/…)` references inside `katex.min.css` resolve relative to the copied stylesheet, so no path rewriting is needed. Every script that builds the renderer (`build:renderer`, `watch:renderer`, `start`, `dist`, `dist:win`, `dist:mac`, `dist:linux`) runs the copy, and `build.files` `src/**/*` puts the folder into every package.

**Alternatives considered**: The CDN `<link>` shown in the plugin README, which breaks offline use and would need a CSP exception (Principles III and VI). Committing the stylesheet and fonts to the repository, which duplicates third-party binaries and can drift from the installed KaTeX version. Routing the CSS and fonts through esbuild loaders, which would complicate the single-IIFE bundle for no benefit.

### 8. Only `.woff2` fonts

**Decision**: Copy the 20 `.woff2` faces and skip the `.woff` and `.ttf` files.

**Rationale**: The `build.js` comment: "Only woff2 is copied: every modern Chromium (incl. the headless one used for PDF export) supports it, and katex.min.css always lists a woff2 source first, so woff/ttf are never fetched." Verified in the generated stylesheet: each of its 20 `@font-face` rules lists `woff2`, then `woff`, then `ttf`, with `font-display:block`. The copied fonts total about 296 KB on disk, and the stylesheet about 24 KB.

**Alternatives considered**: Copying all three formats (60 files instead of 20, for formats Chromium never requests). Inlining fonts as `data:` URIs (permitted by `font-src data:`), which would bloat the stylesheet.

### 9. Content-Security-Policy left unchanged

**Decision**: Leave the CSP in `src/renderer/index.html` as it was.

**Rationale**: `font-src 'self' file: data:` and `style-src 'self' 'unsafe-inline' file:` have been there since `bd8f5ef`, and `script-src 'self'` since `8062af5`. The copied stylesheet and fonts load from `file:` URLs inside the app directory, KaTeX positions glyphs with inline `style` attributes that `'unsafe-inline'` in `style-src` permits, and KaTeX's code runs inside `bundle.js`, so no script source is added. That is what "CSP-friendly" in the `build.js` comment refers to. This is the Gate 5 review for the CSP.

**Alternatives considered**: Allow-listing a CDN origin in `style-src` or `font-src` (rejected by Principles III and VI). Removing `'unsafe-inline'` from `style-src` would break KaTeX's layout, so [contracts/offline-assets-and-csp.md](./contracts/offline-assets-and-csp.md) records that directive as load-bearing for math.

### 10. Stylesheet order and Light/Dark behaviour

**Decision**: Link KaTeX's stylesheet after `app.css` and before the theme layers, add no Folio rules for `.katex`, and do not re-render math when the appearance changes.

**Rationale**: The `index.html` comments say app chrome is "loaded first so the theme wins on shared selectors" and that the theme stack is "appended here at runtime", which places it after KaTeX, so a Typora theme can restyle math if it wants to. None of the bundled themes does: `themes/base.css` only carries Typora's MathJax-editor selectors (`.mathjax-block`, `.md-mathjax-midline`), which never match KaTeX output. Verified in the generated `katex.min.css`: `.katex` sets a font (`1.21em KaTeX_Main`) but no colour, `.katex *` sets `border-color:currentColor`, and `.katex svg` sets `fill` and `stroke` to `currentColor`. Everything therefore follows the theme's text colour and scales with the text and with zoom, and `onAppearanceChanged` only has to redraw Mermaid diagrams (`refreshMermaid()`), never math.

**Alternatives considered**: Per-appearance math palettes in `src/renderer/app.css`; unnecessary because of `currentColor`.

## Retroactive findings

- **README ↔ code drift (minor)**: README's "Project layout" does not list the generated `src/renderer/katex/` folder and describes `build.js` only as "esbuild bundler for the renderer", although it also vendors the KaTeX stylesheet and fonts. The Features bullet ("rendered in the preview and included in PDF exports"), the Format-section sentence and the Acknowledgements entry match the code.
- **Undocumented behavior**: README says only "inline `$…$` and display `$$…$$`". It does not document the currency-safe delimiter rules and `\$` escaping, the red-source error display with the message on hover, the refusal of `\href`, `\includegraphics` and `\html…`, the automatic display style for inline `align`/`equation`/`gather`/`alignat`/`CD`, or that ```` ```math ```` fences, bare `\begin…\end` and math inside HTML blocks are not typeset. The bundled Markdown Formatting Tour (`samples/formatting-tour.md`) demonstrates diagrams but has no math example.
- **Comment accuracy**: (a) The `renderer.js` comment says `throwOnError:false` avoids "aborting the whole render on a typo"; with plugin 1.1.2 the plugin catches KaTeX exceptions either way, and the option decides what is shown (red source with a hover message instead of the exception text). (b) The `build.js` comment mentions "the headless one used for PDF export"; Folio exports with `webContents.printToPDF` on the document's own window, not a headless browser. The woff2-only conclusion still holds. (c) The plugin README describes pandoc whitespace rules that its 1.1.2 code does not enforce.
- **Known limitation, unterminated display blocks** (plugin 1.1.2, by code reading): a line that starts with `$$` and has text after its closing `$$` (even trailing spaces), or a `$$` block that is never closed, runs on to the next line containing `$$` or to the end of the container, and text sharing that closing line with `$$` can be dropped. It usually surfaces as one large red error.
- **Known limitation, sanitizer and MathML**: DOMPurify's default MathML allowlist (3.4.11 at the time) excludes `<semantics>` and `<annotation>`. When it removes them it keeps the annotation's text, so the visually hidden `.katex-mathml` copy ends up holding the raw TeX as plain text. Visible output is unaffected; assistive technology may read the TeX after the formula.
- **Known limitation, plain-text readers of the page** (by code reading): `buildOutline()` and `assignHeadingIds()` use the heading's `textContent`, so a heading with math gets an outline label and anchor slug containing the formula's characters twice plus raw TeX. In-preview Find (`findRangesIn()`, owned by [006](../006-find-in-document-and-files/spec.md)) walks every text node and can count invisible matches inside the hidden MathML copy.
- **Known limitation, wide equations**: `.katex-display>.katex` uses `white-space:nowrap`, Folio adds no `overflow-x` rule for math (unlike `#write .folio-mermaid`), and `#folio-preview` has `overflow-x: hidden`, so a display equation wider than the column is cut off at the window edge.
- **Known limitation, error colour in Dark**: `#cc0000` is fixed in both appearances. It has about 5.9:1 contrast on white but about 3.1:1 on the base theme's Dark background `#131416`, below the 4.5:1 guideline for body text. Formulas that set explicit colours (`\color{black}`) likewise ignore the appearance.
- **Known limitation, macros**: no shared `macros` object is passed to KaTeX, so `\def`, `\gdef` and `\newcommand` do not carry over from one formula to the next.
- **Attribution**: `git log -S katex` lists only `68e67be` and `1ce68e0`. The latter only added README bullets next to the math bullet and a lockfile entry where Mermaid also requires `katex ^0.16.45`, deduplicated to the same 0.16.47. `218bccc`'s dependency refresh left KaTeX at 0.16.47 and the plugin at 1.1.2.
