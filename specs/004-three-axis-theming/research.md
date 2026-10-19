# Research: Three-Axis Theming: Style × Appearance × Page Width

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Retroactive Record**: Decisions reconstructed 2026-10-18 from the commit messages of `1f452ec` and `4f48e69`, the code comments they added (`src/main.js`, `src/menu.js`, `src/store.js`, `src/renderer/renderer.js`, `src/renderer/app.css`, theme file headers) and the README Themes section. The Technical Context had no unresolved unknowns; every entry below records a decision that the code already embodies.

### 1. Three orthogonal axes instead of a flat list of theme files

**Decision**: Replace 001's folder-driven Themes menu (`listThemes()` read every top-level `themes/*.css`; `titleCaseTheme()` turned `fluent-a4.css` into "Fluent A4") with three fixed, independent one-of choices — Style, Appearance, Page width — that are composed at runtime.

**Rationale**: The 1f452ec commit message: "Replace the flat, folder-driven Themes menu with three orthogonal one-of choices that compose at runtime". README: "That's 3 × 2 × 3 = 18 combinations from a handful of small stylesheets, rather than 18 separate theme files." Before this change the seven bundled files already encoded a Style × width matrix by name (`fluent-a4.css`, `microsoft-word-us-letter.css`, …); adding Dark or a third Style would have multiplied the files again.

**Alternatives considered**:
- Keep the scanned flat list and ship one combined file per look — 18 files (36 with a separate dark set) that must be kept in sync by hand.
- Nested submenus per Style (Style ▸ width) — still pre-combined files, plus an extra click.
- Discover Styles by scanning `themes/` sub-folders — rejected implicitly: explicit registration gives proper labels ("Microsoft Word" for `word`, comment in `src/menu.js`) and keeps the menu stable.

### 2. Compose an ordered `<link>` stack in the main process; the renderer only mounts it

**Decision**: `composeThemeFiles()` in `src/main.js` returns `[...familyLayers(family), widthLayer(family, width)]` (relative to `themesDir()`); the list travels in `get-init` (`themeFiles`) and in `set-theme` (`{ files }`). `applyTheme()` in `src/renderer/renderer.js` removes every `link.folio-theme` and appends one `<link rel="stylesheet" class="folio-theme">` per file, after `app.css`. The Fluent width partials drop their `@import url('fluent.css')`.

**Rationale**: Renderer comment: the layers "are mounted as `<link>` elements appended after app.css so the theme wins on shared selectors and later layers override earlier ones." Each layer keeps its own URL, so relative `url()`, `@font-face` (`word.css` loads `fonts/Aptos-*.ttf`) and `@import` inside a Typora theme resolve against that theme's folder. Keeping the choice in the main process means the renderer never names a file (constitution III) and the same list can be pushed to every window (`pushThemeAll()`, 8062af5).

