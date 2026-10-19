# Implementation Plan: Multiple Independent Windows

**Branch**: `007-multiple-windows` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-multiple-windows/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `8062af5` (2026-07-14), `87e9165` (2026-08-06) and `5b4fe2e` (2026-08-10). It describes the design as implemented. From `8062af5` it covers only the multi-window parts. That commit's sanitization and reload belong to [001](../001-markdown-viewer-editor/spec.md), its folder and external-open refinements to [005](../005-folder-mode-navigation/spec.md), and its search caching to [006](../006-find-in-document-and-files/spec.md).

## Summary

Folio replaces its single global document state with one `Session` per `BrowserWindow`, kept in a `sessions` map keyed by `webContents.id` in `src/main.js`.

- **Routing**: IPC handlers resolve the caller's Session from `event.sender`. Menu actions resolve the focused window's Session, fall back to the last focused one on macOS, and create a window when none exists.
- **Window creation**: File > New Window (`CmdOrCtrl+Shift+N`) calls the same `createWindow(openTarget)` factory that the single-instance `second-instance` handler and macOS `open-file` now use. A second launch with a path therefore opens a new window instead of replacing the current document.
- **Saving**: Save and Export get a window's content through a tokened `folio-request`/`folio-response` exchange with a 4-second timeout, instead of `webContents.executeJavaScript`.
- **Shared preferences**: App-wide preferences stay in `src/store.js`, and Style and Page width changes are broadcast to every window.
- **Placement** (`87e9165`): each new window is placed 30 px down and right of the window in front, wrapping inside the display's work area.
- **Switching** (`5b4fe2e`): a Window menu lists open windows by title, marks the active one, and switches with Select Next/Previous Window, Minimize, and on macOS Zoom and Bring All to Front.

## Technical Context

**Language/Version**: JavaScript. CommonJS main-process modules in `src/`; the ES-module renderer is bundled by esbuild into the generated `src/renderer/bundle.js`. Electron `^31.3.1` when `8062af5` landed (2026-07-14). `87e9165` and `5b4fe2e` were built on Electron `^43.2.0` after the upgrade in `57f8363` (2026-08-03). Every API this feature uses exists on both lines.

**Primary Dependencies**: Electron APIs only. No new npm dependency (the `dompurify` added in `8062af5` belongs to 001).

- `BrowserWindow`, one per window: `getFocusedWindow()`, `getAllWindows()`, `minimize`/`restore`/`show`/`focus`.
- `Menu.setApplicationMenu`: one menu, rebuilt on focus.
- `app.requestSingleInstanceLock()` and the `second-instance`, `open-file`, `activate` and `window-all-closed` events.
- `ipcMain`/`ipcRenderer` with `contextBridge`.
- `screen.getDisplayNearestPoint().workArea`, added in `87e9165`.
- `nativeTheme`, unchanged, for the app-wide appearance.

**Storage**: Shared preferences live in `folio-settings.json` in Electron `userData`, through `src/store.js`, which is unchanged. This feature reuses the keys `window`, `styleFamily`, `appearance`, `pageWidth`, `recentFiles`, `sourceMode` and `zoom` (later also `lineNumbers`). Per-window state is held only in memory on the `Session` and is never persisted.

**Testing**: No automated tests; manual verification per constitution quality gates and [quickstart.md](./quickstart.md).

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**:

- Window creation is synchronous on the menu click; the only I/O is reading the stored size, which the store already holds in memory.
- The application menu is rebuilt on window open, close and focus, and when a window label changes. It is not rebuilt on every keystroke: the `windowLabel` cache filters out repeated `setDirty` calls.
- A main→renderer request answers or falls back within 4 s.

**Constraints**:

- **Process**: one main process per user, enforced by the single-instance lock, so there is one settings writer and one window registry.
- **Isolation**: per-window state must never leak, so IPC uses `sessionFor(event.sender)` and dialogs are parented to `session.win`.
- **Hardening**: every window comes from one factory with `contextIsolation: true` and `nodeIntegration: false`.
- **Window geometry**: cascade step 30 px inside the display work area; default window size 1100 × 820, minimum 640 × 480.
- **Shortcuts**: Window > Minimize has no accelerator, because `CmdOrCtrl+M` is reserved for Format ▸ Inline Math (008).

