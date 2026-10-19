# Research: Themed Markdown Viewer & Source Editor

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-09 (reconstructed 2026-10-18)

The Technical Context in plan.md has no open unknowns, because every decision below was already made
and shipped. The entries are mined from code comments in `src/` and from the messages
of the source commits (`bd8f5ef`, `578e52e`, `ec3e6f4`, `9c3abe5`, `946b5a4`, `6bf8c90`, `abc8522`,
`8062af5`, `664668d`, `5c3ee89`), plus the merge `ff19412` that reconciled two parallel implementations.

### 1. Mirror Typora's DOM contract instead of inventing page markup

- **Decision**: Inject the rendered HTML into `#write`, mount the source editor under `#typora-source`
  with the legacy `CodeMirror` class on its root, and toggle `typora-sourceview-on` on `<body>` while
  source mode is active. `src/renderer/app.css` loads before the theme, so the theme wins on shared
  selectors. At 001 the theme was a single `<link id="theme-style">` whose `href` was swapped. The
  Themes menu listed only the top-level `.css` files in `themes/` (`listThemes()`, non-recursive),
  title-cased by `titleCaseTheme()` (`fluent-a4.css` → "Fluent A4"), and the default was `fluent.css`.
- **Rationale**: README "Why Folio?" says the CSS themes the author already uses must "just work". The
  `bd8f5ef` message: "renders Markdown into Typora's #write container and edits source in a themed
  CodeMirror 6 pane under #typora-source, so Typora CSS themes style both preview and editor."
  Because the page is a full browser engine, theme `@import` chains, `@font-face` and window-width
  `@media` breakpoints work unchanged (README, theming contract).
- **Alternatives considered**: Selectable themes in subfolders. Rejected in favor of Typora's own rule
  (README at `bd8f5ef`: "lists only the top-level `.css` files … exactly like Typora. Subfolders … are
  treated as assets"). Folio-specific markup with ported themes would break the "unmodified themes"
  promise. The flat file list was later replaced by 004's ordered `link.folio-theme` layer stack.

### 2. Markdown engine: markdown-it with GitHub-flavored plugins, raw HTML on

- **Decision**: `new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false })` with
  `markdown-it-task-lists` (`{ enabled: true }`), `markdown-it-footnote` and the full
  `markdown-it-emoji` set. Fences are emitted as Typora's `<pre class="md-fences">`. At 001,
  highlight.js colored languages it recognized, and everything else was HTML-escaped. Token colors
  lived in `src/renderer/app.css` as a GitHub-light palette; a dark palette arrived with 004
  (`1f452ec`).
- **Rationale**: These plugins cover every construct the prompt lists. Reusing Typora's `md-fences`
  class lets each theme's code-block frame apply. `html: true` keeps the raw HTML that Markdown
  authors use (the Welcome document itself used `<div align="center">` and an inline SVG logo between
  `f96fc39` and `ec3e6f4`).
- **Alternatives considered**: Turning raw HTML off (`html: false`) would drop legitimate markup.
  Folio sanitizes instead (entry 5). highlight.js was later replaced by CodeMirror 5 modes from
  `@codemirror/legacy-modes` in `5c3ee89`, so that each theme's `--color-cm-*` palette colors the
  fences (010).

### 3. CodeMirror 6 source editor with a compatibility class and text hand-off

- **Decision**: Create one `EditorView` lazily, the first time source mode is entered, with `history`,
  `drawSelection`, `highlightSpecialChars`, `bracketMatching`, `highlightSelectionMatches`,
  `search({ top: true })`, `EditorView.lineWrapping`, `syntaxHighlighting(defaultHighlightStyle)`,
  `markdown()`, default, history and search keymaps plus `indentWithTab`, and
  `EditorView.editorAttributes.of({ class: 'CodeMirror' })`. Entering source mode copies `state.docText`
  into the editor and focuses it. Leaving copies the editor text back and calls `renderPreview()`.
  `app.css` makes `.cm-editor` transparent, centers `.cm-content` (900px maximum) and flattens the
  active line.
- **Rationale**: Typora's source mode is CodeMirror-based, so themes target `#typora-source
  .CodeMirror*`. The code comment reads "Legacy compat class so themes' `#typora-source .CodeMirror`
  rules apply". `app.css` mirrors "the themes' grey-bar-free source mode". Re-rendering only on a mode
  switch, never per keystroke, keeps typing cheap.
- **Alternatives considered**: No alternative editor is recorded in the commits. Making the rendered
  page editable (WYSIWYG) is out of scope under constitution Principle II.

### 4. A small JSON settings store instead of a dependency

- **Decision**: `src/store.js` writes `folio-settings.json` in `app.getPath('userData')`. It merges
  `DEFAULTS` with the parsed file (`window` merged one level deep), writes synchronously and
  pretty-printed on every `set()`, keeps the recent list most-recent-first with
  `MAX_RECENT = 10` (`addRecent`, `clearRecent`), and falls back to defaults if the file cannot be
  read.
- **Rationale**: Code comment: "Avoids an extra native/ESM dependency (electron-store is ESM-only in
  v9+)". The main process is CommonJS. Constitution Principle VI cites this module as the precedent
  for small in-repo modules.
