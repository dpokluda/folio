# Implementation Plan: Folder Mode, Link Navigation & Back/Forward History

**Branch**: `005-folder-mode-navigation` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-folder-mode-navigation/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `e2e2877`, `356cf20`, `4a9cc98` (Close Folder only), `8062af5` (guarded external open and folder refinements only), `f8f17fa` and `4ebcdb2`; describes the design as implemented, with later changes by other features noted where they alter this feature's behavior (`5c48052` in 003, `68e67be` in 008).

## Summary

Folder mode adds a left-hand file explorer that lists a directory's Markdown files, in-place navigation for links between documents (relative and `/`-rooted paths, folder index documents, GitHub-style `#anchors`), guarded hand-off of web links and non-Markdown files to the operating system, a link-target hover hint, File > Close Folder, and a per-window Back/Forward history.

Technical approach (as built): a new Electron-free module, `src/folder.js`, scans a folder into a pruned, sorted, depth-capped tree, picks a folder's entry or index document, and resolves a click into a typed target (`markdown`, `folder-empty`, `external`, `missing`). The main process (`src/main.js`) owns every file-system access, dialog, the unsaved-changes guard, the OS hand-off (`openExternalTarget`) and the per-window `Session` state (`currentFolder`, `history`, `historyIndex`). The renderer (`src/renderer/renderer.js`) only draws the explorer, intercepts preview link clicks and forwards them over one new invoke channel, `navigate`; main pushes trees over one new event channel, `open-folder`, and reuses `load-document` (now carrying an `anchor`) for every displayed file.

## Technical Context

**Language/Version**: JavaScript. CommonJS in the main process (`src/main.js`, `src/menu.js`, `src/preload.js`, `src/folder.js`, `src/store.js`); ES modules in the renderer, bundled by esbuild (^0.23.0) into the generated `src/renderer/bundle.js`.

**Primary Dependencies**: Electron ^31.3.1 at the time of these commits (2026-07-14 to 2026-07-20), upgraded to 43.2.0 in `57f8363` (2026-08-03) without changes to the APIs used here: `dialog.showOpenDialog` (`openDirectory`), `dialog.showMessageBox`, `shell.openExternal`, `shell.openPath`, `ipcMain.handle`/`ipcMain.on`, `contextBridge`, `Menu`, `webContents.setWindowOpenHandler` and the `will-navigate` event. Node built-ins `fs`, `path` and `url` (`fileURLToPath`, `pathToFileURL`) in `src/folder.js`. The rendering pipeline of 001 (markdown-it ^14 with `linkify`, DOMPurify ^3.1.6 from `8062af5`) decides which links reach the preview. No new runtime dependency.

**Storage**: Read-only access to the opened folder on the local file system. Two keys in `folio-settings.json` (Electron `userData`, owned by `src/store.js`): `folder` and `filesVisible`. Folder and history state are in memory on each window's `Session`.

**Testing**: No automated tests; manual verification per constitution quality gates and [quickstart.md](./quickstart.md). `src/folder.js` is Electron-free and can be exercised in plain Node.

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: Explorer clicks, link clicks and Back/Forward respond immediately: a click costs one `stat` (plus one directory read for a folder link) and one file read. The folder scan is a single synchronous walk that runs only when a folder is opened, never per click.

**Constraints**: Scan bounded by `MAX_TREE_DEPTH = 16`, hidden entries and `SKIP_DIRS` (`node_modules`, `.git`, `.obsidian`, `.vscode`, `.idea`) skipped, Markdown-only (`MD_EXTS`, 7 extensions). The renderer never touches the file system; every resolution happens in the main process. Every document-replacing action passes `confirmDiscardIfDirty`. Only `http(s)` URLs reach the system browser. Per-window state lives on `Session`. Fully offline.

**Scale/Scope**: 1 new module (`src/folder.js`, 144 lines in `e2e2877`; it also hosts the Find in Files helpers of 006 today); 2 new channels (`navigate`, `open-folder`) plus new fields on `get-init`, `load-document`, `command` and `state-changed`; 5 menu items (Open Folder…, Close Folder, Toggle File Explorer, Back, Forward); 1 status-bar button; 2 settings keys; 2 chrome elements (explorer pane, link hint). Roughly 630 lines added in `e2e2877`, 100 in `4ebcdb2` and 110 in `f8f17fa` (excluding README punctuation edits). No cap on the number of files listed; folders are expected to be documentation or notes trees.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Folio Constitution v1.0.0 (`.specify/memory/constitution.md`).

