# Implementation Plan: Source Formatting Commands, Line Numbers & Copy File Path

**Branch**: `008-source-editing-tools` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-source-editing-tools/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commit `68e67be` (2026-07-16), using only its formatting, line-number and copy-path changes. The same commit's KaTeX math rendering belongs to [009](../009-math-typesetting/spec.md) and its icon artwork to [002](../002-cross-platform-packaging/spec.md). The relevant code in `src/` has not changed since that commit. This plan describes the design as implemented.

## Summary

Source mode gets fifteen Markdown formatting commands, an optional line-number gutter and a Copy File Path command (see [spec.md](./spec.md)).

**Formatting commands.** A new **Format** menu in `src/menu.js` lists Bold, Italic, Underline, Strikethrough, Inline Code, Code Block, Link, Inline Math, Math Block and Heading 1–6. Its accelerators are display-only (`registerAccelerator: false`). The keystrokes are handled by a `formattingKeymap` that `src/renderer/renderer.js` installs in the CodeMirror 6 source editor with `Prec.highest`, so it outranks CodeMirror's default bindings and the browser's native Ctrl+B/I/U. A menu click goes through `actions.format(kind)` in `src/main.js` to a `{ name: 'format', format }` command for the focused window, where `applyFormat(kind)` runs the same text transforms. The four transforms are `toggleWrap`, `setHeading`, `insertLink` and `insertFencedBlock`. Each runs as one transaction and computes its changes per selection range with `changeByRange` (or from the lines the selection covers). In the rendered preview, `applyFormat` makes no edit and shows a hint. Ctrl/Cmd+Shift+E becomes Code Block, so View > Toggle File Explorer and Toggle Outline move to Ctrl/Cmd+Alt+E and Ctrl/Cmd+Alt+O. On Windows and Linux those items carry the shortcut text in their label, and a renderer key handler runs the toggles.

**Line numbers.** The gutter sits in a CodeMirror `Compartment` that is reconfigured live. The choice is stored as the app-wide setting `lineNumbers` (default `false`) in `folio-settings.json` and shown as a View checkbox.

**Copy File Path.** The command runs entirely in the main process: Electron `clipboard` writes the focused Session's `currentPath`. A new reusable, accessible toast (`#folio-toast`) confirms the copy and also shows the formatting hint.

## Technical Context

**Language/Version**: JavaScript (ES2020+). The main process uses CommonJS modules (`src/main.js`, `src/menu.js`, `src/store.js`); the renderer uses ES modules that esbuild bundles into `src/renderer/bundle.js`.

**Primary Dependencies**: Electron ^31.3.1 at the time (`Menu` templates with `registerAccelerator`, `clipboard`, `webContents.send`). Electron was upgraded to 43.2.0 in `57f8363` (2026-08-03) without changes to this feature. CodeMirror 6, already bundled: `@codemirror/state` ^6.4.1 (`EditorSelection`, `Compartment`, `Prec`), `@codemirror/view` ^6.29.0 (`keymap`, `lineNumbers`) and `@codemirror/commands` ^6.6.0 (the default and history keymaps that the formatting keymap must outrank). **No new dependencies.** The `katex` and `@vscode/markdown-it-katex` packages added in the same commit belong to 009.

**Storage**: `folio-settings.json` in Electron `userData`, owned by `src/store.js`, gains the boolean key `lineNumbers` (default `false`). The system clipboard receives plain text and is written only by the main process.

**Testing**: No automated tests; manual verification per constitution quality gates and quickstart.md.

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**:
- Each Format command is one editor transaction that touches only the selection, or the lines it spans, so it is instant at any document size.
- Toggling line numbers reconfigures the live editor without rebuilding it or reloading the document.
- The toast stays fully shown for 1600 ms, then fades out (0.18 s CSS transition) and is removed 220 ms later, so it is gone within 2 s.

**Constraints**:
- Formatting only edits Markdown text in source mode. The preview is never an editing surface (Principle II).
- A Format keystroke must be handled once, by the editor, and must not also fire through the menu.
- No new preload or IPC surface (Principle III).
- The Typora DOM contract (`#write`, `#typora-source`, `.CodeMirror`, `typora-sourceview-on`, theme layer order) stays unchanged (Principle I).
- Ctrl+Alt shortcuts must read in the conventional modifier order on Windows and Linux.