- **Alternatives considered**: electron-store, rejected because it is ESM-only from v9.

### 5. Treat every document as untrusted (hardening in `8062af5`)

- **Decision**: Call `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })` immediately before writing
  `$write.innerHTML`; DOM rewrites such as image resolution run afterwards. The CSP drops
  `'unsafe-inline'` from `default-src` and `script-src`. `setWindowOpenHandler` denies every new window
  and passes `http(s)` URLs to `shell.openExternal`, and `will-navigate` blocks any top-frame
  navigation that is not `file://`, again passing `http(s)` to the browser. The `open-external`
  channel accepts only `^https?://`. The main process obtains editor content and export preparation
  through a tokened `folio-request` / `folio-response` round trip (4 s timeout with a fallback) instead
  of `executeJavaScript`. In the same change, `promptUnsaved()` lets an action proceed only when
  `doSave()` reports a successful write.
- **Rationale**: Code comments: "Opened files are untrusted, so sanitize before injection to strip
  scripts and inline event handlers (e.g. `<img onerror=…>`)". "Never let renderer content open new
  windows or navigate the top frame away from the local app shell (they would inherit the preload
  bridge)". "Rather than reach into the page with executeJavaScript() (which would run in the main
  world and bypass context isolation)…". The commit title adds "Fixing some security issues".
- **Alternatives considered**: `html: false`, rejected (entry 2). `executeJavaScript` into the page,
  the approach `bd8f5ef` shipped with, was rejected because it bypasses context isolation. Keeping the
  `target` attribute is safe because both the link click handler and the window-open handler route
  such links.

### 6. Live reload by polling the open file's modification time

- **Decision**: `watchCurrentFile()` calls `fs.watchFile(path, { interval: 1000 })` for the open file.
  It ignores polls whose `mtimeMs` is 0 (deleted or mid-rename) or equals `lastMtimeMs`, and
  `lastMtimeMs` is refreshed after Folio's own saves and reloads. When the document is clean,
  `reloadCurrentFile()` reloads silently with `preserveScroll`. When it is dirty, a prompt offers
  "Reload" or "Keep My Changes", and the default and cancel answer is Keep. File ▸ Reload from Disk
  (`CmdOrCtrl+R`, enabled only when the document has a file) goes through `confirmDiscardIfDirty()`.
  The page keeps the reading position as a fraction of `scrollHeight` in the preview, and as the
  editor's `scrollTop` in source mode.
- **Rationale**: Code comment: "Uses fs.watchFile (polling) rather than fs.watch because it is
  reliable across editors that save atomically (write to a temp file then rename), which invalidate
  an fs.watch handle. The 1s poll is negligible per document and gives near-instant live reload for a
  viewer." Constitution Principle IV requires asking first when there are unsaved edits.
- **Alternatives considered**: `fs.watch`, rejected because atomic saves invalidate the handle.
  Snapping to the top after a reload, rejected: "keep the reading position instead of snapping to the
  top. Capture it as a fraction so it still makes sense if the document grew or shrank."

### 7. Front matter and relative images handled around the Markdown engine

- **Decision**: `splitFrontMatter()` removes a leading block matching
  `^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)`, and the block is rendered escaped as
  `<pre class="md-front-matter">` before the body (`abc8522`), with light and dark styles in `app.css`.
  The main process sends `baseUrl = pathToFileURL(filePath).href` with every file-backed document:
  `load-document`, `get-init` (including the launch Welcome), `document-path-changed` after Save As,
  and reloads. After sanitization, `resolveLocalAssets()` rewrites each relative `img[src]` with
  `new URL(src, baseUrl)` (`6bf8c90`).
- **Rationale**: `abc8522`: Markdown exported from OneNote exposed both bugs. The closing `---` became
  a setext H1 underline, and relative image paths resolved against the app bundle. Typora shows front
  matter as a metadata box. A `6bf8c90` comment: "Without this, relative `<img>` paths 404 because
  the window is loaded from src/renderer/index.html."
- **Alternatives considered**: Image resolution was written twice in parallel: `abc8522` used a folder
  URL from `docBaseUrl()` with `resolveAssets()`, and `6bf8c90` used `pathToFileURL(filePath)` with
  `resolveLocalAssets()`. The merge `ff19412` kept the second, "since it also covers Save As and the
  welcome doc". Letting the Markdown engine parse front matter was rejected because it produced the
  giant heading.

