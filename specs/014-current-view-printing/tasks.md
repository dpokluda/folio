---
description: "Tasks for a single Print command following the current document view"
---

# Tasks: Print the Current Document View

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [print-command.md](./contracts/print-command.md).
**Status**: Implemented, closed 2026-11-05
**Version**: Remains `1.1.0`, the same unreleased change set.

## Phase 1: Setup

- [X] T001 Review `src/main.js`, `src/menu.js`, `src/renderer/renderer.js`, and `tests/printing.test.js` against the new current-view contract and preserve the existing dirty working tree.

## Phase 2: Foundational

- [X] T002 Confirm the renderer's `state.sourceMode` in `src/renderer/renderer.js` is the authoritative view and reuse `src/printing.js` without another preference, bridge, or output path.

## Phase 3: User Story 1 - Print the Current View (P1)

**Goal**: One Print command follows source/preview mode.
**Independent Test**: Source -> preview -> source output through the same preparation request, retaining full text and user state.

- [X] T003 [US1] Update existing regressions in `tests/printing.test.js` to require one Print menu item, no Print Source item, and current-view routing; demonstrate the expected failure before implementation.
- [X] T004 [US1] Replace `prepare-print-source` with `prepare-print` in `src/renderer/renderer.js`, calling the existing snapshot function with current `state.sourceMode`.
- [X] T005 [US1] Simplify `doPrint()` in `src/main.js` to one required `prepare-print` request and remove the separate `printSource` action.
- [X] T006 [US1] Remove Print Source in `src/menu.js`, retaining the single Print item's label and `CmdOrCtrl+P`.

## Phase 4: User Story 2 - Keep PDF Rendered (P2)

**Goal**: No view-dependent change to PDF export.
**Independent Test**: Existing source-mode PDF regression still returns rendered content and preserves source mode.

- [X] T007 [US2] Preserve the rendered-only `prepare-export` path in `src/main.js` and `src/renderer/renderer.js`, and retain its source-mode export checks in `tests/printing.test.js`.

## Phase 5: Polish and Verification

- [X] T008 Update `README.md` and `docs/user/README.md` for current-view printing without a separate Print Source command.
- [X] T009 Build the renderer and run affected printing/task-list checks, syntax checks, and `git diff --check`; record actual results and native qualification limits in `specs/014-current-view-printing/quickstart.md`.
- [X] T010 Verify FR-001 through FR-006 against the changed files and mark `specs/014-current-view-printing/spec.md`, `plan.md`, and `tasks.md` complete without changing feature 013 or bumping the version again.

## Dependencies and Parallel Opportunities

T001 -> T002 -> T003 establishes the baseline and failing expectations.
T004 supplies the renderer request before T005 routes main through it; T006 removes the redundant menu action.
T007 preserves the separate PDF path and is verified with the same existing test file.
T008 can be drafted independently of source edits after the contract is agreed.
T009 follows source, tests, and guides; T010 follows successful validation.
US2 does not require new source functionality and remains independently checkable through PDF export.
No parallel task markers are used because this small change is applied as one coherent local edit.

## Implementation Strategy

The MVP is US1, using existing source/rendered representations behind one command.
US2 is the required PDF regression guard, not a new export mode.
Keep code, guides, and the active feature pointer consistent.
Do not modify the completed feature 013, add a new version bump, or perform Git publication.
