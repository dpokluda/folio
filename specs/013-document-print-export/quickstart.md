# Validation Guide: Document Printing and Proper PDF Export

**Date**: 2026-11-05
**Status**: Local implementation verified; native printing and packaged checks not run.

## Prerequisites

Use the Node version and installed dependencies described in the README.
Electron tests need a graphical session, or Xvfb on Linux.
A physical printer is needed only for native qualification below.

Save work and quit installed or older Folio copies using **File > Quit** before launching this checkout.
Development and packaged copies share a single-instance lock.
If an older copy is running, `npm start` hands control to it rather than replacing its code.
That was confirmed to be why installed `1.0.0` appeared instead of checkout `1.1.0` while this record was being written.
Do not terminate a dirty process just to run tests.

## Local commands

Run from the repository root:

```sh
npm run build:renderer
node --test tests/printing.test.js tests/task-list-layout.test.js tests/packaging.test.js
node scripts/package-metadata.js
npm start
```

Check **Help > About Folio** for `1.1.0` and the File menu for **Print** and **Print Source**.
See [document-output.md](./contracts/document-output.md) for menu, paper, response, and cancellation semantics.
The printing test uses the real renderer/preload in hidden Electron windows and temporary PDFs.
Native printer outcomes use test callbacks, not actual dialogs or physical jobs.

## Recorded local evidence

The implementation session on 2026-11-05 recorded:

| Check | Result | Scope |
|---|---|---|
| Initial regression | Expected failure | Print absent; preparation returned a boolean instead of document HTML |
| Renderer build | Passed | esbuild and local rendering assets |
| Combined tests | 47 tests: 43 passed, four skipped | Windows; pre-existing macOS/POSIX packaging skips |
| Version metadata | Passed | Source/lock `1.1.0`, Windows product `1.1.0.0` |
| Independent PDF extraction | Passed | All 70 paragraphs, 110 code lines, end markers, and unsaved edit in nine rendered PDFs and one source PDF |
| PDF size/text bounds | Passed | A4/Letter and expected horizontal bounds |
| First-page inspection | Passed | Image, formula, task list, diagram, and document text without app controls |
| Light style/width matrix | Passed | Fluent/GitHub/Word with Dynamic/A4/Letter |
| Dark checks | Passed | Word contrast; black-on-white source |
| Print outcomes | Passed with doubles | Submission, cancellation, error, premature destruction |
| Failure cleanup | Passed | Output callback failure and missing stylesheet |
| Old-launch diagnosis | Confirmed | Installed `1.0.0` process; checkout `1.1.0`; shared lock handoff |

Earlier captured acceptance PDFs had 9-14 rendered pages and 12 source pages.
Temporary inspection artifacts were cleaned up.
This records checks already run in the implementation session, not newly claimed native tests.

## Manual acceptance scenarios

1. Export a long document with headings, numbered paragraphs, a long code block, image, formula, and diagram in every style/width choice.
   Check final content, selectable text, assets, and absence of app controls.
2. Make an unsaved source edit, select text, and change zoom.
   Export without leaving source; check the edit and unchanged mode/selection/zoom/dirty state.
3. Choose **File > Print** or `Ctrl/Cmd+P`.
   Confirm a native dialog for the current rendered document; print and check first/final pages.
4. Choose **File > Print Source** from both modes.
   Check full literal markup and final source lines on physical output.
5. Cancel each output dialog; confirm no submission or document work loss.
6. Print/export two distinct windows; confirm content isolation.
   Attempt overlapping output for one document and check the explicit busy error.
7. Check light/dark/system appearance, redraws, untitled/help copies, a missing image, and a failing PDF destination.
   Confirm readable output or a clear failure without discarded edits.

## Native qualification not run

| Qualification | Status |
|---|---|
| Windows native dialog and physical rendered/source output | Not run |
| macOS native dialogs and physical output | Not run |
| Linux native dialogs and physical output | Not run |
| Full platform/appearance matrix | Not run |
| Multiple-window native and concurrent-dialog smoke checks | Not run |
| Packaged 1.1.0/installer output | Not run; no package built |

These are qualification limitations, not completed implementation tasks.
Record actual results here when environments are available.
Do not infer physical output from callback tests or other platform dialogs from Windows hidden-window checks.

## Completion meaning

Implementation and its task record are completed locally and remain uncommitted.
The requirements-quality checklist is complete but does not certify native qualification.
This retrospective record requires no second version increment, branch change, commit, push, package, or release.
