# Implementation Plan: Themed Markdown Viewer & Source Editor

**Branch**: `001-markdown-viewer-editor` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-markdown-viewer-editor/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `bd8f5ef`, `578e52e`, `ec3e6f4`, `9c3abe5` (2026-07-09), `946b5a4`, `6bf8c90` (2026-07-13), `abc8522`, `8062af5` (2026-07-14), `664668d` (2026-08-06) and `5c3ee89` (2026-08-20), plus the reconciling merge `ff19412`. This plan describes the design as implemented and notes where later features (004, 005, 007, 010) changed it.

## Summary

Feature 001 is the whole single-document Folio app. The Electron main process (`src/main.js`) owns
the window, the native menu (`src/menu.js`), file I/O (New, Open, Open Recent, Save, Save As,
Reload from Disk, Export to PDF through `printToPDF`), the unsaved-changes guard, a 1-second polling
watcher for live reload, and a small JSON settings store (`src/store.js`). One esbuild-bundled
renderer (`src/renderer/renderer.js`) renders Markdown with markdown-it plus GitHub-flavored
plugins, sanitizes the result with DOMPurify, and injects it into Typora's `#write` page container,
so unmodified Typora themes style the page. A lazily created CodeMirror 6 editor under
`#typora-source`, carrying the legacy `.CodeMirror` class and the `typora-sourceview-on` body class,
provides the themed source mode. The renderer talks to the main process only through the narrow
`window.folioAPI` contextBridge (`src/preload.js`). The status bar (stats and mode buttons), the
outline sidebar and zoom are Folio-owned chrome outside the selectors that themes target.

## Technical Context

**Language/Version**: JavaScript. The main process is CommonJS; the renderer is ES modules bundled by esbuild into a single IIFE targeting `chrome120`. Electron `^31.3.1` at `bd8f5ef`, upgraded to `^43.2.0` in `57f8363` (2026-08-03, owned by 002) without changes to this feature's code.

**Primary Dependencies**: markdown-it `^14.1.0` with markdown-it-task-lists `^2.1.1`, markdown-it-footnote `^4.0.0` and markdown-it-emoji `^3.0.0` (full set); highlight.js `^11.10.0` for fence coloring at 001 (replaced by `@codemirror/legacy-modes` in `5c3ee89`, see 010); CodeMirror 6 (`codemirror` `^6.0.1`, `@codemirror/state` `^6.4.1`, `@codemirror/view` `^6.29.0`, `@codemirror/commands` `^6.6.0`, `@codemirror/language` `^6.10.2`, `@codemirror/lang-markdown` `^6.3.0`, `@codemirror/search` `^6.5.6`); dompurify `^3.1.6` (added in `8062af5`). Development: esbuild `^0.23.0`; electron-builder `^24.13.3` (packaging belongs to 002).

**Storage**: Local Markdown files, read and written as UTF-8 through `fs`. App preferences live in `folio-settings.json` under Electron `userData`, owned by `src/store.js` (see [data-model.md](./data-model.md) and [contracts/settings-schema.md](./contracts/settings-schema.md)).

**Testing**: No automated tests; manual verification per constitution quality gates and quickstart.md.

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: An external change appears within about 1–2 s (1000 ms `fs.watchFile` poll). A main→renderer content request times out after 4 s (export preparation after 20 s since `1ce68e0`), so a stuck renderer cannot hang Save. Status-bar statistics are recomputed on each edit in O(n) over the source text. The whole document is re-rendered only on load, mode switch and reload, never per keystroke.

**Constraints**: Offline and local only; network is used only for `https:` images that a document references. `contextIsolation: true` and `nodeIntegration: false`; the CSP keeps `script-src 'self'`; no `executeJavaScript` into the page since `8062af5`. Unreadable settings fall back to defaults.

**Scale/Scope**: One document per window (multiple windows are 007), at most 10 recent files, one polled watcher per open file, and documents of everyday note size, since every render re-renders the whole document.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated retroactively against Folio Constitution v1.0.0 (ratified 2026-10-18) for the code this feature delivered.

