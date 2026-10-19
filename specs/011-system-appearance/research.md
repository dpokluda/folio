# Research: Follow the OS Light/Dark Setting (System Appearance)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-30 (reconstructed 2026-10-18)

**Sources**: the `0bbcf84` diff and message; the code comments it added or relied on in `src/main.js`, `src/menu.js`, `src/store.js` and `src/renderer/renderer.js`; the history of the reused symbols (`git log -S"nativeTheme.on('updated'" --reverse` → `1ce68e0`; `git log -S'APPEARANCES' --reverse` → `1f452ec`, then `0bbcf84`); README.md; and Electron's `nativeTheme` documentation. Every Technical Context item was known from the code, so no open questions remained for Phase 0.

### 1. Map "System" to `nativeTheme.themeSource = 'system'`

- **Decision**: Store `'system'` and hand it unchanged to `nativeTheme.themeSource` in `applyAppearance()` (`src/main.js`).
- **Rationale**: Electron documents this exact three-state model: "Follow OS → `themeSource = 'system'`, Dark Mode → `'dark'`, Light Mode → `'light'`". It also states that setting `'system'` "will remove the override and everything will be reset to the OS default". One assignment covers both the initial resolution and every later OS change on all three platforms. Chromium's `prefers-color-scheme` follows it, so every `@media (prefers-color-scheme: dark)` block in `themes/` and `src/renderer/app.css` reacts with no Folio code. The comment `0bbcf84` added above `STYLE_FAMILIES` records the intent: "'system' hands the choice to the OS and follows it live (e.g. macOS Auto appearance or a scheduled Windows light/dark switch)". Constitution Principle I requires the appearance to be applied through `nativeTheme`.
- **Alternatives considered**: (a) Keep forcing `'light'`/`'dark'` and mirror the OS by reading `nativeTheme.shouldUseDarkColors`. This is circular: once Folio overrides `themeSource`, that property reports the override, not the OS. (b) A renderer-side `matchMedia('(prefers-color-scheme: dark)')` listener. The renderer cannot see the OS while the main process overrides the scheme, and the `1ce68e0` comment notes that the media query's `change` event is not dispatched when `nativeTheme` flips the scheme. (c) Swapping light and dark theme files, which Principle I prohibits and which would double the stylesheet count.

### 2. Reuse the existing `'updated'` → `appearance-changed` broadcast for OS-driven flips

- **Decision**: Add no listener, channel or polling. The `nativeTheme.on('updated', …)` handler that `1ce68e0` (2026-08-12) added for manual Light/Dark switches already sends `appearance-changed` to every `Session`. Under `'system'` the same event fires when the OS flips.
- **Rationale**: The handler reacts to the native theme changing, not to the menu click, so it is already correct for OS flips. Electron emits `'updated'` when "the value of `shouldUseDarkColors` … has changed". Its comment explains why a nudge is needed at all: "Chromium updates the media query's *value* in the renderer but does not dispatch a `change` event for it, so anything that has to react in script (mermaid diagrams bake their palette into the generated SVG) needs an explicit nudge." This is why the README text `0bbcf84` added could promise that System "re-renders Mermaid diagrams when it flips" without touching `src/renderer/` or `src/preload.js`.
- **Alternatives considered**: A second, OS-specific change watcher (redundant platform-specific code, against Principles V and VI); polling `shouldUseDarkColors` on a timer (wasteful and delayed); a renderer `matchMedia` listener (unreliable, per the comment above).

### 3. Validate the stored value against an allow-list and fall back to Light

