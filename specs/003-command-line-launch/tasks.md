---

description: "Task list for Open From the Command Line & the `folio` Command"
---

# Tasks: Open From the Command Line & the `folio` Command

**Input**: Design documents from `/specs/003-command-line-launch/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner; validation is manual per [quickstart.md](./quickstart.md) and the constitution's quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Retroactive record: every task is complete (`[X]`) and ends with the commit that delivered it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Desktop app (single project)**: Electron main-process modules in `src/` (`src/main.js`, `src/menu.js`), build configuration in `package.json`, user manual in `README.md`, all at the repository root
- This feature does not touch the renderer (`src/renderer/`) or the preload bridge (`src/preload.js`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Main-process state slots and imports that the launch and install code needs

- [X] T001 Add the module-level `pendingOpenPath` slot ("file to open once the renderer is ready (startup / macOS open-file)") to src/main.js (f96fc39)
- [X] T002 Add the companion `pendingOpenFolder` slot ("folder to open in explorer mode once the renderer is ready (startup)") to src/main.js (5c48052)
- [X] T003 Import `clipboard` from `electron` in src/main.js for the copy-to-clipboard fallbacks of the install command (8563975)
- [X] T004 Import the `os` built-in in src/main.js for the home-folder paths used by the Linux and Windows installers (5c59ebc)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The launch-argument parser shared by the first launch (US1) and the hand-off to a running instance (US2)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement `fileArgFrom(argv)` in src/main.js: drop the leading executable/app-path arguments (`argv.slice(app.isPackaged ? 1 : 2)`), skip empty arguments and arguments starting with `-`, and return the first argument that resolves to an existing file of any type (f96fc39)
- [X] T006 Replace `fileArgFrom` with `pathArgFrom(argv)` in src/main.js, returning `{ path, isDir }` for the first existing file or directory, or `null` (5c48052)
- [X] T007 Extend `pathArgFrom(argv, cwd)` in src/main.js: scan `argv.slice(1)`, resolve with `path.resolve(cwd || process.cwd(), a)`, and skip the argument equal to `path.resolve(app.getAppPath())` instead of relying on an `app.isPackaged` offset (61017d1)

**Checkpoint**: Foundation ready. Given any argv and working directory, the parser returns the absolute file or folder to open, or `null`.

---

## Phase 3: User Story 1 - Open a file or folder named at launch (Priority: P1) 🎯 MVP

**Goal**: A path given at launch opens as a document (file) or in folder mode (folder), resolved against the caller's directory.

**Independent Test**: From a scratch folder, run `"$REPO/node_modules/.bin/electron" "$REPO" notes.md`, then `… notes-folder`; the document opens, then the folder opens in folder mode (quickstart.md, Scenario 1).

### Implementation for User Story 1

- [X] T008 [US1] Read `process.argv` with the launch parser at module load, before `app.whenReady()`, and store a file result in `pendingOpenPath` for the first window in src/main.js (f96fc39)
- [X] T009 [US1] Open the pending file in the `get-init` handler in src/main.js: read it as UTF-8, set the current path and name, `store.addRecent`, clear the dirty flag, rebuild the menu and title, and on a read error show `dialog.showErrorBox('Folio — cannot open file', …)` before falling back (f96fc39)
- [X] T010 [US1] Route a directory argument to `pendingOpenFolder` and handle it first in `get-init` in src/main.js: `scanFolder(dir)`, set the current folder, `store.set('folder', dir)`, return `folder` with `filesVisible: true`, and open `entryDocFor(tree)`, falling back silently to the Welcome document (5c48052)
- [X] T011 [US1] On macOS, call `app.focus({ steal: true })` after the first `createWindow(pendingLaunchTarget)` when a launch target exists, since a terminal launch is not activated by LaunchServices, in src/main.js (61017d1)

**Checkpoint**: User Story 1 is fully functional on its own. Launching with a file or folder path opens it; a missing path shows the Welcome document.

---

## Phase 4: User Story 2 - Send a path to the Folio that is already running (Priority: P2)

**Goal**: A later launch hands its path and working directory to the single running Folio, which opens it and comes to the front.

**Independent Test**: With Folio running and minimized, run the development launch with a relative path from another directory; the path opens in the running app, in front, resolved against the second command's directory (quickstart.md, Scenario 2).

### Implementation for User Story 2

- [X] T012 [US2] Make the existing `second-instance` handler in src/main.js path-aware: restore and focus the window, parse the forwarded `argv` with `fileArgFrom` instead of the `/\.(md|markdown|mdown|mkd|txt)$/i` match, and open the file through `openExternalPath` behind `confirmDiscardIfDirty` (in-place opening was later replaced by 007's new window in 8062af5) (f96fc39)
- [X] T013 [US2] Accept forwarded folders in `second-instance` with `pathArgFrom(argv)` and a guarded `openExternalFolder(dir)` that calls `openFolder(dir, { openEntry: true })` in src/main.js (5c48052)
- [X] T014 [US2] Pass the `second-instance` `workingDirectory` into `pathArgFrom(argv, workingDirectory)` so relative paths resolve against the sending terminal's directory in src/main.js (61017d1)
- [X] T015 [US2] End the `second-instance` handler with `app.focus({ steal: true })` on macOS, because a relaunch from a terminal is not brought forward by LaunchServices, in src/main.js (61017d1)

**Checkpoint**: User Stories 1 and 2 both work independently. Only one Folio runs, and every later launch is handled by it.

---

## Phase 5: User Story 3 - Start clean with the Welcome document when no path is given (Priority: P3)

**Goal**: Startup depends only on the launch path; without one, the Welcome document shows with the explorer and outline hidden.

**Independent Test**: Open a folder and show the outline, quit, run `npm start`; the Welcome document appears with no explorer and no outline (quickstart.md, Scenario 3).

### Implementation for User Story 3

- [X] T016 [US3] Restructure `get-init` in src/main.js so the bundled Welcome document (`samples/welcome.md`, untitled, with built-in fallback text if unreadable) is used only when no launch target produced a document (f96fc39)
- [X] T017 [US3] Remove the stored-folder restore (`store.get('folder')` and its entry-document fallback) from `get-init` in src/main.js so startup depends only on the launch argument (5c48052)
- [X] T018 [US3] Return `settings.outlineVisible: false` and a launch-derived `settings.filesVisible` from `get-init` instead of the stored `outlineVisible`/`filesVisible` in src/main.js (5c48052)

**Checkpoint**: Startup is predictable: the Welcome document, the named file, or the named folder; never the last session.

---

## Phase 6: User Story 4 - Install the `folio` command from the File menu (Priority: P4)

**Goal**: One File-menu command writes a `folio` launcher into a PATH folder on macOS, Windows and Linux (AppImage), with copy-paste fallbacks.

**Independent Test**: On a packaged build, choose File > Install 'folio' Command in PATH…, open a new terminal and run `folio notes.md` and `folio notes-folder` (quickstart.md, Scenario 4).

### Implementation for User Story 4

- [X] T019 [P] [US4] Add the "Install 'folio' Command in PATH…" File-menu item (its own separator, after Export to PDF…, no accelerator, macOS-only via `isMac`) calling `actions.installShellCommand()` in src/menu.js (8563975)
- [X] T020 [US4] Add `actions.installShellCommand` and a guarded `installShellCommand()` in src/main.js that parents dialogs to the focused window and reports unexpected failures as "Couldn't install the 'folio' command." without ever throwing (8563975)
- [X] T021 [US4] Write the first macOS launcher in src/main.js: `mkdirSync('/usr/local/bin', { recursive: true })`, `#!/bin/sh\nexec open -a "Folio" "$@"\n` with `mode: 0o755` plus `chmodSync`, then the "Command Installed" confirmation (8563975)
- [X] T022 [US4] Add `permissionDialogOptions(target, manualCommand)` (warning; **Copy Command** default, **Cancel**) and on `EACCES`/`EPERM` offer the `sudo mkdir -p … | sudo tee … && sudo chmod 0755 …` one-liner, copying it with `clipboard.writeText`, in src/main.js (8563975)
- [X] T023 [US4] Add `canInstallShellCommand()` (macOS always; Linux only when `process.env.APPIMAGE` is set) to src/main.js and pass it to `buildMenu` in src/menu.js, which omits the item when the flag is false (5c59ebc)
- [X] T024 [US4] Split the macOS code into `installShellCommandMac(parentWin)` and add `installShellCommandLinux(parentWin)` in src/main.js: create `~/.local/bin`, unlink an existing `folio` (ignoring `ENOENT`), `fs.symlinkSync` it to `$APPIMAGE`, offer `mkdir -p … && ln -sf …` on permission errors, and confirm with the symlink location (5c59ebc)
- [X] T025 [US4] Reword the shared permission dialog to "Installing the 'folio' command needs different permissions." so it fits every platform in src/main.js (5c59ebc)
- [X] T026 [US4] Replace the macOS `open -a` wrapper with `nohup "<process.execPath>" "$@" >/dev/null 2>&1 &` (escaping `"`, `$`, backtick and `\`), regenerate the matching `printf`-based `sudo` one-liner, and add `folio path/to/folder` to the macOS and Linux success dialogs in src/main.js (61017d1)
- [X] T027 [US4] Add `isOnPath(dir)` to src/main.js: a case-insensitive comparison against `process.env.PATH` entries that ignores surrounding quotes and trailing separators (ac1ff4a)
- [X] T028 [US4] Add `installShellCommandWindows(parentWin)` to src/main.js: use `%LOCALAPPDATA%\Microsoft\WindowsApps` when `isOnPath` finds it, else `%LOCALAPPDATA%\Folio\bin`; write `@echo off\r\nstart "" "<exe>" %*\r\n` with `%` doubled; offer the PowerShell `New-Item … ; Set-Content …` one-liner on permission errors; confirm with "Open a new terminal first" (ac1ff4a)
- [X] T029 [US4] Show the Windows fallback dialog ("…installed, but its folder isn't on your PATH yet.", the `rundll32 sysdm.cpl,EditEnvironmentVariables` steps, and **Copy Folder Path** → clipboard) in src/main.js (ac1ff4a)
- [X] T030 [US4] Offer the command on Windows (`canInstallShellCommand()` returns true for `win32`), dispatch `installShellCommandWindows` from `installShellCommand`, and change the unsupported-platform detail to "Folio can only install a launcher on macOS, Windows and Linux." in src/main.js (ac1ff4a)

**Checkpoint**: `folio <file>` and `folio <folder>` work from a new terminal on all three platforms, and every failure path ends in a dialog.

---

## Phase 7: User Story 5 - Open items handed over by the macOS desktop (Priority: P5)

**Goal**: Files and folders delivered by Finder, the Dock or `open -a` follow the same rules as a command-line path.

**Independent Test**: On a packaged macOS build, run `open -a Folio notes.md` with Folio quit, then drop a folder on the Dock icon with Folio running (quickstart.md, Scenario 5).

### Implementation for User Story 5

- [X] T031 [US5] Handle `app.on('open-file')` in src/main.js: `preventDefault()`, open the path in the existing window behind the unsaved-changes guard, or keep it in `pendingOpenPath` when the event fires before the app is ready (in-place opening was later replaced by 007's new window in 8062af5) (f96fc39)
- [X] T032 [US5] Add `launchTargetFor(target)` to src/main.js (`statSync`: directory → `{ folder }`, other → `{ path }`, error → `null`) and route `open-file` through it, so folders open in folder mode, vanished paths are ignored and early targets wait in `pendingLaunchTarget` (61017d1)
- [X] T033 [P] [US5] Declare `build.mac.extendInfo.CFBundleDocumentTypes` in package.json: "Markdown Document" (`CFBundleTypeRole` "Editor", `LSHandlerRank` "Alternate", `net.daringfireball.markdown`, `public.plain-text`) and "Folder" (`CFBundleTypeRole` "Viewer", `LSHandlerRank` "None", `public.folder`) (61017d1)

**Checkpoint**: All user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: User-manual updates delivered with each commit, and the final validation

- [X] T034 Document "Open from the command line" in README.md › How to use: `npm start -- path/to/notes.md`, `Folio path/to/notes.md`, dropping a file onto the app or `Folio.exe`, and the Welcome document when no file is given (f96fc39)
- [X] T035 Document "The `folio` command on macOS" in README.md: the menu command, `/usr/local/bin/folio`, the `sudo` one-liner, `open -a Folio` without setup, and the PowerShell-profile line `$env:PATH += ':/usr/local/bin'` for login shells (8563975)
- [X] T036 Document "The `folio` command on Linux" in README.md: the `~/.local/bin/folio` symlink, no `sudo`, why the item can be missing (`APPIMAGE` unset; a `.deb` already puts `folio` on PATH), and the manual `ln -sf` command (5c59ebc)
- [X] T037 Update README.md for folder paths, relative-path resolution, new windows for a running Folio, the bundle-binary wrapper with its new `sudo` one-liner, and why `open -a` is limited (61017d1)
- [X] T038 Document "The `folio` command on Windows" in README.md (`folio.cmd` in `WindowsApps`, no administrator rights or PATH edits, `start`, the `%LOCALAPPDATA%\Folio\bin` fallback, uninstall by deleting `folio.cmd`) and drop the claim that the installer puts Folio on PATH (ac1ff4a)
- [X] T039 Run the specs/003-command-line-launch/quickstart.md scenarios and the constitution gates on the host platform: `npm run dist`, the unsaved-edits check of Scenario 2, and the Principle III review (no IPC, preload or CSP change) (ac1ff4a)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. It builds on the single-instance lock and `get-init` from the initial build (`bd8f5ef`, 001).
- **Foundational (Phase 2)**: Depends on Setup and BLOCKS US1 and US2, which both parse arguments.
- **User Stories (Phase 3+)**: US1 and US2 need Phase 2. US3, US4 and US5 can start after Setup.
- **Polish (Phase 8)**: Each README task follows the code of its own commit; T039 needs every story.

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational. No dependency on other stories.
- **User Story 2 (P2)**: After Foundational. Shares the parser with US1 and is testable on its own. Its final new-window behavior and the explicit `restore()`/`show()`/`focus()` of the target window come from 007 (`8062af5`, `87e9165`).
- **User Story 3 (P3)**: Builds on the `get-init` launch handling of T009 and T010; independently testable with `npm start`.
- **User Story 4 (P4)**: Independent of US1 to US3 for writing the launcher, but the launcher is only useful once US1 and US2 work. T026 relies on T014 so that a launch from the macOS wrapper reaches a running instance with the right working directory.
- **User Story 5 (P5)**: macOS only. T032 relies on 007's `createWindow(target)` (`8062af5`) and on the folder handling from T010.

### Within Each User Story

- Parser before the code that consumes it (T005 to T007 before T008 and T012)
- Main-process handlers before the menu wiring that exposes them (T020 before T019 is clicked)
- Per-OS installers after the shared dispatch and permission dialog (T020 and T022 before T024 and T028)
- Story complete before moving to the next priority

### Parallel Opportunities

- `src/menu.js` (T019) and `package.json` (T033) are separate files from `src/main.js` and can proceed in parallel with main-process work.
- Almost everything else touches `src/main.js` and is therefore sequential.
- README tasks share one file and run in order, each right after its commit's code.

---

## Parallel Example: User Story 4

```bash
# The menu item and the install routine live in different files:
Task: "T019 Add the Install 'folio' Command in PATH… File-menu item in src/menu.js"
Task: "T020 Add actions.installShellCommand and a guarded installShellCommand() in src/main.js"
```

## Parallel Example: User Story 5

```bash
# The Info.plist declaration is independent of the open-file handler:
Task: "T033 Declare build.mac.extendInfo.CFBundleDocumentTypes in package.json"
Task: "T032 Add launchTargetFor and route open-file through it in src/main.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (the launch parser)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `npm start -- samples/formatting-tour.md` and `npm start -- samples` (quickstart.md, Scenario 1)
5. Ship: Folio opens what it is launched with (`f96fc39`, 2026-07-09)

### Incremental Delivery (as it actually happened)

1. `f96fc39` (2026-07-09): file argument, `second-instance` hand-off, macOS `open-file`, and the MVP README section
2. `5c48052` (2026-07-14): folder arguments and the clean start (US3)
3. `8563975` (2026-07-14): the macOS `folio` command (US4, first platform)
4. `5c59ebc` (2026-07-21): the Linux AppImage command and per-OS availability
5. `61017d1` (2026-08-04): terminal-launch fixes: bundle-binary wrapper, `workingDirectory`, app-path identity, macOS focus, folders from the desktop (US5)
6. `ac1ff4a` (2026-09-16): the Windows command, completing parity

### Parallel Team Strategy

With several developers after Phase 2: developer A takes US1 and US3 (`get-init`), developer B takes US2 and US5 (app lifecycle), and developer C takes US4 (install routines and menu). They must coordinate edits to `src/main.js`.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No test tasks: tests were not requested, and the quickstart scenarios stand in for them
- Commit history interleaves stories (`f96fc39` touched US1, US2, US3 and US5), so tasks are grouped by story rather than by commit
- Adjacent work owned by other specs is not listed as tasks here: the single-instance lock (`bd8f5ef`, 001), per-window `Session` and new-window hand-off (`8062af5`, 007), explicit foregrounding of the target window (`87e9165`, 007), and document icons and Windows file associations (`59f97be`, 002)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