| Principle / Gate | Status | Evidence |
|------------------|--------|----------|
| I. Typora Theme Compatibility | ✅ Pass | The explorer (`aside#folio-files`) and the hint (`div#folio-link-hint`) are Folio chrome outside `#write`, styled in `src/renderer/app.css`, which loads before the `link.folio-theme` layers; both have light rules plus overrides in the `@media (prefers-color-scheme: dark)` block, so Appearance (004) applies through `nativeTheme`. Heading `id` attributes are added inside `#write` without changing its structure; `#typora-source` and `typora-sourceview-on` are untouched. |
| II. Complement Typora | ✅ Pass | The feature serves viewing and navigating local Markdown. The explorer sits beside the outline pane and its **Files** toggle sits in the Typora-style status bar next to **Outline**; the preview stays read-only. |
| III. Untrusted Documents, Hardened Shell | ⚠️ Pass with note | New bridge surface is two narrow members in `src/preload.js` (`navigate` invoke, `onOpenFolder` listener); no generic file-system bridge. All file access is in main and `src/folder.js`. `open-external` (from `bd8f5ef`) passes only `^https?://`. `createWindow()` denies `window.open` (`setWindowOpenHandler`) and blocks non-`file://` top-frame navigation (`will-navigate`), sending `http(s)` to `shell.openExternal` (`8062af5`). `openExternalTarget()` refuses `\\`/`//` paths and the 28 `UNSAFE_OPEN_EXTENSIONS`, and otherwise asks for confirmation showing `path.resolve(target)` with Cancel as default (`8062af5`). `navigate` resolves the session from `event.sender`. **Note**: it resolves relative links against the renderer-supplied `fromPath` and accepts explorer `path`s without checking them against `session.currentFolder` (see Complexity Tracking), and it `stat`s a UNC target before `openExternalTarget()` refuses it (research.md, findings 14–15). |
| IV. Never Lose the User's Work | ✅ Pass | `confirmDiscardIfDirty()` runs in `doOpenFolder()` (before the picker), `doCloseFolder()`, the `navigate` handler (`markdown` kind) and `navigateHistory()`; Cancel returns before any state changes. Folder and history live on `Session` (`currentFolder`, `history`, `historyIndex`). Close Folder shows Welcome through `loadBuiltinDoc()` as an untitled document. The `folder`/`filesVisible` store keys are app-wide records, not live per-window state. |
| V. Cross-Platform Parity | ✅ Pass | `CmdOrCtrl+Shift+O` and `CmdOrCtrl+Shift+W`; the Go menu uses `Cmd+[`/`Cmd+]` on macOS and `Alt+Left`/`Alt+Right` elsewhere, the alternative the constitution names. Toggle File Explorer's Windows/Linux label-plus-keystroke workaround (from `68e67be`, 008) is isolated behind `isMac` in `src/menu.js` and a non-Mac `keydown` handler in `src/renderer/renderer.js`, both commented. Paths: `/` is converted to `path.sep`, and index-file matching is case-insensitive on every platform (`8062af5`). README documents the per-platform Back/Forward keys. Note: on Windows, absolute links written with a drive letter (`C:/…`) are stripped by 001's sanitizer, so absolute links must be `/`-rooted there; relative links, the documented use, behave identically on all platforms (research.md, finding 6). |
| VI. Lean, Local, Self-Contained | ✅ Pass | No new dependency; `src/folder.js` requires only `fs`, `path` and `url` and loads in plain Node. The scan is bounded (depth 16, skip list, Markdown-only, unreadable folders return `[]`) and runs once per Open Folder. Works offline. |
| Quality Gates & Documentation | ⚠️ See note | Gate 1 (`npm run build:renderer`), gate 2 (smoke test including the unsaved-changes guard), gate 3 (explorer and hint in Light and Dark, every Style) and gate 5 (Principle III review of `navigate`, `open-folder` and external opening) apply; gate 4 is N/A (no packaging change; the folder launch argument belongs to 003). README was updated in `e2e2877`, `356cf20`, `4a9cc98` and `4ebcdb2`, but the hover hint from `f8f17fa` was never documented, and README's "the last opened folder is remembered between launches" has been stale since `5c48052`. Both are listed in [research.md](./research.md) → Retroactive findings. |

