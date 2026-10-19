# Data Model: Math Typesetting (TeX)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Math introduces no persisted data. Its "data" is transient: formula tokens produced while a document is rendered, the HTML fragments they become, the fixed renderer configuration, and the generated asset set that ships with the app. Everything is recomputed from the current text on every render.

## 1. Formula token (parse time)

Produced by the plugin's parse rules during `md.render(body, env)` in `renderPreview()` (`src/renderer/renderer.js`). It lives for one render only.

| Field | Type | Values | Notes |
|---|---|---|---|
| `type` | string | `math_inline`, `math_block` | `math_inline` comes from `$…$`. `math_block` comes from a `$$` block at the start of a line **or** from a `$$…$$` pair inside a paragraph. `math_inline_bare_block` is never produced because bare blocks are disabled. |
| `markup` | string | `$` or `$$` | The delimiter used. |
| `content` | string | Raw TeX | The text between the delimiters, unescaped and untouched by typographic replacements. For a `$$` block: the rest of the opening line, the inner lines, and the text before `$$` on the closing line. |
| `block` | boolean | `true` for `math_block` | Display style. |
| `map` | `[startLine, endLine]` | Source line range | Set only for `$$` blocks that start a line. |

**Validation rules** (full grammar in [contracts/math-syntax.md](./contracts/math-syntax.md)):

- Inline opener: a `$` not immediately preceded by an ASCII letter, digit, underscore, `$` or `\`.
- Inline closer: the next `$` preceded by an even number of backslashes; valid only if not immediately followed by an ASCII letter, digit, underscore or `$`. If it is invalid, the opener becomes a literal `$` and scanning resumes right after it.
- Empty content (`$$` in text, `$$$$` inline) and a missing closer produce literal text, not a token.
- Inline content cannot cross a blank line, because inline parsing works one block at a time.
- Tokens are never created inside code spans that start first, fenced or indented code, raw HTML blocks, or ```` ```math ```` fences.

## 2. Typeset fragment (render time)

Each token is rendered by a separate `katex.renderToString()` call with `{ throwOnError: false, displayMode }`. The fragments are concatenated into the page HTML, which is then sanitized (see [contracts/rendered-math-dom.md](./contracts/rendered-math-dom.md)).

| Outcome | When | Markup before sanitizing |
|---|---|---|
| Inline formula | `math_inline`, typeset successfully | `<span class="katex"><span class="katex-mathml"><math>…</math></span><span class="katex-html" aria-hidden="true">…</span></span>` |
| Inline formula in display style | `math_inline` whose content matches `\begin{align\|equation\|gather\|cd\|alignat}` (case-insensitive) | `<span class="katex-display"><span class="katex">…</span></span>`, inline in the paragraph but laid out as a block |
| Display equation | `math_block`, typeset successfully | `<p class="katex-block"><span class="katex-display"><span class="katex">…</span></span></p>` |
| Parse error | KaTeX `ParseError` | `<span class="katex-error" title="ParseError: KaTeX parse error: …" style="color:#cc0000">` + TeX source + `</span>`; inside `<p class="katex-block">` for blocks |
| Flagged command | Undefined control sequence, or a command refused because `trust` is off | The command name drawn in `#cc0000` inside an otherwise normal `.katex` fragment |
| Internal error | Any other exception, caught by the plugin | `<span class="katex-error" title="TeX source">` + exception text + `</span>`, or `<p class="katex-block katex-error" title="…">…</p>` for blocks; no inline colour |

**State transitions** (per formula, per render):

```text
TeX source ──parse──► typeset
                 ├──► typeset with flagged command(s)
                 ├──► parse error (source shown in red, message in title)
                 └──► internal error (message shown, source in title)
```

No state carries over between formulas (each call gets a fresh macro table) or between renders. Fixing the TeX and rendering again moves a formula straight to "typeset".

## 3. Math renderer configuration

Fixed at module load on the shared `md` instance in `src/renderer/renderer.js`; not user-configurable and not persisted.

| Setting | Effective value | Source |
|---|---|---|
| Plugin order | after `taskLists`, `footnote`, `emojiPlugin` | `renderer.js` |
| `throwOnError` | `false` | explicit option |
| `enableBareBlocks`, `enableFencedBlocks`, `enableMathBlockInHtml`, `enableMathInlineInHtml` | unset (off) | plugin defaults |
| KaTeX instance | the plugin's own `katex` import, deduplicated to Folio's `katex` 0.16.47 | plugin default (no `katex` option passed) |
| `displayMode` | `true` for `$$`; `true` for inline content with a display-only environment; otherwise `false` | plugin |
| `output` | `htmlAndMathml` | KaTeX default |
| `errorColor` | `#cc0000` | KaTeX default |
| `trust` | `false` | KaTeX default |
| `maxExpand` | `1000` | KaTeX default |
| `strict` | `"warn"` (console only) | KaTeX default |
| `macros` | a fresh table per formula | KaTeX default (no shared object) |
| Host markdown-it options | `html: true`, `linkify: true`, `typographer: true`, `breaks: false` | `renderer.js`, owned by [001](../001-markdown-viewer-editor/spec.md) |

## 4. Math asset set (build output)

| Item | Path | Copied from | Count and size |
|---|---|---|---|
| Stylesheet | `src/renderer/katex/katex.min.css` | `node_modules/katex/dist/katex.min.css` | 1 file, ≈24 KB |
| Fonts | `src/renderer/katex/fonts/KaTeX_*.woff2` | `node_modules/katex/dist/fonts/*.woff2` | 20 files, ≈296 KB |

**Lifecycle**:

- **Created or overwritten** by `copyKatexAssets()`, the first step of `run()` in `build.js`: on every `npm run build:renderer` and therefore every `npm start` and `npm run dist*`, and once when `npm run watch:renderer` starts.
- **Never deleted** by the build: files from an older KaTeX version would linger until removed by hand. They are harmless, because the stylesheet only references the current names.
- **Excluded from git** by the `src/renderer/katex/` entry in `.gitignore`.
- **Packaged** through `build.files` `src/**/*` in `package.json`.
- **Loaded** by `<link rel="stylesheet" href="katex/katex.min.css" />` in `src/renderer/index.html`. Fonts are referenced as `url(fonts/…)` relative to the stylesheet, with `font-display:block`; the engine fetches a face only when glyphs need it.

**Validation**: if `node_modules/katex/dist` is missing (no `npm install`), `fs.copyFileSync` throws, `run()` rejects, and `build.js` logs the error and exits with code 1, so `npm start` and `npm run dist` stop before launching or packaging.

## 5. State this feature does not introduce

- No `folio-settings.json` keys. `DEFAULTS` in `src/store.js` is unchanged by math; the `lineNumbers` key added in the same commit belongs to [008](../008-source-editing-tools/spec.md).
- No `Session` fields in `src/main.js`, no renderer `state` fields, and no IPC channels.
- Rendering is a pure function of `currentText()`. It is re-run by the existing `renderPreview()` triggers: `loadDocument()` when not in source mode, `setSourceMode(false)` (which the `prepare-export` request also uses), `onDocumentPathChanged`, and `refreshMermaid()` after an appearance change, which only re-renders documents that contain diagrams. Math never requires its own re-render.
