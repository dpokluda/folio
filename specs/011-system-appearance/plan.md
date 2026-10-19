# Implementation Plan: Follow the OS Light/Dark Setting (System Appearance)

**Branch**: `011-system-appearance` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-system-appearance/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commit `0bbcf84` (2026-09-30, "Adding support for dynamic light/dark (system) theme"). The reused diagram-redraw path is traced to `1ce68e0` (2026-08-12) and the Appearance axis to `1f452ec` (2026-07-14). The plan describes the design as implemented.

## Summary

Add **System** as a third value on the Appearance axis introduced by [004-three-axis-theming](../004-three-axis-theming/spec.md). The stored value is passed straight to Electron's `nativeTheme.themeSource`. In `'system'` mode Folio's override is removed, so Chromium's `prefers-color-scheme` follows the OS light/dark setting live, and every `@media (prefers-color-scheme: dark)` block (Typora theme layers and Folio's chrome) reacts without Folio code. Mermaid diagrams bake their palette into SVG. They are redrawn through the existing `nativeTheme` `'updated'` → `appearance-changed` → `refreshMermaid()` path that `1ce68e0` added for manual toggles. That event also fires when the OS flips under `'system'`, so `0bbcf84` needed no renderer, preload or IPC change. The whole change touches four files (+19/−12 lines): the allow-list and validation in `src/main.js`, a radio item in `src/menu.js`, a comment in `src/store.js`, and README.md.

## Technical Context

**Language/Version**: JavaScript. The change is confined to CommonJS main-process modules (`src/main.js`, `src/menu.js`, `src/store.js`); the esbuild-bundled renderer (`src/renderer/renderer.js`) is reused unchanged.

**Primary Dependencies**: Electron `^43.2.0` at the time (`git show 0bbcf84:package.json`; the initial 31.x line was replaced by 43.2.0 in `57f8363` on 2026-08-03), specifically `nativeTheme.themeSource` and the `nativeTheme` `'updated'` event. Mermaid `^11.16.1` (added in `1ce68e0`) draws the diagrams that are redrawn. No dependency was added or changed.

**Storage**: `folio-settings.json` in Electron `userData`, owned by `src/store.js`. The existing `appearance` key gains the value `'system'`; its default stays `'light'`.

**Testing**: No automated tests; manual verification per constitution quality gates and quickstart.md.

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: An OS flip restyles the page, source editor and chrome in the engine's next style pass, with no Folio code on that path. The diagram redraw is deferred by one zero-delay timer per window. Timers keep running in background windows, unlike animation frames; hidden windows may be throttled to about one wake-up per second. Every window therefore settles within the spec's 2-second target (SC-002, SC-003). Documents without diagrams are not re-rendered at all.

**Constraints**: No new IPC channel or `window.folioAPI` method. Event-driven, with no polling of the OS setting. Appearance remains one app-wide preference applied through `nativeTheme`, never by swapping theme files (Principle I). An unknown stored value must not break startup (Principle IV). Fully offline (Principle VI).

