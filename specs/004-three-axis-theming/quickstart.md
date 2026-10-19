# Quickstart & Validation: Three-Axis Theming: Style × Appearance × Page Width

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/) | **Model**: [data-model.md](./data-model.md)

Manual validation guide for the shipped feature (Folio has no automated test runner). Each scenario maps to a user story in the spec; together they cover the constitution's verification gates that apply to this feature.

## Prerequisites

- Node.js LTS (README: Node 18+; developed on Node 20/24) and a checkout at or after `4f48e69`.
- Dependencies installed once: `npm install`.
- Know where the settings file lives: `folio-settings.json` in Electron's `userData` directory. For `npm start` runs the folder is named after the package (`folio`): `~/Library/Application Support/folio/` (macOS), `%APPDATA%\folio\` (Windows), `~/.config/folio/` (Linux). Installed builds use the product name `Folio`.
- Optional, for PDF checks: `pdfinfo` (poppler) or any PDF viewer that shows the page size (macOS Preview ▸ Tools ▸ Show Inspector).

## Run

```sh
npm run build:renderer                        # Gate 1: must finish without esbuild errors
npm start                                     # opens the Welcome document
npm start -- samples/formatting-tour.md       # opens the Formatting Tour directly
```

The Formatting Tour (also Help ▸ Markdown Formatting Tour) exercises headings, lists, tables, code fences, quotes and emoji — everything the Styles restyle.

## Scenario 1 — Compose Style × Page width (User Story 1; Gate 2)

1. `npm start -- samples/formatting-tour.md`. Open the **Themes** menu.
   - **Expect**: disabled headers **Style**, **Appearance**, **Page Width**, each followed by its radios ([contracts/themes-menu.md](./contracts/themes-menu.md)); one radio checked per group. (Builds that include [011-system-appearance](../011-system-appearance/spec.md) also list **System** under Appearance.)
2. With Page Width ▸ A4, choose Style ▸ **Fluent**, then **GitHub**, then **Microsoft Word**.
   - **Expect**: Fluent = the Fluent look (Inter if installed) on a white sheet over a grey backdrop; GitHub = system UI font, rules under H1/H2, GitHub blockquotes, tinted code, bordered tables; Microsoft Word = Aptos (or Segoe UI/Inter fallback), monochrome headings and links, coloured code. The A4 radio stays checked throughout.
3. For any Style choose **Dynamic**, then resize the window.
   - **Expect**: the sheet fills the window with an equal ~36 px frame on every side and follows the resize.
4. Choose **A4**, then **US Letter**; widen the window past 1800 px and shrink it to its minimum (640 px).
   - **Expect**: the writing column is capped at ~794 px (A4) / ~816 px (US Letter), centred, on wide windows, and narrows to fit small windows.
5. Toggle source mode (`Ctrl/Cmd+/`) and change Style and Page width again.
   - **Expect**: the editor restyles immediately and stays full-width (no sheet) for every width.
6. Type a few characters so the title shows `•`, then change each axis once.
   - **Expect**: no save prompt, text and `•` unchanged (Gate 2: the unsaved-changes guard is not triggered because the document is never replaced).
7. Optional DevTools check (View ▸ Toggle Developer Tools → Console): `[...document.querySelectorAll('link.folio-theme')].map(l => l.href)`.
   - **Expect**: 2 links for Fluent, 3 for GitHub/Word, in the order given in [contracts/theme-layers.md](./contracts/theme-layers.md) §2, after `app.css`.

## Scenario 2 — Light/Dark across the whole app (User Story 2; Gate 3)

1. Open the Formatting Tour and show the outline (status-bar **Outline** button). Choose Themes ▸ Appearance ▸ **Dark**.
   - **Expect**: page, backdrop, outline sidebar, status bar and code colours switch to dark together; Dark is checked.
2. Repeat for all 9 Style × Page width combinations, in the rendered view and in source mode (select some text in the editor).
   - **Expect**: no white sheet, grey backdrop, white zebra row, white source-mode background or light selection remains. GitHub uses Primer-dark text/link/border/code colours; Word shows a dark page on a darker desk with light-grey text.
3. While Dark, change Style and Page width.
   - **Expect**: the new combination appears dark immediately.
4. Choose **Light**.
   - **Expect**: everything returns to the light palettes.

## Scenario 3 — Persistence, defaults and migration (User Story 3)

