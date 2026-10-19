---

description: "Task list for Multiple Independent Windows"
---

# Tasks: Multiple Independent Windows

**Input**: Design documents from `/specs/007-multiple-windows/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner, so this list has no test tasks; validation is manual per [quickstart.md](./quickstart.md) and the constitution's quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Retroactive Record**: Every task is complete (`[X]`) and ends with the commit that delivered it: `8062af5` (2026-07-14), `87e9165` (2026-08-06) or `5b4fe2e` (2026-08-10). Only the multi-window parts of `8062af5` are listed here; its other changes belong to 001, 005 and 006.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: Electron main-process modules in `src/`, the bundled renderer in `src/renderer/`, and the user manual `README.md` at the repository root
- No `tests/` directory: Folio has no automated test suite yet

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Map the single-window code that the per-window refactor has to replace

- [X] T001 Inventory the single-window globals in src/main.js (`mainWindow`, `currentPath`, `currentName`, `isDirty`, `forceClose`, `currentFolder`, `pendingOpenPath`, `pendingOpenFolder`) and every function, IPC handler and menu action that reads them, as the migration list for per-window state (8062af5)
- [X] T002 Review the app-lifecycle hooks in src/main.js (`requestSingleInstanceLock`, `second-instance`, `open-file`, `activate`, `window-all-closed`) and the `executeJavaScript` bridge used by save and export, to fix where window creation and content requests plug in (8062af5)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Per-window state, lookups and messaging that every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `class Session` to src/main.js with the fields `win`, `id` (= `win.webContents.id`, captured at construction), `currentPath` (`null`), `currentName` (`'Welcome'`), `isDirty` (`false`), `forceClose` (`false`), `currentFolder` (`null`), `pendingOpenPath` (`null`), `pendingOpenFolder` (`null`), `watchedPath` (`null`) and `lastMtimeMs` (`0`), plus the `sessions` Map (webContents.id → Session) and `lastFocusedSession`, replacing the module-level globals (8062af5)
- [X] T004 Implement `sessionFor(webContents)` (sender lookup, `null` when unknown) and `focusedSession()` (focused window → last focused window that is not destroyed → `null`) in src/main.js (8062af5)
- [X] T005 Replace `send(channel, payload)` with `send(session, channel, payload)`, which skips destroyed windows, and add `sendFocused(channel, payload)` and `withSession(fn)` in src/main.js; `withSession` uses the focused Session, or creates a new window when there is none (8062af5)
- [X] T006 Thread the Session through every document operation in src/main.js and parent each dialog on `session.win`: `loadFile`, `doOpen`, `doOpenFolder`, `openFolder`, `doCloseFolder`, `doNew`, `openBuiltinDoc`/`loadBuiltinDoc`, `doSave`, `doSaveAs`, `doExportPDF`, `promptUnsaved`, `confirmDiscardIfDirty`, `setDirty` and `showAbout` (8062af5)
- [X] T007 Resolve the caller's Session from `event.sender` in the `dirty-changed`, `navigate` and `search-files` handlers in src/main.js, ignoring senders that have no Session (8062af5)
- [X] T008 Add the main → renderer request/response to src/main.js: `nextRequestId`, `pendingRequests` (id → `{ resolve, timer }`), a `folio-response` listener that ignores unknown ids, and `ask(session, kind, { timeoutMs = 4000, fallback = null })`, which sends `folio-request` `{ id, kind }` to that window only (8062af5)
- [X] T009 [P] Expose `folioAPI.onRequest(handler)` in src/preload.js: a single `folio-request` listener awaits `handler(kind)` and replies on `folio-response` with `{ id, value }`, using `value: null` when the handler throws (8062af5)
- [X] T010 [P] Replace the `window.folio` main-world bridge in src/renderer/renderer.js with `handleMainRequest(kind)`, registered through `window.folioAPI.onRequest` at the end of `boot()`: `'content'` returns the current text, `'prepare-export'` leaves source mode and returns `true`, and anything else returns `null` (8062af5)
- [X] T011 Switch `doSave` and `doSaveAs` to `ask(session, 'content', { fallback: null })` and `doExportPDF` to `ask(session, 'prepare-export', { fallback: true })` in src/main.js; abort the save when no content arrives, and make `doSave` return `true` only after a successful write so `promptUnsaved` proceeds only then (8062af5)

**Checkpoint**: Foundation ready. Every document operation is scoped to one Session, and the single-window globals are gone.

---

## Phase 3: User Story 1 - Work on several documents in separate windows (Priority: P1) 🎯 MVP

**Goal**: File > New Window opens an independent window, menu commands follow the window in front, and each window guards its own unsaved edits.

**Independent Test**: Quickstart scenarios 1–3. Two windows on different documents stay independent, commands and enable states follow the window in front, and closing a dirty window prompts only that window.

### Implementation for User Story 1

- [X] T012 [US1] Rewrite `createWindow(openTarget = null)` in src/main.js to build a Session for the new window, seed `pendingOpenPath`/`pendingOpenFolder` from `{ path }`/`{ folder }`, register it in `sessions`, make it `lastFocusedSession` and return it (8062af5)
- [X] T013 [US1] Add per-window handlers in `createWindow` in src/main.js: `focus` sets `lastFocusedSession` and calls `rebuildMenu()`; `closed` calls `stopWatching(session)`, deletes the Session from `sessions` and clears `lastFocusedSession` if it pointed at this window (8062af5)
- [X] T014 [US1] Guard each window's own `close` in src/main.js: close at once and persist that window's size when `session.forceClose || !session.isDirty`; otherwise prevent the close, run `promptUnsaved(session)` on that window, and close again with `forceClose = true` only when the prompt resolves `true` (8062af5)
- [X] T015 [US1] Make `updateTitle(session)` in src/main.js set that Session's window title to `• ` (only while that Session is dirty), then the file's basename or the untitled name, then ` - Folio` (8062af5)
- [X] T016 [US1] Make `get-init` in src/main.js resolve the sender's Session, consume its pending folder (preferred) or file exactly once and fall back to Welcome, so that every new window boots its own document (8062af5)
- [X] T017 [US1] Compute `hasFolder` and the new `hasFile` from `focusedSession()` in `rebuildMenu()` in src/main.js and pass them to `buildMenu` (8062af5)
- [X] T018 [US1] Route the menu `actions` in src/main.js (document commands through `withSession`, view commands through `sendFocused`, `findInFiles` and `about` through `focusedSession()`) and add `newWindow: () => createWindow()` (8062af5)
- [X] T019 [P] [US1] Add File > New Window (`CmdOrCtrl+Shift+N`) directly after File > New and accept the `hasFile` input in `buildMenu` in src/menu.js (8062af5)

**Checkpoint**: User Story 1 is fully functional. Side-by-side windows keep independent state and per-window unsaved guards.

---

## Phase 4: User Story 2 - Open from the terminal or desktop into a new window (Priority: P2)

**Goal**: A second launch, or a Finder open, while Folio runs opens a new window in front and never replaces an existing document.

**Independent Test**: Quickstart scenario 4. With a dirty window open, `npx electron . <file>` opens a new window in front without a prompt, and a launch without a path restores the most recently used window.

### Implementation for User Story 2

- [X] T020 [US2] Rewrite the `second-instance` handler in src/main.js so a folder argument opens `createWindow({ folder })`, a file argument opens `createWindow({ path })`, and no argument restores and focuses the window of `focusedSession()` (or calls `createWindow()` when there is none); drop `openExternalPath`/`openExternalFolder`, which replaced the current document after the unsaved prompt (8062af5)
- [X] T021 [US2] Route macOS `open-file` in src/main.js to `createWindow({ path })` once the app is ready, and collect the argv target and any early `open-file` target into one `pendingLaunchTarget`, passed to the first `createWindow()` in `app.whenReady()` (8062af5)
- [X] T022 [US2] Bring the receiving window forward after every `second-instance` in src/main.js: restore it if minimized, then call `show()` and `focus()`, for new and existing windows alike, because Windows and Linux won't hand the foreground to a background process (87e9165)

**Checkpoint**: User Stories 1 and 2 work. Launches hand their paths to the running instance as new windows.

---

## Phase 5: User Story 3 - Preferences stay shared across windows (Priority: P3)

**Goal**: The theme axes, the recent files, the window size and the view-preference seeds are app-wide.

**Independent Test**: Quickstart scenario 5. A change to Style, Page width or Appearance restyles every open window, Open Recent is shared, and a new window takes the last closed size and the last-used view preferences.

### Implementation for User Story 3

- [X] T023 [US3] Replace `pushTheme()` with `pushThemeAll()` in src/main.js, which sends `set-theme` `{ files: composeThemeFiles() }` to every Session, and call it from `setStyleFamily` and `setPageWidth` before `rebuildMenu()` (8062af5)
- [X] T024 [US3] Verify that the other shared preferences stay app-wide in src/main.js: `setAppearance` flips the process-wide `nativeTheme.themeSource` (also applied in every `createWindow`), and `store.addRecent`/`clearRecent` followed by `rebuildMenu()` give every window the same File > Open Recent list (8062af5)
- [X] T025 [US3] Persist the closing window's size with `persistWindowBounds(session)` (`store.set('window', { width, height })`), and size every new window from `store.get('window')` with a fallback of 1100 × 820 in `createWindow` in src/main.js (8062af5)
- [X] T026 [US3] Verify that view preferences remain app-wide seeds in src/main.js: `get-init` returns the stored `sourceMode` and `zoom` to each new window, while `state-changed` writes the snapshot of whichever window changed last and is not broadcast to open windows (8062af5)

**Checkpoint**: The shared preferences are consistent in every window.

---

## Phase 6: User Story 4 - New windows cascade instead of covering each other (Priority: P4)

**Goal**: New windows appear 30 points right of and below the window in front, wrapping inside the display's usable area.

**Independent Test**: Quickstart scenario 6. Repeated New Window commands cascade by 30 points and wrap to the top-left of the work area, and the first window opens at the OS default position.

### Implementation for User Story 4

- [X] T027 [US4] Import `screen` from `electron` in src/main.js and add `CASCADE_STEP = 30` and `cascadeOrigin(width, height)`; the reference is the focused window, or else the last entry of `BrowserWindow.getAllWindows()`, and the function returns `{}` when there is none (87e9165)
- [X] T028 [US4] In `cascadeOrigin` in src/main.js, read the work area of `screen.getDisplayNearestPoint()` at the reference's position (returning `{}` if that throws), offset the reference position by `CASCADE_STEP`, and wrap to `{ x: area.x, y: area.y }` when `x + width` or `y + height` would exceed the area (87e9165)
- [X] T029 [US4] Spread `...cascadeOrigin(bounds.width, bounds.height)` into the `BrowserWindow` options in `createWindow` in src/main.js, so New Window, second launches and Finder opens cascade from an existing window; with no window left, the OS default position applies (87e9165)

**Checkpoint**: A new window never lands exactly on top of an existing one.

---

## Phase 7: User Story 5 - Find and switch windows from the Window menu (Priority: P5)

**Goal**: A Window menu lists the windows by title, marks the active one, switches between them (including from the keyboard), and offers Minimize plus Zoom and Bring All to Front on macOS.

**Independent Test**: Quickstart scenario 7. Check that:

- the list order and the mark on the active window are right
- choosing a minimized window restores it
- `` Cmd+` `` / `Ctrl+Tab` cycles through the windows
- labels follow title changes
- closed windows disappear from the list
- Next and Previous are disabled when only one window is open