**Scale/Scope**: 4 files, +19/−12 lines: 1 menu item, 1 new settings value and 1 allow-list entry. The change affects every open window at once because `nativeTheme` is process-wide.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | ✅ Pass | `applyAppearance()` in `src/main.js` sets `nativeTheme.themeSource` to `'light'`, `'dark'` or `'system'`. No stylesheet is swapped, and the `#write` / `#typora-source` DOM and the `link.folio-theme` layer order are untouched. The existing `@media (prefers-color-scheme: dark)` palettes in the theme layers (e.g. `themes/base.css`) and in Folio's chrome (`src/renderer/app.css`) serve System unchanged. The constitution itself requires "Appearance (Light, Dark, System)" to go through `nativeTheme`. |
| II. Complement Typora | ✅ Pass | This is a viewing-comfort preference only; no editing surface or mode is added. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | No new IPC channel or preload method. The reused `appearance-changed` event (main → renderer, no payload; `onAppearanceChanged` in `src/preload.js`) carries no data. The renderer cannot change the appearance: `actions.setAppearance` is reachable only from fixed-literal menu items in `src/menu.js`. The redraw goes through the unchanged `renderPreview()`, so HTML is still sanitized by DOMPurify and Mermaid still runs with `securityLevel: 'strict'`. |
| IV. Never Lose the User's Work | ✅ Pass | Appearance stays an app-wide preference in the settings store (`DEFAULTS.appearance` in `src/store.js`), not on `Session`. An unknown value falls back to Light when it is used (`APPEARANCES.includes(…)`) and never crashes startup. The redraw re-renders from in-memory text (`currentText()`), never from disk, so unsaved edits and the `•` indicator are untouched. A settings file containing `'system'` that is read by an older build degrades to Light, so no migration is needed. |
| V. Cross-Platform Parity | ✅ Pass | The System radio item has no platform condition. `themeSource = 'system'` follows macOS (including Auto), Windows (app mode, including scheduled switches) and the Linux desktop's reported preference. Live switching on Linux depends on the desktop environment and is recorded in research.md (Retroactive findings) as unverified; no Folio-side platform difference exists. |
| VI. Lean, Local, Self-Contained | ✅ Pass | No new dependency, module or process. The design is event-driven rather than polling, and works fully offline. |
| Quality Gates 1–5 (verification) | ✅ Pass | Gate 1: renderer source unchanged; `npm run build:renderer` is unaffected. Gate 2: smoke flows in quickstart.md scenarios 1–6. No document-replacing action is added, so the unsaved-changes check reduces to edits surviving a redraw (scenario 4). Gate 3: quickstart scenario 7 flips Light/Dark under System across Fluent, GitHub and Microsoft Word. Gate 4: N/A, because no packaging, file-association, launch or install code changed. Gate 5: reuse of `appearance-changed` reviewed against Principle III (row above and [contracts/ipc-channels.md](./contracts/ipc-channels.md)). |
| Quality Gates: Documentation | ⚠️ Partial | README.md was updated in the same commit (Features, How to use, Themes table row and the Appearance paragraph). However, the sentence under the Themes table still says "3 × 2 × 3 = 18 combinations" although the table now lists three Appearance options. This is recorded in [research.md](./research.md#retroactive-findings) and is a documentation drift, not a design violation. |

**Post-design re-check (after Phase 1)**: Unchanged. data-model.md and contracts/ add no channel, dependency, stylesheet or process. The only ⚠️ is the README arithmetic drift, tracked as a retroactive finding.

## Project Structure

### Documentation (this feature)

```text
specs/011-system-appearance/
├── spec.md              # Feature specification (/speckit-specify command output)
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── menu-commands.md     # Themes ▸ Appearance radio group (System added)
│   ├── settings-schema.md   # `appearance` key: values, default, validation, effect
│   └── ipc-channels.md      # Reused `appearance-changed` event and its new OS-driven trigger
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify command output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Files changed by `0bbcf84` (`git show --stat 0bbcf84`):

```text
README.md            # Features bullet, How to use (Switch themes), Themes table row, Appearance paragraph
src/
├── main.js          # APPEARANCES gains 'system'; applyAppearance() passes the validated value to nativeTheme.themeSource; theming comment
├── menu.js          # Themes ▸ Appearance: new System radio item; Light's checked rule narrowed
└── store.js         # DEFAULTS.appearance comment documents 'system' (default stays 'light')
```

**Structure Decision**: Single Electron desktop project with its existing layout; no new module is introduced. The feature lives entirely in the main process's existing Appearance plumbing from `1f452ec`. The path from an OS flip to a diagram redraw is reused as-is from `1ce68e0`: the `nativeTheme.on('updated')` broadcast in `src/main.js`, `onAppearanceChanged` in `src/preload.js` and `refreshMermaid()` in `src/renderer/renderer.js`. `0bbcf84` modified none of them.

## Complexity Tracking

No violations — table intentionally empty.