### 8. Bundled guides open as untitled documents, resolved inside the app archive

- **Decision**: `BUILTIN_DOCS` maps `welcome` to `welcome.md` ("Welcome") and `formatting-tour` to
  `formatting-tour.md` ("Markdown Formatting Tour"), and `builtinDocPath(file)` returns
  `path.join(__dirname, '..', 'samples', file)`. `openBuiltinDoc()` runs the unsaved-changes guard,
  then `loadBuiltinDoc()` sets `currentPath = null` and `currentName = doc.name` and stops watching.
  The Welcome document is also the `get-init` fallback, backed by a hard-coded stub if it cannot be
  read. The content history: a feature tour (`bd8f5ef`), a "Getting started" redesign (`f96fc39`),
  then trimmed to "Getting started" with the showcase moved to `samples/formatting-tour.md`
  (`ec3e6f4`).
- **Rationale**: From `9c3abe5`: the samples are packed into `app.asar`, but the loader looked under
  `resources/samples`, which exists only for `extraResources`, so a packaged Folio showed the stub.
  `__dirname` resolution works both in development and packaged ("Electron reads inside app.asar
  transparently"). Opening untitled means "Save becomes Save As so the shipped copies are never
  overwritten".
- **Alternatives considered**: `process.resourcesPath/samples`, rejected because that path exists only
  for `extraResources`. Opening the bundled file by its path, rejected because Save would overwrite
  the shipped copy.

### 9. Theme-painted backdrop, grayscale text, and theme-sized PDF output

- **Decision**: Paint `html, body { background-color: var(--bg-color, #ffffff) }` and set the window's
  `backgroundColor` to `#ffffff` (`578e52e`). For text weight, a 0.15px `-webkit-text-stroke` on
  `#write` (`946b5a4`) was replaced by `app.commandLine.appendSwitch('disable-lcd-text')`, set before
  the app is ready, and every text-stroke rule was removed (`5c3ee89`). PDF export calls
  `webContents.printToPDF({ pageSize, printBackground: true, margins: { marginType: 'default' } })`.
  `pageSize` was `'Letter'` when the theme file name contained "letter" (`pageSizeForTheme`,
  `bd8f5ef`); since 004 it is `'Letter'` when the Page width is `letter` (`pageSizeForWidth`), and A4
  otherwise.
- **Rationale**: `578e52e`: "base fluent.css sets --bg-color:#fff but never paints the page — Typora's
  own base CSS does … so the Electron window's grey backgroundColor showed through." `946b5a4`: the
  newer engine drew Inter "noticeably lighter than Typora's older Chromium" (ink density about 0.20
  against about 0.23). `5c3ee89`: "Chromium defaults to subpixel (ClearType/LCD) antialiasing on
  Windows, which renders text visibly heavier and grainier than Typora, whose core stylesheet asks
  for grayscale antialiasing. CSS alone cannot fix this: Blink only honours -webkit-font-smoothing on
  macOS/Linux". `printBackground` keeps theme backdrops and code-fence fills in the PDF.
- **Alternatives considered**: A fixed grey window background (`#eceef1`, `bd8f5ef`), replaced in
  `578e52e`. The text-stroke compensation (`946b5a4`), removed in `5c3ee89`. `-webkit-font-smoothing`
  in CSS, rejected because Windows ignores it.

### 10. Zoom scales the whole app shell; Windows/Linux zoom keys are handled in the page

- **Decision**: `state.zoom` is an integer from −5 to 15, mapped to the factor
  `clamp(1 + 0.1 × step, 0.5, 2.5)`. The factor is applied as CSS `zoom` on `#folio-root`, exposed as
  `--folio-zoom` (`664668d`), and persisted through `state-changed`. Since `664668d`, `#folio-root` uses
  `height: 100%` instead of `100vh`, and the editor's bottom padding is `calc(40vh / var(--folio-zoom,
  1))`. On Windows and Linux the menu shows the shortcut as label text (`zoomItem`), and a
  capture-phase `keydown` handler accepts Ctrl with `+`, `=`, `Equal` or `NumpadAdd`; `-`, `_`, `Minus`
  or `NumpadSubtract`; and `0`, `Digit0` or `Numpad0`. macOS keeps the native `CmdOrCtrl+Plus`, `-`
  and `0` accelerators.
- **Rationale**: Comments from `664668d`: "Electron cannot register `CommandOrControl+Plus` on
  Windows/Linux — 'Plus' maps to the unshifted `=` virtual key … the item is dead". "CSS `zoom` scales
  viewport units, so `100vh` would render as `factor x window height` — overflowing the window (status
  bar pushed off-screen) when zoomed in and leaving a dead gap when zoomed out." The capture phase
  makes sure "the CodeMirror editor can't swallow them in source mode".
- **Alternatives considered**: Native accelerators on every platform, which were dead on Windows and
  Linux. Viewport-unit (`100vh`) sizing, which broke at every zoom level other than 100%.

## Retroactive findings

1. **README drift: live reload.** README's "How to use" describes neither live reload of externally
   changed files nor File ▸ Reload from Disk (`Ctrl/Cmd+R`), both shipped in `8062af5`. This conflicts
   with the constitution's Documentation gate.
2. **README drift: highlighting.** README's Features ("Syntax highlighting … with highlight.js"),
   Project layout ("app.css … highlight.js token colors") and Acknowledgements still credit
   highlight.js, which `5c3ee89` removed as a dependency (010 owns the replacement). The same stale
   wording appears in the header comments of `build.js` and `src/renderer/app.css`, and in a code-sample
   comment in `samples/formatting-tour.md` ("Fenced code is highlighted with highlight.js").
3. **Bundled Welcome drift.** `samples/welcome.md` still says "Try **Fluent A4** or **Microsoft Word
   A4** for the paged 'sheet' look". Those are theme names from the flat list this feature shipped;
   since 004 the same look is a Style plus a Page width.
4. **Gap against README and constitution Principle IV.** File ▸ Open Recent (`actions.openRecent`) calls
   `loadFile()` directly and skips `confirmDiscardIfDirty()`, so unsaved edits are discarded without a
   prompt. README promises a prompt "before you close or open another file", and Principle IV names
   Open Recent explicitly. The gap has existed since `bd8f5ef` and needs a follow-up fix spec.
5. **Outline goes stale in source mode.** `buildOutline()` runs only from `renderPreview()`. Edits in
   source mode, or a document loaded while source mode is showing, leave the outline listing the
   previous render, and clicking an entry scrolls the hidden page until the user returns to it.
6. **Dead setting.** `outlineVisible` is still persisted through `state-changed`, but it has not been
   restored since `5c48052` (003) made `get-init` return `outlineVisible: false`.
7. **Inconsistent base folder for bundled guides.** The launch-time Welcome carries a `baseUrl` (the
   bundled `samples/` folder), but Help ▸ Welcome, Help ▸ Markdown Formatting Tour (`loadBuiltinDoc`)
   and File ▸ New send none. This is harmless today, because the guides contain no relative images.
8. **Spellcheck flag without effect (uncertain).** Windows are created with `spellcheck: true`, but
   the source editor's content opts out of spellchecking by default (CodeMirror 6 sets
   `spellcheck="false"` on its content element), and the find inputs from 006 set `spellcheck="false"`.
   Folio therefore shows no spellchecking, and the spec states no requirement. This is inferred from
   the editor library's default and was not verified at runtime.
9. **`mailto:` links do nothing.** Since `e2e2877` (005), the page forwards `mailto:` clicks to
   `openExternal`, but this feature's `open-external` handler accepts only `^https?://`. The behavior
   is safe, but the README does not mention it.