### Implementation for User Story 5

- [X] T030 [US5] Add `windowLabel` (`null`) to `Session` and change `updateTitle` in src/main.js to compute the label (`•` plus the document name), set the title to the label plus ` - Folio`, and call `rebuildMenu()` only when the label text changed, never on every keystroke (5b4fe2e)
- [X] T031 [US5] Add `listWindows(focused)` to src/main.js, which returns the live Sessions in creation order as `{ id, label: windowLabel || title || 'Untitled', focused }`, and pass the result as `windows` from `rebuildMenu()` to `buildMenu` (5b4fe2e)
- [X] T032 [US5] Add `focusSessionWindow(session)` (restore if minimized, then `show()` and `focus()`) and the actions `focusWindow(id)`, `cycleWindow(delta)` (no-op with fewer than two windows, wraps around, starts at the first window when the current one is unknown) and `minimizeWindow()` in src/main.js (5b4fe2e)
- [X] T033 [US5] Call `rebuildMenu()` from the window `closed` handler in src/main.js so that a closed window drops out of the Window menu (5b4fe2e)
- [X] T034 [P] [US5] Build the Window menu between Themes and Help in `buildMenu` in src/menu.js: Minimize (no accelerator, because `CmdOrCtrl+M` is Format ▸ Inline Math), the macOS-only `zoom` role, Select Next/Previous Window (`` Cmd+` `` / `` Cmd+Shift+` `` on macOS, `Ctrl+Tab` / `Ctrl+Shift+Tab` elsewhere; enabled only with more than one window), the macOS-only `front` role, then one radio item per window (checked on the focused one) or a disabled "(No open windows)" entry (5b4fe2e)

