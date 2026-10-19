# Contract: Theme Folder Layout, Layer Stack and Appearance

**Feature**: [../spec.md](../spec.md) | **Introduced by**: `1f452ec` (layer stack, dark palettes) and `4f48e69` (symmetric folder layout) | **Source**: `familyLayers()`, `widthLayer()`, `composeThemeFiles()`, `applyAppearance()` in `src/main.js`; `applyTheme()` in `src/renderer/renderer.js`; `src/renderer/index.html`; `themes/**`

This contract is the public interface for theme authors. Constitution Principle I treats it as non-negotiable.

## 1. Folder layout (since `4f48e69`)

```text
themes/
├── base.css            shared foundation: structure, layout, Fluent palette (light + dark), code palette
├── fluent/             (no family overlay — base.css is the Fluent look)
│   ├── dynamic.css
│   ├── a4.css
│   └── us-letter.css
├── github/
│   ├── github.css      GitHub (Primer) family overlay
│   ├── dynamic.css
│   ├── a4.css
│   └── us-letter.css
└── word/
    ├── word.css        Microsoft Word (Aptos) family overlay
    ├── dynamic.css
    ├── a4.css
    ├── us-letter.css
    └── fonts/
        └── README.txt  how to supply the git-ignored Aptos .ttf files
```

Rules:

- Every Style folder MUST contain the three width layers `dynamic.css`, `a4.css` and `us-letter.css` (the width layer path is computed, not looked up).
- A Style's family overlay, if any, is named `<family>/<family>.css`.
- At `1f452ec` (before the restructure) the same roles were played by `fluent.css`, `github.css`, `fluent-dynamic.css`, `fluent-a4.css`, `fluent-us-letter.css` (shared by Fluent and GitHub), `microsoft-word/word-type.css` and `microsoft-word/word-page-dynamic.css`, `microsoft-word/word-page-a4.css`, `microsoft-word/word-page-letter.css`.

## 2. Layer resolution

```js
familyLayers('fluent') → ['base.css']
familyLayers('github') → ['base.css', 'github/github.css']
familyLayers('word')   → ['base.css', 'word/word.css']
widthLayer(family, 'dynamic' | 'a4' | 'letter') → `${family}/dynamic.css` | `${family}/a4.css` | `${family}/us-letter.css`
composeThemeFiles()    → [...familyLayers(family), widthLayer(family, width)]
```

- `family` falls back to `'fluent'` and `width` to `'dynamic'` when the stored value is not whitelisted.
- Paths are relative to `themesDir()`: `<repo>/themes/` in development, `<resources>/themes/` when packaged (shipped by the `extraResources` rule owned by [002-cross-platform-packaging](../../002-cross-platform-packaging/spec.md)).

## 3. Mounting and precedence

- `src/renderer/index.html` loads Folio's chrome (`app.css`) first; it contains no theme `<link>` (the 001 placeholder `<link id="theme-style">` was removed).
- `applyTheme(payload)` removes every `link.folio-theme`, then appends, in list order, `<link rel="stylesheet" class="folio-theme" href="${themesBaseUrl}${file}">` to `<head>`.
- Cascade order is therefore `app.css` → `base.css` → family overlay → width overlay: **later layers win**, and any theme rule beats Folio's chrome rule of equal specificity.
- Each layer is loaded from its own `file:` URL, so `@import`, `@font-face` and `url()` inside a layer resolve relative to that layer's folder (for example `word/word.css` → `word/fonts/Aptos-Regular.ttf`). The CSP allows `style-src … file:` and `font-src … file:`.
- A layer that fails to load is skipped silently; the remaining layers still apply.

## 4. Typora DOM contract (unchanged, defined by 001)

| Hook | Meaning for themes |
|------|--------------------|
| `#write` | container of the rendered Markdown; themes style it as the page/sheet |
| `#typora-source` with a `.CodeMirror` compatibility class | source editor; `#typora-source .CodeMirror*` rules apply |
| `body.typora-sourceview-on` | present only while source mode is active; width layers use it to whiten/darken the source-mode background |

This feature adds no new hook and renames none.

## 5. Appearance contract

- Appearance is applied only through `nativeTheme.themeSource` (`'light'` | `'dark'`), which Chromium exposes to every window as `prefers-color-scheme`. Theme files never change with the Appearance.
- Every layer that sets colours MUST put its dark values inside `@media (prefers-color-scheme: dark) { … }`. Bundled obligations:

| Layer | Dark responsibility |
|-------|---------------------|
| `base.css` | Fluent dark palette: `--bg-color`, `--text-color`, `--title-color`, `--color-cm-*` code tokens, … (pre-existing upstream block) |
| `github/github.css` | Primer dark variables `--gh-fg`, `--gh-muted`, `--gh-border`, `--gh-link`, `--gh-code-bg`, `--gh-alt-row`, plus `--bg-color`, `--side-bar-bg-color` |
| `word/word.css` | dark sheet `#1b1c1f` on desk `#0a0b0d`, light-grey monochrome text, headings, quotes and links, dark source-mode background |
| `fluent/*.css`, `github/*.css` width layers | backdrop `--bg-color: #0a0b0d`, sheet `#17181b`, zebra rows `#1c1e22`, source-mode background `#0f1012` |
| `word/*.css` width layers | none needed (geometry only) |
| `src/renderer/app.css` (chrome) | outline sidebar, status bar, source-editor selection and (at `1f452ec`) highlight.js token colours |

## 6. Width layer obligations

- Set the `#write` geometry: Dynamic fills the window (`max-width: none`, `margin: 36px` on every side); A4 caps the column at 794 px (Word: 595 pt); US Letter at 816 px (Word: 612 pt), centred.
- Re-declare the cap inside the foundation's `min-width: 1400px` and `min-width: 1800px` breakpoints so wide windows keep the paper width.
- Make the source editor full-width: `#typora-source .CodeMirror-lines { max-width: none; }`.

## 7. Adding a Style (README procedure)

1. Create `themes/<family>/` containing `<family>.css` (the Typora theme or overlay, plus any asset sub-folder) and `dynamic.css`, `a4.css`, `us-letter.css`.
2. In `src/main.js`, add `'<family>'` to `STYLE_FAMILIES` and a `case '<family>':` to `familyLayers()` returning `['base.css', '<family>/<family>.css']` — or `['<family>/<family>.css']` for a self-contained Typora theme used as its own base.
3. In `src/menu.js`, add `{ label: '<Name>', type: 'radio', checked: styleFamily === '<family>', click: () => actions.setStyleFamily('<family>') }` to the Style group.
4. Give the theme `@media (prefers-color-scheme: dark)` rules to make it follow Dark.

Constitution Principle I requires steps 1–3 for every new Style.
