# Contract: Offline Math Assets, Packaging and CSP

**Feature**: [spec.md](../spec.md) | **Introduced**: `68e67be` (2026-07-16) | **Code**: `build.js`, `.gitignore`, `src/renderer/index.html`, `package.json`

This contract guarantees that math renders with its own fonts and styles on every platform without any network access, and records which build steps and Content-Security-Policy directives that guarantee depends on.

## 1. Build-time asset copy (`build.js`)

| Aspect | Contract |
|---|---|
| Function | `copyKatexAssets()`, called synchronously as the first statement of `run()`, before esbuild starts. |
| Sources | `node_modules/katex/dist/katex.min.css` and every file in `node_modules/katex/dist/fonts/` whose name ends in `.woff2`. |
| Destinations | `src/renderer/katex/katex.min.css` and `src/renderer/katex/fonts/<same name>`. `fonts/` is created with `mkdirSync(…, { recursive: true })`. |
| Result today | 1 stylesheet (≈24 KB) and 20 `KaTeX_*.woff2` faces (≈296 KB). |
| Log line | `[folio] KaTeX assets copied.` |
| Overwrite and cleanup | Files are overwritten on every run; nothing is deleted. |
| Failure | A missing `node_modules/katex/dist` throws, `run()` rejects, the error is printed, and the process exits with code 1, so the calling npm script stops. |

npm scripts that run the copy:

| Script | Runs `build.js` via | Copy happens |
|---|---|---|
| `npm run build:renderer` | `node build.js` | every run |
| `npm run watch:renderer` | `node build.js --watch` | once, at start (later esbuild rebuilds do not copy again) |
| `npm start` | `npm run build:renderer` | before Electron launches |
| `npm run dist`, `dist:win`, `dist:mac`, `dist:linux` | `npm run build:renderer` | before `clean:release` and electron-builder |

## 2. Version coupling

- `package.json` depends on `katex` ^0.16.47 directly, and `@vscode/markdown-it-katex` ^1.1.2 requires `katex` ^0.16.4. npm installs a single `node_modules/katex` (0.16.47 in the lockfile), so the typesetting code bundled into `bundle.js`, the stylesheet and the fonts always come from the same release. The copied stylesheet embeds the version string `0.16.47`.
- Mermaid, added later in `1ce68e0`, also requires `katex` ^0.16.45 and resolves to the same copy.
- Upgrading KaTeX therefore needs only `npm install` followed by any build; never edit the generated folder by hand.

## 3. Git and packaging

- `.gitignore` lists `src/renderer/katex/` under "# Build output", next to `src/renderer/bundle.js` and `src/renderer/bundle.js.map`. The folder MUST NOT be committed.
- `package.json` `build.files` includes `src/**/*`, so electron-builder packages the generated folder into every target: NSIS (Windows), DMG (macOS), AppImage and deb (Linux). The `!**/*.map` exclusion does not affect it.
- There is no runtime download and no CDN fallback. If the folder were missing, the typeset markup would have neither its stylesheet nor its fonts and formulas would display incorrectly, which is why every packaging script rebuilds the renderer first.

## 4. Document references (`src/renderer/index.html`)

Excerpt from `src/renderer/index.html` (`<head>`, indentation removed):

```html
<link rel="stylesheet" href="app.css" />
<!-- KaTeX math styling (self-hosted; fonts live in ./katex/fonts, copied at build time). -->
<link rel="stylesheet" href="katex/katex.min.css" />
<!-- The active Typora-compatible theme is a stack of <link class="folio-theme">
     elements appended here at runtime (base + family + width overlays). -->
```

The stylesheet refers to its fonts as `url(fonts/KaTeX_….woff2)` (followed by `.woff` and `.ttf` alternatives that are never requested), resolved relative to `katex/katex.min.css`, with `font-display: block`. A face is fetched only when a glyph needs it.

## 5. Content-Security-Policy relied upon (unchanged by this feature)

```text
default-src 'self' file: data: blob:; img-src 'self' file: data: https: blob:; font-src 'self' file: data:; style-src 'self' 'unsafe-inline' file:; script-src 'self';
```

| Directive | Why math needs it | Present since |
|---|---|---|
| `style-src 'self' file:` | Loads `katex/katex.min.css` from the app folder. | `bd8f5ef` |
| `style-src 'unsafe-inline'` | KaTeX sizes and positions glyphs with inline `style="height:…;vertical-align:…"` attributes, and sets the error colour inline. | `bd8f5ef` |
| `font-src 'self' file:` | Loads `katex/fonts/*.woff2`. | `bd8f5ef` |
| `script-src 'self'` | Unchanged; KaTeX's code is inside `bundle.js`, so no script source is added. | `8062af5` |

**Invariants**:

1. `style-src` MUST keep allowing inline style attributes (`'unsafe-inline'` today); removing it collapses KaTeX's layout.
2. `font-src` and `style-src` MUST keep `'self'`/`file:`; no remote origin may ever be added for math.
3. `copyKatexAssets()` MUST run before packaging, and its output MUST stay git-ignored.
4. The link order MUST stay `app.css`, then `katex/katex.min.css`, then the theme layers.

## 6. Network behavior

Rendering a document with math makes no HTTP(S) request: the stylesheet and fonts are `file:` resources, typesetting is local code in the bundle, and the commands that could fetch anything (`\includegraphics`, `\href`, `\url`) are refused because KaTeX `trust` is off.
