# Implementation Plan: Three-Axis Theming: Style × Appearance × Page Width

**Branch**: `004-three-axis-theming` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-three-axis-theming/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `1f452ec` (2026-07-14, three-axis theming) and `4f48e69` (2026-07-16, symmetric `themes/` layout), plus the multi-window broadcast `pushThemeAll()` that arrived with `8062af5` (2026-07-14, owned by [007-multiple-windows](../007-multiple-windows/spec.md)). It describes the design as implemented; later extensions (the System appearance of [011-system-appearance](../011-system-appearance/spec.md), the Mermaid refresh of [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md)) are noted where they touch the same code.

## Summary

Replace the flat, folder-scanned Themes menu of 001 (every top-level `themes/*.css` was a menu item) with three orthogonal one-of choices — **Style** (`fluent` | `github` | `word`), **Appearance** (`light` | `dark`) and **Page width** (`dynamic` | `a4` | `letter`) — persisted as three settings keys. The main process composes Style + Page width into an ordered list of theme stylesheets (`base.css` → optional family overlay → `<family>/<width>.css`) and sends it to the renderer, which mounts each file as a `<link class="folio-theme">` after `app.css` so later layers win. Appearance never swaps files: it sets Electron's `nativeTheme.themeSource`, flipping Chromium's `prefers-color-scheme` so every layer's `@media (prefers-color-scheme: dark)` palette — plus new dark palettes for Folio's chrome and highlight.js tokens in `app.css` — activates at once. A one-time migration maps the legacy single `theme` filename onto the three keys, and PDF export derives its paper size from the Page width. A follow-up commit normalises `themes/` into a symmetric `base.css` + `fluent/` `github/` `word/` layout so a Style is "one folder plus a registration".

## Technical Context

**Language/Version**: JavaScript (ES2020+). CommonJS main-process modules (`src/main.js`, `src/menu.js`, `src/store.js`); ES-module renderer (`src/renderer/renderer.js`) bundled by esbuild into the git-ignored `src/renderer/bundle.js`; themes are plain CSS.

**Primary Dependencies**: Electron `^31.3.1` at the time (`git show 1f452ec:package.json`; upgraded to 43.2.0 in `57f8363` on 2026-08-03) — `Menu` radio items, `nativeTheme.themeSource`, `webContents.printToPDF({ pageSize })`, `webContents.send`. Pre-existing CodeMirror 6 (source editor) and highlight.js 11 (preview code highlighting, replaced by `@codemirror/legacy-modes` in `5c3ee89`). No dependency added or removed.

**Storage**: `folio-settings.json` in Electron's `userData`, owned by `src/store.js`; new keys `styleFamily`, `appearance`, `pageWidth` replace `theme` (see [data-model.md](./data-model.md), [contracts/settings-schema.md](./contracts/settings-schema.md)).

**Testing**: No automated tests; manual verification per constitution quality gates and [quickstart.md](./quickstart.md).

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: A Style/Page-width switch replaces two or three small local stylesheets in each window (one `set-theme` message per window, no document re-render); an Appearance switch is a single app-wide `nativeTheme.themeSource` assignment. Both are perceived as instant (< 1 s, SC-002).

**Constraints**: Typora DOM contract (`#write`, `#typora-source .CodeMirror`, `typora-sourceview-on`) unchanged; Appearance MUST NOT swap files; layers load from `file:` URLs permitted by the CSP's `style-src`/`font-src` and resolve their own relative `url()`/`@import`/`@font-face` references; offline only; Microsoft Aptos fonts may not be redistributed; no new runtime dependency.

**Scale/Scope**: 3 Styles × 2 Appearances × 3 Page widths = 18 looks. Theme stylesheets: 9 after `1f452ec` (`fluent.css`, three `fluent-*.css`, `github.css`, `microsoft-word/word-type.css`, three `microsoft-word/word-page-*.css`) → 12 after `4f48e69` (`base.css` + 3 Fluent + 4 GitHub + 4 Word). Themes submenu: 13 entries (3 disabled headers, 8 radios, 2 separators). 3 settings keys added, 1 retired.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Folio Constitution v1.0.0 (`.specify/memory/constitution.md`).