**Scale/Scope**:
- 15 Format commands: 6 inline wraps, 6 heading levels, a link, and 2 fenced blocks.
- 1 View checkbox, 1 File command, 2 moved View shortcuts, 1 toast element and 1 settings key.
- About 250 added renderer lines, out of roughly 410 added lines across 7 touched files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Folio Constitution v1.0.0 (`.specify/memory/constitution.md`).

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility (NON-NEGOTIABLE) | ⚠️ Pass, with finding | Unchanged: `#write`, the `#typora-source` mount, the `.CodeMirror` compatibility class (`EditorView.editorAttributes`), `typora-sourceview-on` and the `folio-theme` layer order. The gutter renders inside `#typora-source`. Its styling lives in `src/renderer/app.css`, which loads before the theme layers, so a theme can still override it. The new chrome element `#folio-toast` has a light palette plus an override in the `@media (prefers-color-scheme: dark)` block. **Finding:** the line-number rule's `color: currentColor` inherits CodeMirror's built-in gutter grey instead of the theme's text color, so in practice the numbers have no appearance-specific palette. See [research.md](./research.md#retroactive-findings). |
| II. Complement Typora: View and Lightly Edit | ✅ Pass | Format commands edit Markdown text only in the source editor. In the preview, `applyFormat` declines with a hint, so there is no WYSIWYG editing. Shortcuts match Typora's for Bold, Italic, Underline, Link, Heading 1–6 and Math Block (Windows/Linux), and Underline uses `<u>` like Typora. Inline Code, Strikethrough and Code Block use different chords, a deviation from a SHOULD-level rule; it is recorded in research.md §6. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | `src/preload.js` gets no new method and there is no new renderer→main channel. Menu actions start in the main process and reach the renderer on the existing `command` channel (`format`, `toggle-line-numbers`, `toast`). `state-changed` accepts `lineNumbers` only when `typeof` is `'boolean'`. The clipboard is written in main from the focused window's `Session.currentPath`, never from data supplied by the renderer. Toast text is assigned with `textContent`. The CSP, sanitization and navigation guards are untouched. |
| IV. Never Lose the User's Work | ✅ Pass | Formatting edits go through the editor's `updateListener`, so `recomputeDirty()` marks the title with `•`, and CodeMirror `history()` makes them undoable. No command replaces or discards the document, so no unsaved-changes guard is involved. Copy File Path only reads state. `lineNumbers` is an app-wide view toggle in the shared store, which IV allows. A missing key or an unreadable settings file falls back to the `DEFAULTS` value `false`. |
| V. Cross-Platform Parity | ✅ Pass | Menu accelerators use `CmdOrCtrl`, and CodeMirror's `Mod-` maps to Cmd or Ctrl. The Ctrl+Alt label workaround (`ctrlAltItem`) sits behind `isMac` with a comment giving the reason: the Windows menu renderer prints "Alt+Ctrl+…". The matching renderer keydown handler sits behind a non-Mac check. README documents every shortcut as Ctrl/Cmd. Platform nuances are recorded in research.md: macOS ignores `registerAccelerator: false`, and Windows reports AltGr as Ctrl+Alt. |
| VI. Lean, Local, and Self-Contained | ✅ Pass | No new dependency. The feature uses `EditorSelection`, `Compartment` and `Prec` (`@codemirror/state`), `keymap` and `lineNumbers` (`@codemirror/view`), and Electron `clipboard`, all already present. It makes no network calls. The commands are small text transforms inside the existing single renderer bundle. |
| Quality Gates & Documentation | ⚠️ Pass, with drift | Gates 1–3: `npm run build:renderer`, a smoke test of every command in both views, and the Light/Dark × Fluent/GitHub/Microsoft Word check for gutter and toast ([quickstart.md](./quickstart.md) §8). Gate 4 is N/A: nothing about packaging, launch or OS integration changes. Gate 5: the new payloads were reviewed under Principle III above. Documentation: README.md was updated in the same commit (Format, Line numbers, Copy file path, moved pane shortcuts), but its "toggles it back off" sentence over-generalizes, and it omits the rendered-view hint and the disabled state for untitled documents. This drift is recorded in research.md. |

**Post-design re-check (after Phase 1)**: unchanged. The [research.md](./research.md), [data-model.md](./data-model.md) and [contracts/](./contracts/) introduce no new conflicts. Both ⚠️ rows are retroactive findings about the shipped stylesheet and README, not planned violations, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-source-editing-tools/
├── spec.md                       # Feature specification (/speckit-specify)
├── checklists/
│   └── requirements.md           # Spec quality checklist (/speckit-specify)
├── plan.md                       # This file (/speckit-plan command output)
├── research.md                   # Phase 0 output (/speckit-plan command)
├── data-model.md                 # Phase 1 output (/speckit-plan command)
├── quickstart.md                 # Phase 1 output (/speckit-plan command)
├── contracts/                    # Phase 1 output (/speckit-plan command)
│   ├── menu-commands.md          # Format / View / File items, accelerators, routing
│   ├── formatting-commands.md    # Text-transformation contract per Format command
│   ├── ipc-channels.md           # New `command` payloads, `state-changed` / `get-init` fields
│   ├── settings-schema.md        # `lineNumbers` key in folio-settings.json
│   └── ui-elements.md            # Toast element and line-number gutter styling contract
└── tasks.md                      # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Only the files this feature touched in `68e67be` (verified with `git show --stat 68e67be`):

```text
README.md                    # How to use: Format, Line numbers, Copy file path, moved pane shortcuts
src/
├── main.js                  # actions.format / copyPath / toggleLineNumbers, copyDocumentPath(),
│                            # get-init + state-changed `lineNumbers`, rebuildMenu() input
├── menu.js                  # Format menu (fmt helper), File > Copy File Path,
│                            # View > Show Line Numbers, ctrlAltItem pane toggles
├── store.js                 # DEFAULTS.lineNumbers = false
└── renderer/
    ├── app.css              # #folio-toast (+ dark override), line-number gutter rules
    ├── index.html           # <div id="folio-toast" role="status" aria-live="polite">, tooltips
    └── renderer.js          # formatting commands + keymap, line-number compartment,
                             # showToast(), payload-aware handleCommand(), Ctrl+Alt handler
```

The commit also changed `.gitignore`, `build.js`, `package.json` and `package-lock.json` (KaTeX, part of 009) and `build/icons/*` (002). Those changes are outside this feature.

**Structure Decision**: Keep the existing single Electron app layout and add no new modules. The formatting transforms stay in `src/renderer/renderer.js` next to `createEditor()`, because they operate directly on the CodeMirror `EditorView` and must share its keymap and compartments. Menu definitions stay in `src/menu.js` (a pure template builder), and routing plus the clipboard stay in `src/main.js`, where per-window Sessions live. The persisted default goes in `src/store.js`. This follows the constitution's architecture rule (CommonJS main modules, one esbuild-bundled renderer, no UI framework).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

No violations — table intentionally empty.
