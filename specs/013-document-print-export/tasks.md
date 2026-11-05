---
description: "Completed retrospective task record for document printing and proper PDF export"
---

# Tasks: Document Printing and Proper PDF Export

**Input**: Design documents in `specs/013-document-print-export/`.
**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/document-output.md](./contracts/document-output.md).
**Status**: Implemented (retroactive), closed 2026-11-05.
**Product Version**: `1.1.0`.

Tasks below record work already completed in this working tree, not new work to execute.
The original implementation preceded these documents.
There is no new delivery commit; the checkout remains on `main` based on `d17083c`.
The checked tasks do not claim an installer, native-dialog smoke test, physical printout, or cross-platform qualification.
Those limitations remain in [quickstart.md](./quickstart.md).

**Tests**: Existing implementation regression tests are recorded as completed evidence.
This retrospective request does not request a new test framework or a repeat implementation.

## Format: `[ID] [P?] [Story] Description`

`[X]` records completed implementation or evidence collection.
`[P]` identifies work on independent files that could have run in parallel.
`[US1]`, `[US2]`, and `[US3]` map to the specification's stories.
File paths are repository-relative.

## Phase 1: Setup

**Purpose**: Identify the faulty output and preserve the existing checkout.

- [X] T001 Inspect the attached PDF and `src/main.js`, `src/menu.js`, and `src/renderer/app.css`; identify application controls and viewport clipping rather than full-document PDF output.
- [X] T002 Capture expected failures in `tests/printing.test.js`: missing Print actions and export preparation returning a boolean instead of a document-only HTML snapshot.

## Phase 2: Foundational

**Purpose**: Share a reliable, document-only output lifecycle across all actions.

- [X] T003 Add `withPrintDocument()` in `src/printing.js` to create isolated/sandboxed temporary HTML output, wait for explicit stylesheet results, fonts, and decoded images, and remove its window/directory on every exit.
- [X] T004 Extend required requests and error responses in `src/main.js` and `src/preload.js`; enforce owning sender IDs, reject output errors/timeouts, and preserve existing save fallback behavior.
- [X] T005 Add transient `outputInProgress` and `withDocumentOutput()` in `src/main.js`, enforcing "one active output operation per document" without a new persisted setting.

**Checkpoint**: Shared output preparation, ownership, readiness, and errors are implemented.

## Phase 3: User Story 1 - Export the Complete Rendered Document (P1)

**Goal**: Full paginated, selectable document PDF without app chrome.
**Independent Test**: Export the long acceptance document across all nine style/width combinations and inspect content, assets, page size, and editor state.

- [X] T006 [US1] Implement rendered snapshots in `src/renderer/renderer.js` and invisible source-mode measurement in `src/renderer/app.css`; wait for current theme/diagram passes, clone sanitized `#write`, remove copy controls, serialize checkboxes, and preserve mode/selection/zoom.
- [X] T007 [P] [US1] Add `src/renderer/print.css` to remove app backdrop/sheet decoration, reset output geometry, wrap long code, and allow multipage content with sensible heading/table/image breaks.
- [X] T008 [US1] Route `doExportPDF()` in `src/main.js` through the shared output window and `pdfOptions()` in `src/printing.js`; use A4/Letter, backgrounds, and the proper four numeric PDF margin fields.
- [X] T009 [US1] Verify rendered PDF completeness, assets, pagination, and state in `tests/printing.test.js`; record independent extraction of every paragraph/code line and correct paper bounds in `specs/013-document-print-export/quickstart.md`.

**Checkpoint**: Rendered PDF implementation and local output evidence complete.

## Phase 4: User Story 2 - Print the Rendered Document (P1)

**Goal**: Native rendered printing through the same document-only preparation.
**Independent Test**: Verify command/shortcut wiring and native callback outcomes locally; qualify the real dialog/printout separately.

- [X] T010 [US2] Add **Print** with `CmdOrCtrl+P` in `src/menu.js` and its active-session action in `src/main.js`.
- [X] T011 [US2] Implement `doPrint()` in `src/main.js` using required rendered preparation and the shared document-only window, with explicit existing-style error notifications.
- [X] T012 [US2] Implement `printDocument()` in `src/printing.js` with `silent: false`, selected paper size, background printing, and distinct submission/cancellation/error/destruction outcomes.
- [X] T013 [US2] Check rendered menu routing, initial print options, callback success/cancellation/error, and premature output destruction in `tests/printing.test.js`; record that these callbacks are test doubles in `specs/013-document-print-export/quickstart.md`.

