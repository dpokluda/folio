# Implementation Plan: Document Printing and Proper PDF Export

**Branch**: `main` (unchanged) | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-document-print-export/spec.md`.

**Status**: Implemented, documented retrospectively; closed 2026-11-05.
The code is in the local working tree based on `d17083c`; no delivery commit, installer, or release was created.
The setup script reports `013-document-print-export` as its feature identifier, not an actual Git branch.

## Summary

Replace printing of the live Folio application page with a separate document-only HTML snapshot and hidden output window.
Reuse that path for PDF export, rendered printing, and literal source printing.
Keep the existing theme contract, complete current editor text, asynchronous diagrams, local assets, and user state.
Set the product version to `1.1.0` and document user-selected version increments in project instructions.
This records already implemented decisions, not a proposal to repeat the work.

## Technical Context

**Language/Version**: JavaScript; CommonJS Electron main/preload modules and ES-module renderer source bundled by esbuild.

**Primary Dependencies**: Existing Electron `43.8.1` in the lockfile, markdown-it, DOMPurify, KaTeX, Mermaid, and CodeMirror.
No dependency was added or upgraded.

**Storage**: User-selected PDF destination and a unique temporary directory containing one output HTML file.
No new persisted preference or document schema.

**Testing**: Node's built-in test runner with real hidden Electron windows in `tests/printing.test.js`.
Existing task-list and packaging tests remain regression gates.
Native callbacks are exercised with test doubles, not actual printer jobs.

**Target Platform**: Windows, macOS, and Linux desktop; local execution evidence is Windows only.

**Project Type**: Existing Electron desktop application.

**Performance Goals**: Bound renderer preparation and output-asset loading separately to 20 seconds.
Do not impose that timeout on time spent in the native print dialog.

**Constraints**: Preserve user state, retain `#write` styling, exclude app chrome, print complete source rather than virtualized editor DOM,
and clean up output windows and temporary files on every exit path.

**Scale/Scope**: One output operation per document window, three existing style families, three page-width choices, and existing appearance choices.

## Constitution Check

This retrospective check distinguishes design compliance from unperformed release qualification.

| Principle / Gate | Result | Evidence |
|---|---|---|
| I. Typora compatibility | Pass | Output retains `#write` and existing app/theme/KaTeX order; output-only CSS follows them. The live editor contract is unchanged. |
| II. Viewing and light editing | Pass | Document consumption only; no WYSIWYG editor or new editing mode. |
| III. Hardened shell | Pass, source review | Sanitized preview and strict Mermaid feed the snapshot; source is escaped. Output is isolated and sandboxed, with no Node or preload bridge, restrictive CSP, and denied navigation/new windows. Requests validate their owning sender. |
| IV. Preserve user work | Pass, local evidence | No disk reload or mode switch. Tests retain text, dirty state, source selection/focus/zoom, and rendered selection. |
| V. Cross-platform parity | Design pass; native qualification not run | Shared APIs and `CmdOrCtrl+P` have no platform branch. Actual dialogs and physical output are unverified. |
| VI. Lean/local | Pass | No new dependency, framework, preference, or service. Existing Electron architecture owns the short-lived output window. |
| Build/regression gates | Pass | Build completed; final implementation run had 47 tests, 43 passed and four platform-specific packaging skips. |
| Manual native smoke/appearance gates | Partial | Hidden-window tests cover all nine light style/width combinations and a Word dark case. Native dialogs, physical printing, and the full platform/appearance matrix were not run. |
| Packaging qualification | Not run | Source/lock version consistency passed metadata checks; no package or installer was produced. |
| Documentation | Pass | README, user guide, project instructions, and retrospective feature artifacts describe behavior and limitations. |
| Spec-first ordering | Recorded exception | Implementation preceded the user's request to make it a Spec Kit feature; these artifacts did not exist beforehand. |

**Post-design re-check**: No new design violation or unresolved technical decision.
Completion means implemented local behavior, not completion of the native matrix in [quickstart.md](./quickstart.md).
The constitution's older description of having no automated suite is historical context; this record uses the existing tests without amending it.

## Project Structure

### Documentation (this feature)

```text
specs/013-document-print-export/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/document-output.md
  checklists/requirements.md
  tasks.md
```

### Source Code (repository root)
```text
src/
  main.js
  menu.js
  preload.js
  printing.js
  renderer/
    renderer.js
    app.css
    print.css
tests/printing.test.js
README.md
docs/user/README.md
.github/copilot-instructions.md
package.json
package-lock.json
```

**Structure Decision**: Keep the existing layout.
`src/printing.js` owns shared output lifecycle and Electron options.
The renderer produces snapshots; `print.css` only affects snapshots.
Generated renderer bundles remain ignored and are rebuilt rather than edited.

## Complexity Tracking

No architectural complexity requires a constitutional exception.
The ordering exception and native verification limits are recorded above rather than presented as completed gates.

## Implemented Flow

1. Menu actions resolve the active session and request rendered/source output through the existing request/response bridge.
2. Required output requests reject on failure/timeout; save requests retain their existing fallback behavior.
3. Rendered preparation waits for theme/diagram work, clones sanitized `#write`, removes copy controls, and serializes checkbox state.
   Source preparation escapes complete `currentText()` into a monospaced block.
4. `withPrintDocument()` loads isolated HTML and waits for explicit stylesheet load/error events, fonts, and image decoding.
5. PDF export uses A4/Letter and 0.75-inch margins; native printing uses `silent: false` and printer-default margins.
6. Native callbacks distinguish submission, cancellation, failure, and window destruction.
   Cleanup removes the hidden window/temporary directory and releases the session output guard.