- **Decision**: `nativeTheme.themeSource = APPEARANCES.includes(appearance) ? appearance : 'light'`, with `APPEARANCES = ['light', 'dark', 'system']`.
- **Rationale**: This generalizes the previous `store.get('appearance') === 'dark' ? 'dark' : 'light'` mapping from `1f452ec` now that the stored value is passed through, while keeping arbitrary strings out of Electron's enum-typed `themeSource` setter. It mirrors how `composeThemeFiles()` already validates `styleFamily` and `pageWidth` against `STYLE_FAMILIES` and `PAGE_WIDTHS`, and it satisfies Principle IV ("Unreadable settings MUST fall back to defaults without crashing").
- **Alternatives considered**: Normalizing the value in `src/store.js` at load time was rejected: the store is a generic key/value file that knows none of the axis vocabularies, and the allow-lists live in `src/main.js`. Trusting the stored value was rejected because it would pass unknown strings to the native API.

### 4. One `appearance` key with a third value, not a separate "follow OS" flag

- **Decision**: `'system'` is a third value of the existing `appearance` key. The `DEFAULTS` comment in `src/store.js` now reads `'light' | 'dark' | 'system' (follow the OS)`.
- **Rationale**: One radio group maps to one key, so no settings migration is needed and Principle IV's migration rule never applies. It is also downgrade-safe: builds before `0bbcf84` treat anything but `'dark'` as Light (`=== 'dark' ? 'dark' : 'light'`, with the menu rule `checked: appearance !== 'dark'`), so an older build opens a settings file containing `'system'` in Light instead of failing.
- **Alternatives considered**: A boolean `followSystem` next to `appearance` was rejected. The two keys could contradict each other, the third radio state would have to be derived from them, and existing settings would need a migration.

### 5. Keep Light as the default and make System opt-in

- **Decision**: `DEFAULTS.appearance` stays `'light'`; `0bbcf84` changed only its comment.
- **Rationale** (inferred, because the commit message gives no reason): first launches and existing installs look exactly as before, and Folio's Typora-style page has opened in Light since `1f452ec`. Electron's own default would be `'system'`, but Folio overrides it on the first `createWindow()` → `applyAppearance()`.
- **Alternatives considered**: Defaulting to System was not adopted, because it would silently change the first-run look for users whose OS is in dark mode.

### 6. Light as the menu's catch-all checked state

- **Decision**: Light is checked whenever the stored value is neither `'dark'` nor `'system'` (`src/menu.js`).
- **Rationale**: This mirrors the fallback in `applyAppearance()`, so the menu never shows a selection that differs from what is displayed, and exactly one item in the radio group is checked even for a missing or unknown value. The disabled "Appearance" header row and the separators delimit the group; the `src/menu.js` comment says "Disabled header rows also break Electron's implicit radio grouping so each block toggles independently". Adding System directly after Dark therefore joins the same group with no extra wiring.
- **Alternatives considered**: `checked: appearance === 'light'` was rejected because it would leave no Appearance item checked for an unknown value.

### 7. Redraw timing: a zero-delay timer, so background windows catch up

- **Decision** (inherited from `1ce68e0`, and essential for System): the renderer handles `appearance-changed` with `setTimeout(refreshMermaid, 0)`.
- **Rationale**: The code comment reads: "Deferred with a timer (not requestAnimationFrame, which Chromium suspends for background windows) so the page has settled on the new appearance before mermaid reads it." Manual switches happen in the focused window. OS-driven flips (macOS Auto at dusk, a Windows schedule) usually arrive while Folio's windows are in the background, which is exactly when a frame callback would stall. `initMermaid()` re-reads `prefersDark.matches` on every pass, so the redraw picks up the new palette.
- **Alternatives considered**: `requestAnimationFrame` stalls in background windows. Redrawing when a window gains focus would add state and leave stale diagrams in windows that are visible but not focused.

### 8. Redraw scope: only previews with diagrams, never in source mode

- **Decision** (inherited from `1ce68e0`): `refreshMermaid()` returns early in source mode and when the preview has no `[data-folio-mermaid]` placeholder; otherwise it calls `renderPreview()`.
- **Rationale**: Everything except diagrams restyles through CSS alone. The code comment calls the function a "Cheap no-op for documents that contain none". Leaving source mode calls `renderPreview()` anyway (`setSourceMode(false)`), which draws the diagrams in the current palette.
- **Alternatives considered**: Re-rendering every preview on every flip was rejected: it is needless DOM churn and loses the reader's text selection in documents that have no diagrams.