**Scale/Scope**:

- There is no cap on the number of windows.
- Each window is one renderer page plus one 1-second `fs.watchFile` poll for its open file.
- The Window menu lists every window.
- `pendingRequests` holds at most one entry per in-flight save or export.
- Code size: `8062af5` changed `src/main.js` by +487/−208, which also includes the 001/005/006 parts of that commit. `87e9165` added +49/−10 and `5b4fe2e` added +46/−3 in `src/main.js`, and `5b4fe2e` added +40/−1 in `src/menu.js`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | ✅ Pass | Every window loads the same `src/renderer/index.html` shell, so the `#write`, `#typora-source` and `typora-sourceview-on` contract is unchanged. `pushThemeAll()` sends the same `composeThemeFiles()` layer stack (`set-theme`) to every Session, and `get-init` gives each new window the current stack. Appearance stays a single `nativeTheme.themeSource` flip that reaches every window. The Window menu is native, so there is no new themed chrome. |
| II. Complement Typora | ✅ Pass | Several windows serve viewing and light editing of several local files side by side, and each window holds one document, like Typora. No new editing surface is added. |
| III. Untrusted Documents, Hardened Shell | ⚠️ Pass with follow-up | **Passing:** All windows come from `createWindow()`, which sets `contextIsolation: true`, `nodeIntegration: false`, the preload bridge, the deny-all `setWindowOpenHandler` and the `will-navigate` guard. The document-scoped handlers `get-init`, `dirty-changed`, `navigate` and `search-files` resolve `sessionFor(event.sender)`. The main-world `executeJavaScript('window.folio.…')` bridge was replaced by the narrow `folio-request`/`folio-response` pair with two request kinds (`src/preload.js` `onRequest`). **Gap:** `folio-response` matches replies by a sequential id without checking that the reply came from the window that was asked, and it does not type-check `value` (see [research.md, finding 4](./research.md#retroactive-findings)). |
| IV. Never Lose the User's Work | ⚠️ Pass with follow-up | **Passing:** `Session` holds exactly the per-document state the constitution lists: path, dirty flag, folder, history and watcher. The `close` handler guards each window with `promptUnsaved(session)` and `forceClose`. `doSave` returns `true` only after a successful write, so a failed or timed-out save never closes a window. Quitting goes through each window's own guard. The shared store holds only app-wide preferences. **Gap:** reading the code shows a probable race. On macOS with no window open, File > Open Recent creates the window and sends the document before the page listens. The page then shows Welcome under the file's title, and a Save there would overwrite that file (see [research.md, finding 5](./research.md#retroactive-findings)). It has not been reproduced. |
| V. Cross-Platform Parity | ⚠️ Pass with follow-up | **Passing:** New Window uses `CmdOrCtrl+Shift+N`. Select Next/Previous Window has platform-native accelerators (`` Cmd+` `` on macOS, `Ctrl+Tab` elsewhere). Zoom and Bring All to Front are hidden outside macOS, and README documents both differences. A second launch opens a new window on every platform, through `second-instance` everywhere and `open-file` on macOS. The platform workarounds sit behind comments that give the reason: restore before focus, and an explicit foreground request on Windows/Linux. **Gap:** the last-window difference is not documented correctly. On macOS the app keeps running, but README says it quits "on every platform" (see [research.md, finding 1](./research.md#retroactive-findings)). |
| VI. Lean, Local, and Self-Contained | ✅ Pass | No new dependency and no new module. All of the logic stays in the existing `src/main.js` and `src/menu.js`. Windows are more renderers of the existing type, not a new process type, and the single-instance lock keeps one main process. The work is bounded: menu rebuilds are filtered by `windowLabel` and requests time out after 4 s. |
| Quality Gates & Documentation | ⚠️ Pass with follow-up | **Gates:** Gate 1, `npm run build:renderer`, applies because `src/renderer/renderer.js` changed. Gate 2, a smoke test with the per-window unsaved guard, is quickstart scenarios 1–3. Gate 3, Light/Dark checks across all windows, is quickstart scenario 5. Gate 4 applies because launch routing changed: `npm run dist` plus a second launch of the packaged app. Gate 5 applies because the IPC and preload surface changed; that is the Principle III review above. **Documentation:** `8062af5` shipped without README changes. README caught up in `61017d1`, `87e9165` and `5b4fe2e`, but it still drifts on the macOS last-window behavior and mis-escapes the `` Cmd+` `` shortcut (see [research.md, findings 1–3](./research.md#retroactive-findings)). |

**Post-design re-check** (after research.md, data-model.md, contracts/ and quickstart.md): no new conflicts were found. The design keeps all per-document state per window and all preferences shared, and it adds one narrow IPC pair. The four ⚠️ rows remain follow-ups, recorded as retroactive findings for a later feature, in line with the constitution's flow-forward rule.

## Project Structure

### Documentation (this feature)

```text
specs/007-multiple-windows/
├── spec.md                    # Feature specification (/speckit-specify)
├── plan.md                    # This file (/speckit-plan)
├── research.md                # Phase 0 output: decisions + retroactive findings
├── data-model.md              # Phase 1 output: Session, registry, shared preferences
├── quickstart.md              # Phase 1 output: manual validation scenarios + gates
├── contracts/                 # Phase 1 output
│   ├── menu-commands.md       # File > New Window, Window menu, focused-window routing
│   ├── ipc-channels.md        # folio-request/folio-response, per-window channel resolution
│   └── window-lifecycle.md    # single instance, launch routing, create/close/quit, cascade
├── checklists/
│   └── requirements.md        # Spec quality checklist (/speckit-specify)
└── tasks.md                   # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main.js            # Session + sessions registry, sessionFor/focusedSession, withSession/send/sendFocused,
│                      # createWindow(openTarget) + per-window focus/close/closed handlers, persistWindowBounds,
│                      # updateTitle/windowLabel, rebuildMenu + listWindows, pushThemeAll, actions
│                      # (newWindow, focusWindow, cycleWindow, minimizeWindow), focusSessionWindow,
│                      # ask() + folio-response, cascadeOrigin (screen), second-instance / open-file routing
│                      # (8062af5, 87e9165, 5b4fe2e)
├── menu.js            # File > New Window; `hasFile` and `windows` inputs; Window menu (8062af5, 5b4fe2e)
├── preload.js         # folioAPI.onRequest: answers folio-request on folio-response (8062af5)
└── renderer/
    └── renderer.js    # handleMainRequest('content' | 'prepare-export') replaces the window.folio bridge (8062af5)
README.md              # "Multiple documents at once", "New Window" (87e9165); Window menu, "Switch windows" (5b4fe2e)
```

**Structure Decision**: The existing single-project Electron layout is kept and no module is added.

- **`src/main.js`**: all multi-window logic lives here (the registry, routing, window creation and placement, and the launch lifecycle). The main process is the only one that can create windows, own the application menu and receive `second-instance`.
- **`src/menu.js`**: stays a pure template builder. It receives the `windows` list and the focused window's enable flags as inputs.
- **`src/preload.js`**: gains a single narrow `onRequest`.
- **`src/renderer/renderer.js`**: answers exactly two request kinds.
- **`src/store.js`**: reused unchanged as the shared-preferences owner.

`8062af5` also touched `src/folder.js`, `src/renderer/index.html`, `themes/fluent.css` and `package.json`. Those changes belong to 001, 005 and 006 and are not part of this feature.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally empty. The ⚠️ rows above are defects found during the retroactive review: documentation drift, a missing reply-sender check and an unverified race. They are not deliberate deviations that need a justification. Per the constitution's flow-forward rule they are recorded in [research.md](./research.md#retroactive-findings) for a follow-up feature.