| Principle / Gate | Result | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | ✅ Pass | `src/renderer/index.html` provides `#write` and `#typora-source`. `createEditor()` adds the `CodeMirror` class through `EditorView.editorAttributes`. `setSourceMode()` toggles `body.typora-sourceview-on` only while source mode is on. `app.css` loads before the theme, and the page backdrop comes from `var(--bg-color)` (`578e52e`). At 001 the theme was one `<link id="theme-style">` and fences carried highlight.js classes. The ordered `link.folio-theme` stack (004) and Typora `.cm-*` fence tokens (010, `5c3ee89`) bring today's code to the full rule (flow-forward). |
| II. Complement Typora: View and Lightly Edit | ✅ Pass | The preview is read-only and editing happens only in source mode. Typora conventions are followed: `Ctrl/Cmd+/` toggle, status bar, outline, paged sheet. The non-affiliation disclaimer is in README and in `showAbout()`. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass (since `8062af5`) | `createWindow()` sets `contextIsolation: true` and `nodeIntegration: false`. `window.folioAPI` has only narrow channels ([contracts/ipc-channels.md](./contracts/ipc-channels.md)). `DOMPurify.sanitize` runs before `#write` injection, the CSP has `script-src 'self'`, `setWindowOpenHandler` denies and `will-navigate` blocks non-`file://` URLs, `open-external` validates `^https?://`, and `executeJavaScript` was replaced by `folio-request`/`folio-response`. `bd8f5ef` shipped without these; see research.md finding 12. Non-Markdown local link targets are 005. |
| IV. Never Lose the User's Work | ⚠️ Partial | `promptUnsaved()` and `confirmDiscardIfDirty()` guard New, Open…, the Help guides, Reload from Disk, window close and quit. A failed or cancelled Save aborts the action (`8062af5`). The `•` title marker, ask-first live reload defaulting to "Keep My Changes", untitled bundled guides and the JSON settings fallback are all in place. **But** `actions.openRecent` calls `loadFile()` without the guard, which contradicts "This covers … Open Recent" (research.md finding 4). Per-window `Session` state arrived with 007. |
| V. Cross-Platform Parity | ✅ Pass | Accelerators use `CmdOrCtrl`. The Windows/Linux zoom-key handling (`664668d`) sits behind a platform check with comments giving the reason and evidence. `disable-lcd-text` applies on every platform on purpose, for identical grayscale text, with its Windows evidence in a comment. |
| VI. Lean, Local, and Self-Contained | ✅ Pass | Fully offline with no telemetry; every dependency is bundled. `src/store.js` replaces electron-store (the precedent). The main process is CommonJS, with one esbuild renderer bundle and no UI framework. Each dependency serves a spec requirement (rendering, editing, sanitizing). The watcher is bounded to one file per window, polled every 1 s. |
| Workflow & Quality Gates | ⚠️ Documentation drift | Gates 1, 2, 3 and 5 apply: renderer build, smoke test including the unsaved guard, Light/Dark (available from 004), and a Principle III review for sanitization, CSP and external opening. They are exercised in [quickstart.md](./quickstart.md). **Documentation gate**: README omits live reload and File ▸ Reload from Disk and still credits highlight.js, and the bundled Welcome names pre-004 themes (research.md findings 1–3). |

**Post-design re-check** (after Phase 1): the data model and contracts add nothing beyond what is evaluated above. The two ⚠️ rows are unplanned defects or drift found during retroactive documentation, not design trade-offs. They stay open and are logged in [research.md](./research.md#retroactive-findings) for a follow-up spec.

## Project Structure

### Documentation (this feature)

```text
specs/001-markdown-viewer-editor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── menu-commands.md
│   ├── ipc-channels.md
│   ├── typora-dom-contract.md
│   ├── dialogs-and-title.md
│   └── settings-schema.md
├── checklists/
│   └── requirements.md  # /speckit-specify quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json             # scripts + dependencies (bd8f5ef); dompurify added (8062af5)
package-lock.json        # lockfile (bd8f5ef, 8062af5)
build.js                 # esbuild renderer bundler (bd8f5ef)
.gitignore               # node_modules, bundle, release/, Aptos fonts (bd8f5ef)
README.md                # user manual (bd8f5ef, 578e52e)
samples/
├── welcome.md           # launch Welcome document (bd8f5ef → f96fc39 → ec3e6f4)
└── formatting-tour.md   # Help ▸ Markdown Formatting Tour (ec3e6f4)
src/
├── main.js              # window, actions, file I/O, unsaved guard, watcher, export, IPC handlers
├── menu.js              # native menu template (File, Edit, View, Themes, Help)
├── preload.js           # window.folioAPI contextBridge
├── store.js             # JSON settings store in userData
└── renderer/
    ├── index.html       # CSP, outline aside, #write, #typora-source, status bar
    ├── renderer.js      # render pipeline, sanitizer, source editor, outline, stats, zoom
    └── app.css          # chrome + CodeMirror→Typora compat + front-matter box
themes/                  # bd8f5ef: flat fluent*.css and microsoft-word*.css set (restructured by 004)
```

**Structure Decision**: Keep the two-process Electron layout the constitution mandates. CommonJS
main-process modules in `src/` hold everything that touches the OS: files, dialogs, menus, watching,
printing and settings. A single esbuild-bundled renderer in `src/renderer/` holds everything that
touches the DOM. `src/preload.js` is the only bridge between them. Bundled documents live in
`samples/` and ship inside the app archive. No new top-level directories were introduced. Later
features add to these same files (`src/folder.js` arrives with 005, `src/renderer/highlight.js` with
010).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

No violations — table intentionally empty. (The ⚠️ rows above are unplanned defects and documentation drift found during retroactive documentation, not justified design trade-offs; see research.md → Retroactive findings.)
