# Contract: Code-Fence Highlighting (Typora DOM and theming contract)

**Scope**: The markup that rendered code fences emit and how themes colour it (`5c3ee89`). It covers `highlightFence()` and the language table in `src/renderer/highlight.js`, the markdown-it `highlight` hook in `src/renderer/renderer.js`, the fence rules in `src/renderer/app.css`, and the inner-code reset in `themes/base.css`. This is the code-fence clause of constitution Principle I.

## 1. Fence markup

Illustrative example; the exact spans depend on what the language mode returns:

```html
<pre class="md-fences"><code class="cm-s-inner language-js"><span class="cm-keyword">function</span> <span class="cm-def">greet</span>(<span class="cm-def">name</span>) {…}</code></pre>
```

| Part | Rule |
| ---- | ---- |
| `pre.md-fences` | Same as Typora's fence container; unchanged since [001](../../001-markdown-viewer-editor/spec.md) |
| `code.cm-s-inner` | The CodeMirror theme class Typora's fence editor carries. Always present, with or without a language. |
| `language-<word>` | First word of the info string, as written (case kept), HTML-escaped. Omitted when the fence has no info string. |
| `<span class="cm-…">` | One span per styled token; unstyled text is emitted bare. Every character is escaped (`&`, `<`, `>`, `"`). |
| Line breaks | Kept as `\n` inside `code`. No per-line elements. |

Before `5c3ee89` the markup was `<pre class="md-fences hljs"><code class="hljs language-…">` with `.hljs-*` spans.

## 2. Language resolution

- **Key**: `info.trim().split(/\s+/)[0].toLowerCase()`, looked up as an own property of `MODES`.
- **Unknown key, `php`, no info string, or a mode that throws**: the code is emitted escaped with no spans (plain text). A throwing mode is logged as `[folio] highlight failed for language`.
- `mermaid` fences never reach the highlighter (see [mermaid-diagrams.md](./mermaid-diagrams.md)).

| Group | Info-string names (→ mode) |
| ----- | -------------------------- |
| C family | `c` `h` (C) · `cpp` `c++` `cc` `cxx` `hpp` `hxx` · `cs` `csharp` `c#` · `java` · `kotlin` `kt` · `scala` · `dart` · `objc` `objective-c` · `objcpp` `objective-c++` · `glsl` `hlsl` `shader` |
| Web | `js` `javascript` `mjs` `cjs` `node` `jsx` · `ts` `typescript` `tsx` · `json` `json5` `jsonc` · `jsonld` · `css` · `scss` · `less` · `sass` · `stylus` `styl` · `html` `htm` `xhtml` `vue` `svelte` · `xml` `xsl` `xsd` `svg` `rss` `plist` · `pug` `jade` |
| Scripting | `py` `python` `python3` · `cython` `pyx` · `rb` `ruby` · `perl` `pl` · `lua` · `coffee` `coffeescript` · `ps1` `powershell` `pwsh` · `sh` `bash` `zsh` `shell` `console` `terminal` · `php` → **plain text** |
| Systems / compiled | `go` `golang` · `rust` `rs` · `swift` · `haxe` `hx` · `fortran` `f90` · `pascal` `delphi` `pas` · `vb` `vbnet` · `verilog` `sv` `systemverilog` · `vhdl` · `wast` `wat` `wasm` · `cobol` |
| Functional | `haskell` `hs` · `erlang` `erl` · `elm` · `clojure` `clj` `cljs` `edn` · `scheme` `scm` · `lisp` `commonlisp` `cl` · `fsharp` `fs` `f#` · `ocaml` `ml` · `sml` · `smalltalk` `st` |
| Data / config / query | `yaml` `yml` · `toml` · `ini` `properties` `cfg` `conf` · `sql` · `mysql` · `postgres` `postgresql` `pgsql` · `mssql` `tsql` · `sqlite` · `plsql` · `sparql` · `turtle` `ttl` · `proto` `protobuf` · `webidl` `idl` |
| Tooling / misc | `dockerfile` `docker` · `diff` `patch` · `http` · `nginx` · `cmake` · `groovy` `gradle` · `r` · `julia` `jl` · `octave` `matlab` · `crystal` `cr` · `tcl` · `gherkin` `feature` `cucumber` · `jinja2` `jinja` `j2` · `latex` `tex` `stex` |