1. Choose GitHub, Dark, US Letter; quit Folio and run `npm start` again.
   - **Expect**: the same three radios are checked and the window opens in that look. The settings file contains `"styleFamily": "github"`, `"appearance": "dark"`, `"pageWidth": "letter"`.
2. Quit. Edit the settings file: delete the `styleFamily`, `appearance` and `pageWidth` lines and add `"theme": "microsoft-word-us-letter.css"`. Start Folio.
   - **Expect**: Microsoft Word, Light, US Letter are checked; the file now holds the three keys and no `theme` ([contracts/settings-schema.md](./contracts/settings-schema.md)).
3. Repeat step 2 with `"theme": "fluent.css"` and with a custom name such as `"theme": "my-theme.css"`.
   - **Expect**: both become Fluent, Light, Dynamic.
4. Quit, then set `"styleFamily": "github"` **and** keep a `"theme": "microsoft-word-a4.css"` line. Start Folio.
   - **Expect**: GitHub stays selected (no migration); `theme` disappears from the file at the next settings write (for example any theme change).
5. Quit, rename the settings file away (or replace its contents with `{` to make it invalid). Start Folio.
   - **Expect**: Fluent, Light, Dynamic; no crash. Restore your file afterwards.

## Scenario 4 — PDF paper size (User Story 4)

1. Open any document, choose Page Width ▸ **US Letter**, File ▸ Export to PDF… and save `letter.pdf`.
2. Repeat with **A4** (`a4.pdf`) and **Dynamic** (`dynamic.pdf`), and once more with a different Style and Dark to confirm Style/Appearance do not matter.
3. Inspect: `pdfinfo letter.pdf | grep "Page size"` etc.
   - **Expect**: `letter.pdf` 612 × 792 pt (US Letter); `a4.pdf` and `dynamic.pdf` ≈ 595 × 842 pt (A4).

## Scenario 5 — Bring your own Typora theme as a Style (User Story 5)

Use a temporary Style id, written `<style>` below (for example `mystyle`).

1. Copy `themes/github/` to a new folder `themes/<style>/` and rename the copied `github.css` to `<style>.css`. Next to it add `extra.css` containing `#write h1 { color: #c0392b !important; }`, and put `@import url('extra.css');` on the first line of `<style>.css`.
2. Register the Style exactly as README "Add your own Typora themes" says (details in [contracts/theme-layers.md](./contracts/theme-layers.md) §7): add `'<style>'` to `STYLE_FAMILIES` and a `case '<style>': return ['base.css', '<style>/<style>.css'];` to `familyLayers()` in `src/main.js`; add a radio calling `actions.setStyleFamily('<style>')` to the Style group in `src/menu.js`.
3. `npm start`, choose the new Style, then each Page width and both Appearances.
   - **Expect**: the GitHub look with red H1 headings (the relative `@import` resolved from the new folder), all three widths work, and Dark applies via the copied dark blocks. No existing theme file was edited (`git status -- themes/` lists only the new folder).
4. Revert: `git restore src/main.js src/menu.js` and delete the new folder.

## Scenario 6 — Every window follows the theme (with 007)

1. Open a second window with File ▸ New Window (`Ctrl/Cmd+Shift+N`), see [007-multiple-windows](../007-multiple-windows/spec.md).
2. In either window change Style, Page width and Appearance.
   - **Expect**: both windows restyle each time; a third window opened afterwards starts with the current selection.

## Scenario 7 — Packaging and font licensing (Gate 4)

1. Run `npm run dist` on the host platform.
2. Inspect the unpacked app under `release/` (e.g. `release/mac-arm64/Folio.app/Contents/Resources/themes/`, `release/win-unpacked/resources/themes/` or `release/linux-unpacked/resources/themes/`).
   - **Expect**: `base.css` plus `fluent/`, `github/`, `word/` with their files; `word/fonts/` contains only `README.txt`.
3. If you keep Aptos `.ttf` files in `themes/word/fonts/` locally, also list the archive: `npx @electron/asar list <path-to>/app.asar | grep -i '\.ttf'`.
   - **Expect**: no output. Any match confirms research.md Retroactive finding 9 (to be fixed under [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md)).

## Gate 5 — Principle III review

Confirm against [contracts/ipc-theme-channels.md](./contracts/ipc-theme-channels.md): no new channel or preload method; `set-theme`/`get-init` carry only main-composed relative paths from the whitelists; the renderer cannot request arbitrary theme files; the CSP is unchanged.