**Checkpoint**: Rendered printing implementation complete; physical/native qualification not claimed.

## Phase 5: User Story 3 - Print the Complete Markdown Source (P2)

**Goal**: Literal full-source printing from either mode, without editor viewport capture.
**Independent Test**: Compare output source to complete current editor text, including unsaved markup and final lines, and check mode/appearance preservation.

- [X] T014 [US3] Add `prepare-print-source` in `src/renderer/renderer.js`, returning escaped complete `currentText()` rather than visible editor DOM.
- [X] T015 [P] [US3] Define `#folio-print-source` in `src/renderer/print.css` with black-on-white monospaced wrapping text and multipage flow.
- [X] T016 [US3] Add **Print Source** in `src/menu.js` and source routing in `src/main.js`, reusing the existing shared print lifecycle without changing the current mode.
- [X] T017 [US3] Verify exact full-source equality, multipage source output, mode preservation, and readable source under dark appearance in `tests/printing.test.js`.

**Checkpoint**: Source printing implementation and local snapshot evidence complete.

## Phase 6: Polish and Cross-Cutting Concerns

- [X] T018 Set `1.1.0` in `package.json` and both product fields of `package-lock.json` using npm without a tag or commit; verify consistency with `scripts/package-metadata.js`.
- [X] T019 Add `.github/copilot-instructions.md` requiring one user-selected Major/Minor/Build-patch increment per change set, explicit-target reuse, synchronized manifests, and no implied Git publication.
- [X] T020 [P] Update `README.md` and `docs/user/README.md` for full-document export, both print actions, preserved state, paper/zoom behavior, and current-version examples.
- [X] T021 Run the renderer build, combined printing/task-list/packaging regressions, JavaScript syntax checks, metadata check, and `git diff --check`; record actual results and platform skips in `specs/013-document-print-export/quickstart.md`.
- [X] T022 Review `src/main.js`, `src/preload.js`, `src/printing.js`, and `src/renderer/renderer.js` against the hardened-shell and user-work principles; record source-level compliance and unverified native gates in `specs/013-document-print-export/plan.md`.
- [X] T023 Create and validate the retrospective artifacts in `specs/013-document-print-export/`, mark implementation tasks completed, persist `.specify/feature.json`, and document the installed `1.0.0` single-instance handoff in `README.md` and `specs/013-document-print-export/quickstart.md`.

## Dependencies and Execution Order

### Phase dependencies

Setup T001-T002 establishes the observed defect and regression.
Foundational T003-T005 follows setup and blocks the output integration of all stories.
Stories proceed in recorded priority order: rendered export, rendered printing, then source printing.
Polish follows the implemented stories; version and guide work can use the already confirmed `1.1.0` decision earlier.

### Story dependencies

- US1 depends on the shared foundation, not on either Print menu action.
- US2 depends on the rendered snapshot path from T006-T007 and shared foundation; it does not depend on PDF destination handling in T008.
- US3 depends on the shared foundation and native print lifecycle, not on PDF export; literal source preparation does not require a rendered preview.

### Task dependencies

T003-T005 follow T001-T002.
T006 and T007 share the completed foundation but can be authored independently.
T008 requires T003-T007; T009 verifies T006-T008.
T010-T012 integrate shared rendered preparation; T013 follows those tasks.
T014 and T015 are independent source renderer/CSS work; T016 integrates them with T012; T017 follows T014-T016.
T018-T020 are independent manifest/instruction/guide surfaces after the version decision.
T021 follows implementation and version/docs work; T022 reviews the implemented boundary; T023 closes the retrospective record.

## Parallel Examples

- US1: T006 renderer/measurement work and T007 output stylesheet work touch independent files.
- US2: No marker is added because native lifecycle and main/menu integration share the established output boundary.
- US3: T014 literal-source snapshot and T015 source-only stylesheet work touch independent files.
- Polish: T018 manifests, T019 project instructions, and T020 guide prose touch separate files with the same confirmed version decision.

## Implementation Strategy

The MVP is US1: fix the existing PDF action using the shared foundation and rendered snapshot.
US2 adds native rendered printing without a second layout path.
US3 adds source preparation while reusing the same output lifecycle.
This sequence was implemented locally before the user's retrospective Spec Kit request.
Do not repeat completed tasks, increment the version again, alter branches, or publish Git changes merely to finalize this record.

## Completion and Qualification

All 23 tasks are completed implementation/evidence tasks.
Native dialogs, physical rendered/source printouts, full cross-platform appearance checks, and packaged output are unverified and listed separately in `quickstart.md`.
Checked task markers do not certify those qualification steps.