Totals: 170 keys, of which 169 highlight, resolving to 78 distinct CodeMirror 5 modes from 55 `@codemirror/legacy-modes/mode/*` files.

## 3. Token class vocabulary

Classes are CodeMirror 5 token names prefixed with `cm-`, one per space-separated part of the mode's style (for example `"variable callee"` → `cm-variable cm-callee`). Typical classes are `cm-keyword`, `cm-atom`, `cm-number`, `cm-def`, `cm-variable`, `cm-variable-2`, `cm-variable-3`, `cm-type`, `cm-property`, `cm-operator`, `cm-comment`, `cm-string`, `cm-string-2`, `cm-meta`, `cm-qualifier`, `cm-builtin`, `cm-bracket`, `cm-tag`, `cm-attribute`, `cm-header`, `cm-quote`, `cm-link`, `cm-positive`, `cm-negative`, `cm-error`, `cm-em` and `cm-strong`.

Modes that return Lezer-style names are folded onto this vocabulary by `TOKEN_ALIASES` (63 entries, for example `variableName.local` → `variable-2`, `typeName` → `variable-3`, `angleBracket` → `bracket`, `deleted` → `negative`, `punctuation` → no span). A name is never emitted if it contains a dot or is otherwise not a valid class name.

## 4. Colour sources (in cascade order)

1. **Theme rules**: the theme's own `.cm-*` rules. `themes/base.css` maps `cm-keyword`, `cm-variable`, `cm-tag`, `cm-variable-2/3`, `cm-def`, `cm-attribute`, `cm-comment`, `cm-string`, `cm-link`, `cm-type`, `cm-property`, `cm-operator`, `cm-number`, `cm-meta`, `cm-builtin` and `cm-atom` to the `--color-cm-*` palette (`keyword`, `attr`, `comment`, `string`, `operator`, `number`, `meta`, `builtin`, `v3`, `v`, `link`), with light values and dark overrides under `prefers-color-scheme: dark`. GitHub and Microsoft Word reuse this palette.
2. **Folio fallback**: `src/renderer/app.css`, scoped to the fence so it cannot reach the source editor. It covers the classes Typora's core stylesheet, not the theme, colours:

| Selector | Declaration |
| -------- | ----------- |
| `#write .md-fences .cm-string-2` | `color: var(--color-cm-builtin, #e36209)` |
| `#write .md-fences .cm-qualifier` | `color: var(--color-cm-attr, #9c27b0)` |
| `#write .md-fences .cm-bracket` | `color: var(--color-cm-comment, #6a737d)` |
| `#write .md-fences .cm-quote` | `color: var(--color-cm-string, #0d904f)` |
| `#write .md-fences .cm-positive` | `color: var(--color-cm-string, #0d904f)` |
| `#write .md-fences .cm-negative` | `color: var(--color-cm-v, #c53929)` |
| `#write .md-fences .cm-error` | `color: var(--color-cm-v, #c53929)` |
| `#write .md-fences .cm-em` | `font-style: italic` |
| `#write .md-fences .cm-strong` | `font-weight: 700` |

Folio defines no fixed light or dark token palette of its own any more. Code colours follow Style and Appearance through the theme variables.

## 5. Size and box rules

| Rule | File | Purpose |
| ---- | ---- | ------- |
| `#write .md-fences > code, #write .md-fences > tt { font-size: inherit; }` | `src/renderer/app.css` | Stops theme font sizes such as `.md-fences, code, tt { font-size: 0.9em }` or GitHub's `85%` from compounding on the inner `code`, which would otherwise give 0.81em or 0.72em. It deliberately outranks theme rules. |
| `.md-fences code, .md-fences tt { border: 0; background-color: transparent; padding: 0; border-radius: 0; }` | `themes/base.css` | Inner-code reset. `5c3ee89` dropped the obsolete `.md-fences .hljs` selector from it. |

## 6. Guarantees for theme authors

- An unmodified Typora theme that colours `.cm-*` (optionally under `.cm-s-inner`) colours Folio's fences the same way it colours Typora's.
- Fence colouring never applies to the source editor (`#typora-source`), which keeps its own highlight style.