### 9. PDF export follows the appearance in effect

- **Decision**: No export-specific handling. `doExportPDF()` in `src/main.js` prints the live preview (`printToPDF` with `printBackground: true`) without touching `themeSource`.
- **Rationale** (inferred): `nativeTheme` is process-wide, so forcing Light for an export would flip every open window and trigger diagram redraws everywhere. The export already waits for an in-flight diagram pass through `prepare-export` → `whenMermaidSettled()`, which came with `1ce68e0`.
- **Alternatives considered**: Temporarily setting `themeSource = 'light'` during the export, which would cause a visible flash in all windows and two extra redraw cycles. Light-only colour overrides under `@media print`, which neither `themes/base.css` nor `src/renderer/app.css` has.

## Retroactive findings

1. **README drift: combination count.** README.md (Themes) still says "That's 3 × 2 × 3 = 18 combinations from a handful of small stylesheets" directly below a table that has listed three Appearance options (Light · Dark · System) since `0bbcf84`. The sentence dates from `1f452ec`. The menu now offers 3 × 3 × 3 = 27 selectable combinations, although only 18 distinct looks can render at any moment because System always resolves to Light or Dark. The sentence should be reworded in a future change; it is not edited here, per the flow-forward rule.
2. **Attribution: the diagram redraw predates the feature.** The README sentence `0bbcf84` added ("… and re-renders Mermaid diagrams when it flips") describes the `nativeTheme` `'updated'` → `appearance-changed` → `refreshMermaid()` path from `1ce68e0`. `0bbcf84` changed no renderer or preload code; the `'system'` theme source simply makes OS flips emit the same event.
3. **Undocumented: which appearance a PDF uses.** README does not say. Export is not forced to Light. Under Dark, or under System while the OS is dark, the print rules in `themes/base.css` and `src/renderer/app.css` add no colour overrides and backgrounds are printed (`printBackground: true`), so the PDF is expected to carry the dark palette. This is inferred from the code and was not checked in the GUI during this retroactive pass.
4. **Known limitation: an OS flip during export.** `prepare-export` waits for diagrams *before* the save dialog opens. An OS flip while the dialog is open starts a new redraw that `printToPDF` does not wait for, so diagrams could be captured mid-redraw. This is unlikely, and exporting again resolves it.
5. **Platform nuance: Linux.** README names macOS Auto and scheduled Windows switches (PowerToys) but says nothing about Linux. Whether System follows a Linux desktop live depends on the desktop environment reporting its preference to Chromium; this was not verified. If Linux turns out to behave differently, Principle V requires README to say so.
6. **Unknown values are not normalized.** An unrecognized `appearance` value is applied and shown as Light, but it stays in `folio-settings.json` until the user picks an Appearance, because validation happens at use time in `src/main.js` and `src/menu.js`. This is harmless.
7. **Comment drift (no behavior impact; code owned by 004 and 010).** The `applyTheme()` comment in `src/renderer/renderer.js` (from `1f452ec`) still says "Appearance (light/dark)" and "no work needed here". The `onAppearanceChanged` registration carries two versions of the same comment (both from `1ce68e0`); the first says "Deferred a frame", which is stale because the code uses a timer. The dark-appearance header in `src/renderer/app.css` (from `1f452ec`) still mentions only "Appearance ▸ Dark".
8. **Extra redraws.** Electron also emits `'updated'` for other native-theme changes (high contrast, inverted colours) and documents that setting `themeSource` emits it. `createWindow()` calls `applyAppearance()` for every new window, so opening a window may also redraw the diagrams in other windows. Each such redraw is harmless.