| Principle / Gate | Status | Evidence |
|------------------|--------|----------|
| I. Typora Theme Compatibility (NON-NEGOTIABLE) | ✅ Pass | `#write`, `#typora-source` + `.CodeMirror` and `body.typora-sourceview-on` are untouched (contract from 001). Themes become ordered `<link class="folio-theme">` layers appended after `app.css` (`applyTheme()` in `src/renderer/renderer.js`, note in `src/renderer/index.html`): `themes/base.css` → optional family overlay → width overlay; later layers win. Appearance is `nativeTheme.themeSource` (`applyAppearance()` in `src/main.js`), never a file swap, and every new layer plus Folio's chrome in `src/renderer/app.css` ships light and dark palettes. `4f48e69` establishes the symmetric `themes/<family>/` layout with `dynamic.css`, `a4.css`, `us-letter.css`, registered in `familyLayers`/`STYLE_FAMILIES` with matching radios in `src/menu.js`. This feature is the origin of these clauses. |
| II. Complement Typora: View and Lightly Edit | ✅ Pass | Presentation only: no new editing surface. A Themes menu and a paged "sheet" follow Typora's conventions. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | No new IPC channel or preload method. `set-theme` (main → renderer) changes its payload to `{ files }` and `get-init` gains `themeFiles`; both are composed in the main process from the whitelists `STYLE_FAMILIES`/`PAGE_WIDTHS`, so the renderer never names a theme path ([contracts/ipc-theme-channels.md](./contracts/ipc-theme-channels.md)). Layers are stylesheets loaded from `file:` URLs already allowed by the CSP; no script is introduced, so the later `script-src 'self'` hardening (`8062af5`) is unaffected. |
| IV. Never Lose the User's Work | ✅ Pass | A theme switch never replaces the document, so edits and the dirty flag are untouched and no guard is needed. Theme axes are app-wide preferences in the shared store, as the constitution prescribes. The legacy `theme` value is migrated by `migrateLegacyTheme()` in `src/store.js`, persisted once and only then removed; unreadable settings still fall back to defaults. |
| V. Cross-Platform Parity | ✅ Pass | One Themes menu for every OS, no accelerators. `nativeTheme.themeSource` drives `prefers-color-scheme` on macOS, Windows and Linux. The Word Style falls back to Segoe UI/Inter where Aptos is absent. PDF paper sizes are the standard `A4`/`Letter` on every platform. |
| VI. Lean, Local, and Self-Contained | ✅ Pass | No new dependency; composition is ~40 lines in `src/main.js`, migration ~10 lines in `src/store.js`. Themes are local files under `themes/` (offline). 18 looks come from 9 → 12 small stylesheets instead of 18 combined theme files. Aptos fonts stay git-ignored and are filtered out of packaged resources (a possible gap in `build.files`, owned by 002, is recorded as Retroactive finding 9 in research.md). |
| Development Workflow & Quality Gates | ⚠️ Pass with note | Gates 1–3 are covered by [quickstart.md](./quickstart.md) (build, smoke test including unsaved edits, Light/Dark × every Style). Gate 4 applies because `4f48e69` moves files shipped through `extraResources` (its `!**/fonts/*.ttf` filter still matches `themes/word/fonts/`), so quickstart includes an `npm run dist` check. Gate 5: the `set-theme`/`get-init` payload change is reviewed under III above. Documentation: README.md was rewritten in both commits, but its introduction still says the look is switched "by swapping a single CSS theme file" — stale since `1f452ec` and recorded under Retroactive findings in [research.md](./research.md). This is documentation drift, not a design violation. |

