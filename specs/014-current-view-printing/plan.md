# Implementation Plan: Print the Current Document View

**Branch**: `main` (unchanged) | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)
**Status**: Implemented, closed 2026-11-05.

## Summary

Remove the separate Print Source menu/action and route the single Print action through a renderer request that selects its current view.
Keep `prepare-export` rendered-only and reuse the existing output lifecycle unchanged.

## Technical Context

**Language/Version**: Existing JavaScript CommonJS main process and esbuild-bundled renderer.
**Primary Dependencies**: Existing Electron, CodeMirror, and Markdown rendering stack; no additions.
**Storage**: No new persisted state; reuse renderer `state.sourceMode` and existing temporary output.
**Testing**: Extend `tests/printing.test.js` for one menu action, repeated view changes, full-source printing, and source-mode rendered PDF export.
**Target Platform**: Existing Windows/macOS/Linux desktop support; local checks on Windows.
**Project Type**: Existing Electron desktop app.
**Performance Goals**: No additional rendering or mode request beyond the existing output preparation.
**Constraints**: Preserve source/preview state, document text, existing PDF behavior, and feature 013's output lifecycle.
**Scale/Scope**: Three source files, one existing regression test, current guides, and this feature record.

## Constitution Check

| Gate | Design result |
|---|---|
| Theme/appearance compatibility | Unchanged snapshot and stylesheet paths. |
| Viewing/light editing scope | Simplifies one existing menu action; no new editor capability. |
| Hardened shell | Narrow `prepare-print` request on the existing bridge; renderer owns the view decision. No new privilege, generic bridge, or external source. |
| Preserve user work | No mode switch or new persisted preference; existing `currentText()` and cleanup are reused. |
| Cross-platform parity | Same Print item and `CmdOrCtrl+P` on every platform; native qualification remains unperformed. |
| Lean/local design | Removes menu/action/request surface rather than adding settings or a main-process mode cache. |
| Flow-forward records | New feature supersedes the menu contract of completed 013 without modifying that historical directory. |
| Version policy | Same unreleased change set retains the user's selected `1.1.0`; no second increment. |

**Post-design check**: No unresolved decision or architectural exception.
The renderer build, affected regressions, syntax checks, and whitespace checks passed; see [quickstart.md](./quickstart.md).
Do not claim native printer qualification from callback tests.

## Project Structure

### Documentation

```text
specs/014-current-view-printing/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/print-command.md
  quickstart.md
  checklists/requirements.md
  tasks.md
```

### Source

```text
src/main.js
src/menu.js
src/renderer/renderer.js
tests/printing.test.js
README.md
docs/user/README.md
```

**Structure Decision**: Reuse the existing renderer and output module.
Main requests `prepare-print`; the renderer calls `printableDocument(state.sourceMode)`.
Remove `printSource` and `prepare-print-source`; keep `prepare-export` unchanged.

## Complexity Tracking

No added abstraction or constitutional exception.