**Checkpoint**: All user stories now work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and constitution gate validation across all stories

- [X] T035 Document multiple windows in README.md: the "Multiple documents at once" feature (each window has its own document, folder, history and unsaved state; a second launch opens a new window; new windows cascade) and the "New Window" how-to with the shared app-wide preferences (87e9165)
- [X] T036 Document window switching in README.md: add the Window-menu sentence to Features, and the "Switch windows" how-to with the per-platform shortcuts and the macOS-only Zoom and Bring All to Front (5b4fe2e)
- [X] T037 [P] Review the new `folio-request`/`folio-response` pair in src/preload.js and src/main.js against Principle III, as described in specs/007-multiple-windows/contracts/ipc-channels.md: it has only two request kinds, there is no main-world bridge, and every document-scoped handler resolves the Session from `event.sender` (8062af5)
- [X] T038 [P] Run `npm run build:renderer` and confirm that src/renderer/renderer.js bundles without esbuild errors after the `handleMainRequest` change (8062af5)
- [X] T039 Run every scenario in specs/007-multiple-windows/quickstart.md with `npm start`, including the per-window unsaved guard and Light/Dark in every Style family across the open windows (5b4fe2e)
- [X] T040 Package with `npm run dist` on the host platform, repeat the second-launch scenario from specs/007-multiple-windows/quickstart.md with the packaged app, and list any platform that was not verified (5b4fe2e)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. It can start immediately.
- **Foundational (Phase 2)**: Depends on Setup and BLOCKS all user stories. Every story needs the Session, its lookups and `send`/`withSession`, and the save and close guard needs `ask()`.
- **User Stories (Phase 3+)**: All depend on the Foundational phase.
  - US2 also needs `createWindow(openTarget)` (T012) and the pending-target handling in `get-init` (T016) from US1.
  - US3 can be observed only once at least two windows exist, through US1 or US2.
  - US4 needs only `createWindow` (T012).
  - US5 needs the per-window handlers (T013) and `updateTitle` (T015) from US1.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) and depends on no other story.