**Alternatives considered**:
- Per-combination wrapper files with `@import` chains — exactly what 001 shipped (`microsoft-word-a4.css` imported `fluent.css` + `word-type.css` + `word-page-a4.css`); deleted in 1f452ec.
- Swapping the `href` of a single `<link id="theme-style">` (001's approach) — cannot express a stack of layers.
- Reading the CSS in the main process and injecting one `<style>` — would break relative URL resolution and `@import` bases inside themes.

### 3. Appearance flips `nativeTheme.themeSource` instead of swapping files

**Decision**: `applyAppearance()` sets `nativeTheme.themeSource = store.get('appearance') === 'dark' ? 'dark' : 'light'` (1f452ec). It runs when a window is created and on every Appearance change; theme files never change with the Appearance.

**Rationale**: `src/main.js` comment: Appearance is "handled separately by flipping Chromium's prefers-color-scheme through Electron's nativeTheme, which activates the dark palettes the theme stylesheets already carry behind @media (prefers-color-scheme: dark)". The bundled Fluent theme already shipped such a block (`git show bd8f5ef:themes/fluent.css`), as many Typora themes do, so third-party themes become Dark-aware for free. `themeSource` is app-wide, so one assignment flips every window and Folio's chrome together.

**Alternatives considered**:
- A dark file per Style/width — doubles the files and ignores the dark palettes Typora themes already contain.
- A `body.dark` class — Typora themes do not key off it, so only Folio's own CSS would react.
- Following the OS setting — deferred; added later as the third option "System" by [011-system-appearance](../011-system-appearance/spec.md).

### 4. `base.css` is the Fluent theme, so Fluent has no family overlay

**Decision**: The full Fluent Typora theme (1,100+ lines, from Fluent-Typora) is the foundation for every Style. In 4f48e69 it is renamed `fluent.css` → `themes/base.css`; Fluent's stack is `base.css` → `fluent/<width>.css`, while GitHub and Word add a thin overlay (`github/github.css`, `word/word.css`).

**Rationale**: `src/main.js` comment: "Fluent adds no family overlay — base.css already carries the Fluent palette — so its folder holds only the page-width overlays." The foundation also supplies structure, layout, the `--color-cm-*` code palette (light and dark) and the source-editor rules that GitHub and Word reuse.

**Alternatives considered**:
- Split the Fluent palette into `fluent/fluent.css` over a palette-free base — a deep refactor of an upstream theme for no user benefit.
- Keep the name `fluent.css` — misleading once GitHub and Word are built on it (the reason for the 4f48e69 rename).

### 5. Symmetric `themes/<family>/` layout with uniform width paths

**Decision**: 4f48e69 moves every file into `themes/base.css` + `themes/<family>/` (`fluent/`, `github/`, `word/`), each family folder holding its optional overlay and exactly `dynamic.css`, `a4.css`, `us-letter.css`; `widthLayer()` collapses to `` `${family}/${name[width] || name.dynamic}` ``. GitHub gets its own three width overlays.

**Rationale**: `src/main.js` comment: "Every family folder carries its own dynamic/a4/us-letter files, so the path is uniform." In 1f452ec `widthLayer()` needed two lookup maps (Word's `microsoft-word/word-page-*.css` vs. Fluent's `fluent-*.css`, which GitHub borrowed). With a uniform rule, adding a Style is "one folder plus a registration" (README). The restructure is behaviour-preserving: renames plus header comments, and GitHub's new overlays copy Fluent's rules.

**Alternatives considered**:
- Keep shared Fluent width partials for GitHub (1f452ec) — avoids duplication but forces per-family special cases.
- Fall back to Fluent's width file when a family lacks one — not implemented; the simple path rule was preferred, accepting three duplicated files under `themes/github/`.

### 6. Radio groups separated by disabled header rows

**Decision**: The Themes submenu is a flat list: disabled "Style" header, three radios, separator, disabled "Appearance" header, two radios, separator, disabled "Page Width" header, three radios (`src/menu.js`).

**Rationale**: `src/menu.js` comment: "Disabled header rows also break Electron's implicit radio grouping so each block toggles independently." Adjacent radio items form one group in Electron; the headers both label and separate the groups, and every option stays one click away.

**Alternatives considered**:
- One submenu per axis — an extra click per change.
- A single run of eight radios — would make all options mutually exclusive.
- Checkboxes — no built-in exclusivity within a group.

### 7. Persist three keys and migrate the legacy `theme` value

**Decision**: `DEFAULTS` in `src/store.js` gains `styleFamily: 'fluent'`, `appearance: 'light'`, `pageWidth: 'dynamic'` (replacing `theme: 'fluent.css'`). `migrateLegacyTheme(parsed)` runs only when the file has a string `theme` and no `styleFamily`: lower-cased substring tests map `word`/`github`/else → Style and `letter`/`a4`/else → width, with Appearance `light`; the Store merges `DEFAULTS ← parsed ← migrated`, deletes `theme`, and flushes once.

**Rationale**: Store comment: "Map a legacy single-file `theme` setting … onto the new three-axis model, so users upgrading keep a sensible selection." Substring matching covers all seven bundled names and still yields a valid selection for user-added theme names. Light is the only possible prior appearance. Constitution IV requires migrating a changed setting rather than dropping it.

**Alternatives considered**:
- An exact table of the seven bundled names — a default would still be needed for custom names.
- Resetting everyone to defaults — loses the upgrading user's choice.
- Keeping `theme` next to the new keys — two sources of truth.

### 8. PDF paper size follows the Page width

**Decision**: `pageSizeForWidth()` returns `'Letter'` when `pageWidth === 'letter'` and `'A4'` otherwise; `doExportPDF()` passes it to `printToPDF({ pageSize, printBackground: true })`.

**Rationale**: It replaces 001's `pageSizeForTheme()`, which sniffed the theme filename for "letter" and whose comment noted "a4, dynamic, and base all print nicely on A4". Dynamic has no physical size, so A4 stays its paper.

**Alternatives considered**:
- Asking for the paper size in the export dialog — an extra step for every export.
- Deriving the size from the OS locale — unpredictable relative to the on-screen sheet.
- A custom page size matching the Dynamic window width — non-standard paper that printers handle poorly.

### 9. Dark palettes for Folio's chrome and code tokens live in `app.css`

**Decision**: Add an `@media (prefers-color-scheme: dark)` block to `src/renderer/app.css` covering the outline sidebar, the status bar, the source-editor selection and a GitHub-dark palette for the highlight.js token classes.

**Rationale**: `app.css` comment: "The Typora themes carry their own dark palettes, but Folio's own chrome (outline, status bar) and the highlight.js token colours above are NOT theme-controlled, so they need explicit dark treatment here". Later chrome (file explorer, find bar, toast, link hint, copy button) added its own rules to the same block, as the constitution now requires. Since `5c3ee89` (010) code fences use the theme's `--color-cm-*` palette instead of highlight.js colours, so preview code now darkens through the theme itself.

**Alternatives considered**:
- Deriving chrome colours from theme variables — Typora themes name and use them inconsistently.
- Leaving the chrome light under Dark — a jarring bright frame around a dark page.

### 10. Aptos fonts are not redistributed; the Word Style degrades gracefully

**Decision**: Keep the Aptos `.ttf` files out of git (`.gitignore`: `themes/microsoft-word/fonts/*.ttf` → `themes/word/fonts/*.ttf` in 4f48e69) and out of packaged resources (`extraResources` filter `!**/fonts/*.ttf`, owned by 002). `word.css` declares `--text-font: "Aptos", "Segoe UI", "Inter"` and `--title-font: "Aptos Display", "Aptos", "Segoe UI", "Inter Display", "Inter"`, with the foundation's system fallback after them. README and `themes/word/fonts/README.txt` explain how to supply the fonts.

**Rationale**: `.gitignore` comment: "Aptos fonts are Microsoft Office cloud fonts — do NOT redistribute in a public repo. Users must supply their own (from an Office install) or the Word themes fall back to Segoe UI / Inter." This matches the constitution's licensing rule and keeps Folio offline.

**Alternatives considered**:
- Bundling the fonts — license violation.
- Downloading them at runtime — violates the offline, self-contained principle (VI).
- Dropping Aptos for Segoe UI only — loses the Word look and Segoe UI is Windows-only.

## Retroactive findings

1. **README intro is stale (drift)**: README.md lines 6–8 still say Folio "switches the whole look, preview *and* editor, by swapping a single CSS theme file." Since `1f452ec` a look is a stack of two or three layered stylesheets, and Appearance is not a file at all.
2. **"Swapped via `<link href>`" (minor drift)**: README "How it works" says the layers are "swapped via `<link href>`"; `applyTheme()` actually removes every `link.folio-theme` element and appends fresh ones.
3. **"Or reuse Fluent's" width overlays (drift)**: README "Add your own Typora themes" says a new Style may supply its own `<width>.css` overlays "or reuse Fluent's". `widthLayer()` always resolves `<family>/<width>.css`, so reuse means copying the files into the new folder (as `themes/github/` does — its three overlays match Fluent's apart from the header comment) or editing `widthLayer()`.
4. **Undocumented PDF rule**: README says the PDF page size follows the Page width "(A4 vs US Letter)" but not that Dynamic exports on A4 (`pageSizeForWidth()`). The Features list still calls the widths "A4 / US Letter page themes", a pre-004 term.
5. **Undocumented migration**: README does not mention the one-time conversion of the old `theme` preference, that Appearance becomes Light, that plain `fluent.css` (a capped-width column, no sheet) becomes Fluent + Dynamic (a window-filling sheet), or that a user-added theme file falls back to Fluent.
6. **Drop-in themes retired (known limitation)**: In 001 any `.css` dropped into `themes/` appeared in the menu after a restart. Now a Style must be registered in `src/main.js` and `src/menu.js`; an installed copy reads `themes/` from its resources and its code from `app.asar`, so adding a Style requires a source checkout and a rebuild.
7. **GitHub Dark canvas is shadowed (known limitation)**: `github/github.css` sets the Primer canvas `--bg-color: #0d1117` in its dark block, but every GitHub width overlay loads later and sets `--bg-color: #0a0b0d` with a `#17181b` sheet. GitHub Dark therefore shows Folio's Fluent-dark backdrop and sheet; only text, link, border and code colours are Primer-dark.
8. **Unrecognised stored values**: For a hand-edited `styleFamily`/`pageWidth` outside the whitelists, `composeThemeFiles()` renders Fluent/Dynamic, but `buildMenu()` checks no radio in that group (it compares against the raw stored value), so the menu may not reflect the look actually shown. The stored value persists until the user picks an option.
9. **Possible font leak through `build.files` (owned by 002)**: `package.json` filters `!**/fonts/*.ttf` only in `extraResources`; the `files` list includes `themes/**/*` without that exclusion. Building from a checkout where a developer has supplied Aptos fonts locally could therefore pack them into `app.asar` (unused at runtime, since packaged builds read `resources/themes`). This was not verified by a build here; the quickstart includes an `app.asar` check.
10. **README Themes count after 011 (note for 011)**: The README now lists Appearance as "Light · Dark · System" but still says "3 × 2 × 3 = 18 combinations". System resolves to one of the 18 looks, but the arithmetic reads inconsistently.