10. **Undocumented limits.** Remote images load only over `https:` (CSP `img-src`). Statistics count
    the Markdown source, including markup and front matter. The line count includes the empty line
    after a trailing newline, as the editor does. An empty document shows "~1 min read".
11. **Not verified in this pass** (GUI runs were out of bounds). (a) Apart from hiding code-copy buttons
    (010), there is no print stylesheet for Folio's own shell, so neither full pagination of long
    documents nor the absence of a visible outline or status bar in the PDF was verified;
    [quickstart.md](./quickstart.md) Scenario 6 checks both. (b) The navigation guard deliberately
    allows `file://` navigation, and the page installs no drag-and-drop handler, so dropping a file
    directly onto an open window falls back to the engine's default handling. That was not verified.
    README's "drop a file onto the app" refers to the app or executable icon (003).
12. **Security history.** From `bd8f5ef` through `ff19412` (2026-07-09 to 2026-07-14) Folio rendered
    with `html: true` and no sanitizer, used a CSP that allowed `'unsafe-inline'` scripts, and reached
    into the page with `executeJavaScript`. `8062af5` closed all three on 2026-07-14.
13. **Scope notes.** `bd8f5ef` already shipped Edit ▸ Find… (`CmdOrCtrl+F`, which switched into source
    mode and opened the editor's search panel); Find is specified by 006. The Help ▸ "Folio on GitHub"
    item and the About dialog's "Open GitHub" button from `bd8f5ef` were removed in `8062af5`. The
    title separator changed from an em dash to a plain hyphen in `2a26dea`. Toggle Outline's shortcut
    moved from `Ctrl/Cmd+Shift+O` (`bd8f5ef`) to `Ctrl/Cmd+Shift+K` (`356cf20`) and then to
    `Ctrl/Cmd+Alt+O` (`68e67be`).