- **User Story 2 (P2)**: Reuses US1's window factory, and can be tested on its own with quickstart scenario 4.
- **User Story 3 (P3)**: Touches only theme broadcasting and the shared-store reads and writes, and can be tested with any two windows.
- **User Story 4 (P4)**: Touches only the placement of `createWindow`, and can be tested with New Window alone.
- **User Story 5 (P5)**: Adds the menu model and the Window menu on top of US1's handlers, and can be tested with any three windows.

### Within Each User Story

- Make the Session and routing changes in src/main.js before the menu template changes in src/menu.js that consume new inputs (`hasFile`, `windows`).
- Once the input shape is agreed, the src/menu.js tasks (T019, T034) can run in parallel with the src/main.js work.
- Finish each story before moving to the next priority. The history did this per commit: US1–US3 in `8062af5`, US4 in `87e9165` and US5 in `5b4fe2e`.

### Parallel Opportunities

- T009 (src/preload.js) and T010 (src/renderer/renderer.js) can run in parallel with each other and alongside T008 (src/main.js).
- T019 (src/menu.js) can run in parallel with T012–T018 (src/main.js).
- T034 (src/menu.js) can run in parallel with T030–T033 (src/main.js).
- US4 can proceed in parallel with US2, US3 and US5 once US1 lands, because it changes only `cascadeOrigin` and the window options.
- T037 and T038 can run in parallel with the README tasks T035 and T036.

---

## Parallel Example: User Story 5

```bash
# Once the `windows` input shape ({ id, label, focused }) is agreed, the main-process model and the menu template can be built together:
Task: "Add listWindows(focused) to src/main.js and pass it as `windows` from rebuildMenu() to buildMenu"
Task: "Build the Window menu between Themes and Help in buildMenu in src/menu.js"

# Foundational: both sides of the request/response bridge in parallel:
Task: "Expose folioAPI.onRequest(handler) in src/preload.js"
Task: "Replace the window.folio main-world bridge with handleMainRequest(kind) in src/renderer/renderer.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart scenarios 1–3 (independent windows, routing, unsaved guard)
5. Demo side-by-side windows

### Incremental Delivery (as shipped)

1. `8062af5` (2026-07-14) delivered Setup, Foundational, US1, US2 and US3 together. The same commit also carried unrelated 001, 005 and 006 work.
2. `87e9165` (2026-08-06) delivered the US4 cascade, the second-launch foreground fix (T022) and the README documentation (T035).
3. `5b4fe2e` (2026-08-10) delivered the US5 Window menu and the README "Switch windows" section (T036).
4. Each step left the earlier stories working.

### Parallel Team Strategy

With multiple developers:

1. The team completes Setup and Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1, then User Story 2
   - Developer B: User Story 3
   - Developer C: User Story 4, then User Story 5 (after T012, T013 and T015 land)
3. Stories complete and integrate independently.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Every task is marked `[X]` because this is a retroactive record of shipped work. The hash at the end of each task is the commit that delivered it.
- Follow-ups found during the retroactive review are not listed as tasks, because they are not done. See [research.md, Retroactive findings](./research.md#retroactive-findings):
  - the README drift on the macOS last-window behavior and the escaping of the `` Cmd+` `` shortcut
  - the missing sender check on `folio-response`
  - the probable File > Open Recent race on macOS with no window open
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
