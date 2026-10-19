# Data Model: Three-Axis Theming: Style × Appearance × Page Width

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Schema contract**: [contracts/settings-schema.md](./contracts/settings-schema.md)

All theme state is **app-wide**. Nothing in this feature lives on the per-window `Session` introduced by [007-multiple-windows](../007-multiple-windows/spec.md); every window reads the same selection.

## 1. Theme Selection (persisted)

Lives in `DEFAULTS` of `src/store.js` and is saved in `folio-settings.json` in Electron's `userData` directory.

| Field | Type | Allowed values | Default | Menu labels | Validation / fallback |
|-------|------|----------------|---------|-------------|-----------------------|
| `styleFamily` | string | `'fluent'` \| `'github'` \| `'word'` (`STYLE_FAMILIES`) | `'fluent'` | Fluent · GitHub · Microsoft Word | `composeThemeFiles()` uses `'fluent'` for any value not in `STYLE_FAMILIES` |
| `appearance` | string | `'light'` \| `'dark'` (`APPEARANCES`; [011](../011-system-appearance/spec.md) later adds `'system'`) | `'light'` | Light · Dark | `applyAppearance()` uses `'dark'` only for exactly `'dark'`, otherwise `'light'` (1f452ec) |
| `pageWidth` | string | `'dynamic'` \| `'a4'` \| `'letter'` (`PAGE_WIDTHS`) | `'dynamic'` | Dynamic · A4 · US Letter | `composeThemeFiles()` uses `'dynamic'` for any value not in `PAGE_WIDTHS`; `pageSizeForWidth()` treats anything but `'letter'` as A4 |

- **Writers**: the menu actions `setStyleFamily`, `setAppearance`, `setPageWidth` in `src/main.js` (values are the fixed constants of the radio items in `src/menu.js`), and the one-time migration in the `Store` constructor.
- **Readers**: `rebuildMenu()` (radio `checked` state), `composeThemeFiles()`, `applyAppearance()`, `pageSizeForWidth()`, and the `get-init` handler.
- **Persistence**: `Store.set()` writes the whole settings object synchronously (`fs.writeFileSync`) on every change, so a choice survives a crash or forced quit right after it is made.
- **Invalid stored values** are not rewritten; they stay in the file until the user picks an option (see research.md, Retroactive finding 8).

## 2. Legacy Theme Preference (read once, then removed)

| Field | Type | Example values | Pre-004 default |
|-------|------|----------------|-----------------|
| `theme` | string (theme file name relative to `themes/`) | `fluent.css`, `fluent-a4.css`, `microsoft-word-us-letter.css`, any user-added `*.css` | `fluent.css` |

**Migration rule** (`migrateLegacyTheme(parsed)` in `src/store.js`, case-insensitive substring tests evaluated in this order):

| Applies when | `styleFamily` | `pageWidth` | `appearance` |
|--------------|---------------|-------------|--------------|
| `parsed.theme` is a string **and** `parsed.styleFamily` is absent | `'word'` if the name contains `word`; else `'github'` if it contains `github`; else `'fluent'` | `'letter'` if it contains `letter`; else `'a4'` if it contains `a4`; else `'dynamic'` | always `'light'` |

Outcome for the seven theme files bundled before this feature:

| Legacy `theme` | → `styleFamily` | → `pageWidth` |
|----------------|-----------------|---------------|
| `fluent.css` | `fluent` | `dynamic` (closest match; the old file capped the column instead of drawing a sheet) |
| `fluent-dynamic.css` | `fluent` | `dynamic` |
| `fluent-a4.css` | `fluent` | `a4` |
| `fluent-us-letter.css` | `fluent` | `letter` |
| `microsoft-word-dynamic.css` | `word` | `dynamic` |
| `microsoft-word-a4.css` | `word` | `a4` |
| `microsoft-word-us-letter.css` | `word` | `letter` |

### State transitions (Store construction at app start)

```text
no settings file ───────────────────────────────► DEFAULTS (fluent / light / dynamic), nothing written yet
file unreadable / invalid JSON ─────────────────► DEFAULTS (error logged, no crash)
file has `theme`, no `styleFamily` ─ migrate ───► DEFAULTS ← parsed ← migrated; delete `theme`; _flush() once
file has `styleFamily` (already migrated) ──────► DEFAULTS ← parsed; delete `theme` in memory (dropped on next write)
```

## 3. Style Family registry (code constants)

`STYLE_FAMILIES` and `familyLayers(family)` in `src/main.js`; radio items in `src/menu.js`.

| `styleFamily` | Family layers at `1f452ec` | Family layers at `4f48e69` (current) | Dark palette source |
|---------------|----------------------------|--------------------------------------|---------------------|
| `fluent` | `fluent.css` | `base.css` | `base.css` dark block |
| `github` | `fluent.css`, `github.css` | `base.css`, `github/github.css` | `--gh-*` Primer dark variables in `github/github.css` |
| `word` | `fluent.css`, `microsoft-word/word-type.css` | `base.css`, `word/word.css` | "page on a darker desk" block in `word/word.css` |

