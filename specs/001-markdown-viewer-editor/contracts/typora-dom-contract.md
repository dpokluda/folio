# Contract: Typora DOM & Theming Surface

**Feature**: [001 spec](../spec.md) | **Source**: `src/renderer/index.html`, `src/renderer/renderer.js` (`renderPreview`, `createEditor`, `setSourceMode`, `applyTheme`, `applyZoom`), `src/renderer/app.css`, `src/main.js` (`disable-lcd-text`)

Typora themes are third-party CSS that Folio cannot test exhaustively, so the structure below is a
public interface (constitution Principle I). Breaking it breaks themes silently.

## 1. Document skeleton (`src/renderer/index.html`)

```html
<body>                                      <!-- .typora-sourceview-on while source mode is active -->
  <div id="folio-root">                     <!-- zoom target -->
    <!-- <aside id="folio-files"> … (005) -->
    <aside id="folio-outline" hidden aria-label="Document outline">
      <div class="folio-outline-title">Outline</div>
      <nav id="folio-outline-list"></nav>
    </aside>
    <main id="folio-main">                  <!-- column: content above, status bar below (578e52e) -->
      <div id="folio-content">
        <div id="folio-preview" class="folio-scroll">
          <div id="write"></div>            <!-- Typora page container -->
        </div>
        <div id="typora-source" hidden></div> <!-- Typora source-mode host -->
        <!-- find bar (006), link hint (005), toast (008) -->
      </div>
      <footer id="folio-statusbar"> … </footer>
    </main>
  </div>
  <script src="bundle.js"></script>
</body>
```

## 2. Theme-facing rules (MUST)

| # | Rule | Implementation |
|---|---|---|
| T1 | Rendered Markdown is injected into `#write`, and the theme styles `#write` as the page. | `renderPreview()` sets `$write.innerHTML` to the sanitized HTML. The `#folio-preview` scroller is transparent, so the theme's backdrop shows and `#write` centers through the theme's own `margin: auto`. |
| T2 | The source editor mounts under `#typora-source` and its root carries `CodeMirror`. | `new EditorView({ parent: $source })` with `EditorView.editorAttributes.of({ class: 'CodeMirror' })`. `app.css` makes `.cm-editor` and `.cm-gutters` transparent and flattens `.cm-activeLine`, so the theme's `#typora-source .CodeMirror*` rules decide the look. |
| T3 | `<body>` carries `typora-sourceview-on` while source mode is active, and only then. | `document.body.classList.toggle('typora-sourceview-on', on)` in `setSourceMode()`. |
| T4 | Folio's chrome loads before the theme, so the theme wins on shared selectors. | `<link rel="stylesheet" href="app.css">` comes first. 001: a single `<link id="theme-style">` whose `href` is `themesBaseUrl + file`. Since 004: ordered `<link class="folio-theme">` layers appended to `<head>`. 009 inserts `katex/katex.min.css` between them. |
| T5 | The page backdrop comes from the theme. | `html, body { background-color: var(--bg-color, #ffffff); }` (`578e52e`), with the window's own `backgroundColor` set to `#ffffff`. |
| T6 | Fences use Typora's fence class. | `<pre class="md-fences"><code …>`. At 001: `class="md-fences hljs"` and `<code class="hljs language-<lang>">` with `.hljs-*` token spans colored by `app.css`. Since `5c3ee89`: `<code class="cm-s-inner language-<lang>">` with Typora's `.cm-*` tokens (010). |

## 3. Elements this feature emits inside `#write`

| Source | Output |
|---|---|
| Leading front matter | `<pre class="md-front-matter">…escaped text…</pre>` as the first child (`abc8522`). Styled by `#write .md-front-matter` in `app.css`, with a dark variant. |
| Headings | `h1`–`h6`. The outline assigns their `id`s: `<slug>-<index>` at 001, GitHub-style deduplicated slugs since `e2e2877` (005). |
| Relative images | After sanitization, `img[src]` values without a scheme are rewritten to absolute `file://` URLs against `baseUrl` (`resolveLocalAssets()`, `6bf8c90`). |
| Task lists, footnotes, emoji, tables | Standard output of markdown-it and its plugins (for example `li.task-list-item` with a checkbox `input`, a footnote reference plus a footnotes section), which the themes already style. |

## 4. Folio-owned chrome (not a theme surface)

`#folio-root`, `#folio-main`, `#folio-content`, `#folio-preview`, `.folio-scroll`, `#folio-outline`,
`.folio-outline-title`, `#folio-outline-list`, `.outline-item`, `.outline-h1` … `.outline-h6`,
`#folio-statusbar`, `.folio-status-group`, `.folio-status-btn` (`.active`), `.folio-ico`,
`#btn-outline`, `#btn-source`, `#btn-source-label`, `#folio-stats`, `.folio-stat`, `.folio-stat-sep`.

These are styled only by `src/renderer/app.css`, in neutral light chrome at 001. Their dark variants
arrived with 004 under `@media (prefers-color-scheme: dark)`. Themes are not expected to target them.

## 5. Zoom hooks (`664668d`)

- `applyZoom()` sets `#folio-root.style.zoom = factor` and the custom property `--folio-zoom: factor`.
- `#folio-root` MUST size with `height: 100%`, never viewport units, because CSS `zoom` scales
  `vh`/`vw`. Styles inside the zoomed subtree that need window-relative sizes divide by
  `var(--folio-zoom, 1)`, as in `#typora-source .cm-content { padding-bottom: calc(40vh / var(--folio-zoom, 1)) }`.

## 6. Content-Security-Policy (`<meta http-equiv>` in `src/renderer/index.html`)

| Since | Policy |
|---|---|
| `bd8f5ef` | `default-src 'self' 'unsafe-inline' file: data: blob:; img-src 'self' file: data: https: blob:; font-src 'self' file: data:; style-src 'self' 'unsafe-inline' file:; script-src 'self' 'unsafe-inline';` |
| `8062af5` (current) | `default-src 'self' file: data: blob:; img-src 'self' file: data: https: blob:; font-src 'self' file: data:; style-src 'self' 'unsafe-inline' file:; script-src 'self';` |

What the current policy means:

- No inline or remote scripts, so only `bundle.js` runs.
- Themes may load stylesheets, fonts and images from `file:` and `data:`.
- Remote images load only over `https:`, and remote fonts never load.
- Inline styles stay allowed, because the editor injects its own styles.

## 7. Sanitization and post-processing order (`renderPreview()`)

1. `splitFrontMatter()`, then `md.render(body)`, with the front-matter `<pre>` prepended.
2. `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })`, then `$write.innerHTML = …` (`8062af5`).
3. Post-sanitize DOM work. The steps in **bold** belong to 001; the others are owned elsewhere:
   diagrams (010) → copy buttons (010) → link hint reset (005) → **`resolveLocalAssets()`** →
   **`wireLinks()`** → **`buildOutline()`** → **`updateStats()`** → re-run find (006).

## 8. Text rendering (process level)

`app.commandLine.appendSwitch('disable-lcd-text')` runs at the top of `src/main.js`, before the app is
ready (`5c3ee89`). It gives grayscale antialiasing on every platform, matching Typora's core
stylesheet. No CSS weight compensation is used; the `#write { -webkit-text-stroke: 0.15px }` rule from
`946b5a4` was removed.