**Post-design re-check (after Phase 1)**: [data-model.md](./data-model.md), [contracts/](./contracts/) and [quickstart.md](./quickstart.md) introduce no new channel, dependency or persistent state beyond what is listed above. The two ⚠️ notes stand: the Principle III note is justified in Complexity Tracking, and the documentation drift is tracked as a follow-up. No unjustified violation remains.

## Project Structure

### Documentation (this feature)

```text
specs/005-folder-mode-navigation/
├── spec.md                  # Feature specification (/speckit-specify)
├── plan.md                  # This file (/speckit-plan)
├── research.md              # Phase 0 output (/speckit-plan)
├── data-model.md            # Phase 1 output (/speckit-plan)
├── quickstart.md            # Phase 1 output (/speckit-plan)
├── contracts/               # Phase 1 output (/speckit-plan)
│   ├── menu-commands.md     # File/View/Go items, accelerators, enablement
│   ├── ipc-channels.md      # navigate, open-folder and extended existing channels
│   ├── link-navigation.md   # click classification, resolution, external-open guard, anchors, hint
│   └── explorer-ui.md       # scan rules, explorer/hint chrome, settings keys
├── checklists/
│   └── requirements.md      # Spec quality checklist (/speckit-specify)
└── tasks.md                 # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── folder.js        # NEW (e2e2877): MD_EXTS, SKIP_DIRS, MAX_TREE_DEPTH, isMarkdownFile, scanFolder,
│                    #   entryDocFor, folderIndexDoc, resolveNavTarget; INDEX_DOC_NAMES (8062af5)
├── main.js          # Folder state, doOpenFolder/openFolder, loadFile(anchor, { record }), 'navigate' handler,
│                    #   get-init folder payload (e2e2877); doCloseFolder/loadBuiltinDoc (4a9cc98);
│                    #   openExternalTarget, UNSAFE_OPEN_EXTENSIONS, window-open/will-navigate guards,
│                    #   per-Session folder handlers (8062af5); history functions and Go actions (4ebcdb2)
├── menu.js          # File > Open Folder… (e2e2877, remapped 356cf20), File > Close Folder (4a9cc98),
│                    #   View > Toggle File Explorer (e2e2877), Go > Back / Forward (4ebcdb2)
├── preload.js       # folioAPI.navigate, folioAPI.onOpenFolder (e2e2877)
├── store.js         # DEFAULTS.filesVisible, DEFAULTS.folder (e2e2877)
└── renderer/
    ├── index.html   # #folio-files pane and #btn-files (e2e2877); #folio-link-hint (f8f17fa)
    ├── renderer.js  # explorer tree, sync and toggle, wireLinks/navigateTo, githubSlug/assignHeadingIds/
    │                #   scrollToAnchor (e2e2877); collapsed start (356cf20); setFolder(payload, !!payload)
    │                #   (4a9cc98); link hover hint (f8f17fa)
    └── app.css      # explorer pane styles, light and dark (e2e2877); hint styles (f8f17fa)
README.md            # Features, How to use (Open a folder, Close Folder, Go back / forward), Project layout
```

**Structure Decision**: Folio's single-project Electron layout is kept, as constitution VI requires. Pure logic goes into the new Electron-free `src/folder.js`. Privileged work (file system, dialogs, OS hand-off, unsaved-changes guard, history) stays in `src/main.js` on the per-window `Session`. The bridge grows by two narrow members in `src/preload.js`, and presentation lives in the single esbuild-bundled renderer. No new process type, UI framework or dependency was introduced.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `navigate` resolves relative links against the renderer-supplied `fromPath` and accepts explorer `path`s without checking them against `session.currentFolder` (Principle III: handlers "MUST NOT rely on state supplied by the renderer"). | Only the renderer knows which link or tree row was clicked. `fromPath` mirrors `session.currentPath`, which main itself sent in `load-document`, and explorer paths come from the tree main produced. Every outcome is bounded: Markdown targets are only displayed (sanitized by 001), anything else passes `openExternalTarget()` (blocks plus confirmation), and every dialog shows the resolved path. | Not rejected on merit. Resolving against `session.currentPath` and refusing explorer paths outside `session.currentFolder` is simple; the shipped design predates the constitution (ratified 2026-10-18), and the hardening is recorded as a follow-up in [research.md](./research.md). |

The ⚠️ under Quality Gates & Documentation is a documentation defect, not a design choice, so it is not justified here; it is tracked in [research.md](./research.md) → Retroactive findings for a README update.