Registering a new Style = add its id to `STYLE_FAMILIES`, a `case` in `familyLayers()`, a radio item in `src/menu.js`, and a `themes/<family>/` folder (see [contracts/theme-layers.md](./contracts/theme-layers.md)).

## 4. Page Width registry (code constants)

`PAGE_WIDTHS` and `widthLayer(family, width)` in `src/main.js`.

| `pageWidth` | Width layer at `1f452ec` (Fluent & GitHub / Word) | Width layer at `4f48e69` | Writing column (Fluent & GitHub / Word) | PDF `pageSize` |
|-------------|----------------------------------------------------|--------------------------|------------------------------------------|----------------|
| `dynamic` | `fluent-dynamic.css` / `microsoft-word/word-page-dynamic.css` | `<family>/dynamic.css` | fills the window, 36 px frame on every side | `'A4'` |
| `a4` | `fluent-a4.css` / `microsoft-word/word-page-a4.css` | `<family>/a4.css` | max 794 px (210 mm @ 96 dpi) / max 595 pt | `'A4'` |
| `letter` | `fluent-us-letter.css` / `microsoft-word/word-page-letter.css` | `<family>/us-letter.css` | max 816 px (8.5 in @ 96 dpi) / max 612 pt | `'Letter'` |

All width layers make the source editor full-width (`#typora-source .CodeMirror-lines { max-width: none; }`). The Fluent and GitHub width layers also set `html { font-size: 11pt; }` and draw the sheet (white on `#eceef1` in Light; `#17181b` on `#0a0b0d` in Dark); Word's width layers set geometry only, its sheet comes from `word/word.css`.

## 5. Theme Layer Stack (derived, transient)

| Item | Where | Type | Notes |
|------|-------|------|-------|
| `themeFiles` | returned by `composeThemeFiles()`; sent in `get-init` and `set-theme` | `string[]` (2–3 paths relative to `themes/`) | `[...familyLayers(family), widthLayer(family, width)]`; never contains Appearance |
| `themesBaseUrl` | `get-init` response; renderer `state.themesBaseUrl` | string (`file:` URL ending in `/`) | `pathToFileURL(themesDir() + path.sep)`; `themes/` in the repo, `<resources>/themes/` when packaged |
| `state.themeFiles` | renderer `state` in `src/renderer/renderer.js` | `string[]` | last applied list |
| `link.folio-theme` | `<head>` of each window, after `app.css` | DOM elements | removed and re-created in order on every `applyTheme()` |

Full matrix after `4f48e69` (Appearance does not change the stack):

| Style \ Page width | Dynamic | A4 | US Letter |
|--------------------|---------|----|-----------|
| Fluent | `base.css` → `fluent/dynamic.css` | `base.css` → `fluent/a4.css` | `base.css` → `fluent/us-letter.css` |
| GitHub | `base.css` → `github/github.css` → `github/dynamic.css` | … → `github/a4.css` | … → `github/us-letter.css` |
| Microsoft Word | `base.css` → `word/word.css` → `word/dynamic.css` | … → `word/a4.css` | … → `word/us-letter.css` |

## 6. Appearance runtime state

| Item | Where | Values | Notes |
|------|-------|--------|-------|
| `nativeTheme.themeSource` | Electron main process (`applyAppearance()`) | `'light'` \| `'dark'` | App-wide; Chromium exposes it to every window as `prefers-color-scheme`, activating the `@media (prefers-color-scheme: dark)` blocks of all layers and of `src/renderer/app.css` |

### State transitions (runtime)

```text
startup:      Store() [migration] → createWindow() → applyAppearance() → renderer boot → get-init → applyTheme(themeFiles)
Style/width:  menu radio → set{StyleFamily|PageWidth}(v) → store.set → pushTheme()* → set-theme {files} → applyTheme → rebuildMenu()
Appearance:   menu radio → setAppearance(v) → store.set → applyAppearance() (themeSource) → rebuildMenu()
PDF export:   doExportPDF() → printToPDF({ pageSize: pageSizeForWidth() })

* pushThemeAll() — sends to every Session — since 8062af5 (007).
```

## Relationships

- **Theme Selection 1 → 1 Theme Layer Stack**: the stack is a pure function of `styleFamily` + `pageWidth`.
- **Theme Selection → Appearance runtime state**: `appearance` drives `nativeTheme.themeSource`.
- **Theme Selection → PDF export**: `pageWidth` alone selects the paper size.
- **Legacy Theme Preference → Theme Selection**: one-way, one-time migration; the legacy key is then deleted.
- **Theme Selection ↔ Session (007)**: none — shared by all windows; new windows receive it through `get-init`.