**Post-design re-check (after Phase 1)**: Re-evaluated against [data-model.md](./data-model.md), [contracts/](./contracts/) and [quickstart.md](./quickstart.md): no new violations. The only open item is the README drift listed in research.md; Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-three-axis-theming/
├── spec.md                       # Feature specification (/speckit-specify)
├── checklists/
│   └── requirements.md           # Spec quality checklist (/speckit-specify)
├── plan.md                       # This file (/speckit-plan command output)
├── research.md                   # Phase 0 output (/speckit-plan command)
├── data-model.md                 # Phase 1 output (/speckit-plan command)
├── quickstart.md                 # Phase 1 output (/speckit-plan command)
├── contracts/                    # Phase 1 output (/speckit-plan command)
│   ├── themes-menu.md            # Themes menu groups, items, actions
│   ├── theme-layers.md           # themes/ layout, layer stack, appearance + Typora contract
│   ├── ipc-theme-channels.md     # get-init themeFiles, set-theme payload
│   └── settings-schema.md        # styleFamily/appearance/pageWidth, legacy theme migration
└── tasks.md                      # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Only files changed by `1f452ec` and `4f48e69` (verified with `git show --stat`; `←` marks the 4f48e69 rename source):

```text
.gitignore                        # Aptos exclusion moved to themes/word/fonts/*.ttf (4f48e69)
README.md                         # Features, theming contract, How to use, Themes (1f452ec, 4f48e69)
src/
├── main.js                       # STYLE_FAMILIES/APPEARANCES/PAGE_WIDTHS, familyLayers, widthLayer,
│                                 # composeThemeFiles, applyAppearance, pushTheme, setStyleFamily/
│                                 # setAppearance/setPageWidth, pageSizeForWidth, get-init themeFiles
│                                 # (1f452ec; uniform paths in 4f48e69; pushThemeAll via 8062af5)
├── menu.js                       # Themes submenu: Style / Appearance / Page Width radio groups (1f452ec)
├── store.js                      # DEFAULTS styleFamily/appearance/pageWidth + migrateLegacyTheme (1f452ec)
└── renderer/
    ├── index.html                # single <link id="theme-style"> removed (1f452ec)
    ├── renderer.js               # applyTheme(payload) mounts ordered link.folio-theme layers (1f452ec)
    └── app.css                   # dark palettes: outline, status bar, selection, highlight.js (1f452ec)
themes/
├── base.css                      # ← fluent.css: shared foundation + Fluent palette (4f48e69)
├── fluent/
│   ├── dynamic.css               # ← fluent-dynamic.css (@import removed + dark block in 1f452ec)
│   ├── a4.css                    # ← fluent-a4.css (same)
│   └── us-letter.css             # ← fluent-us-letter.css (same)
├── github/
│   ├── github.css                # ← github.css, the GitHub (Primer) overlay added in 1f452ec
│   ├── dynamic.css               # new in 4f48e69 (copy of Fluent's geometry + dark rules)
│   ├── a4.css                    # new in 4f48e69
│   └── us-letter.css             # new in 4f48e69
└── word/
    ├── word.css                  # ← microsoft-word/word-type.css (dark block in 1f452ec)
    ├── dynamic.css               # ← microsoft-word/word-page-dynamic.css
    ├── a4.css                    # ← microsoft-word/word-page-a4.css
    ├── us-letter.css             # ← microsoft-word/word-page-letter.css
    └── fonts/
        └── README.txt            # ← microsoft-word/fonts/README.txt
```

Deleted in `1f452ec`: `themes/microsoft-word-a4.css`, `themes/microsoft-word-dynamic.css`, `themes/microsoft-word-us-letter.css` (the `@import` wrappers that pre-combined Word looks).

**Structure Decision**: Keep Folio's single-project Electron layout (constitution VI): theme selection, composition, appearance and PDF sizing live in the existing main-process modules (`src/main.js`, `src/menu.js`, `src/store.js`); the renderer only mounts the list it is given (`src/renderer/renderer.js`); Folio's chrome palettes stay in `src/renderer/app.css`; themes remain plain CSS under `themes/`, shipped by the existing `extraResources` rule. No new module, process type or dependency is introduced.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally empty.
