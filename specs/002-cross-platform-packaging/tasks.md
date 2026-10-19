---

description: "Task list for Cross-Platform Packaging, App Identity & File Associations"
---

# Tasks: Cross-Platform Packaging, App Identity & File Associations

**Input**: Design documents from `/specs/002-cross-platform-packaging/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner, so validation is manual, following quickstart.md and the constitution's gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Retroactive**: Every task is complete (`[X]`). The hash at the end of each task is the commit that delivered it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single desktop project at the repository root: `package.json`, `scripts/`, `build/icons/`, `docs/`, `README.md` and one main-process file, `src/main.js` (see plan.md → Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The npm entry points, ignore rules and README section that every later task builds on

- [X] T001 Add the `dist`, `dist:win`, `dist:mac` and `dist:linux` scripts (`npm run build:renderer && electron-builder`, optionally with `--win`, `--mac` or `--linux`) to package.json (bd8f5ef)
- [X] T002 [P] Keep packaging output and non-redistributable fonts out of git: add the `release/` and Aptos `fonts/*.ttf` entries to .gitignore (bd8f5ef)
- [X] T003 [P] Document the four packaging commands, their targets (NSIS, DMG, AppImage + deb) and the `release/` output folder in the "Packaging" section of README.md (bd8f5ef)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The electron-builder configuration that every user story extends (icons, associations, packaging wrappers)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define the electron-builder `build` block in package.json: `appId` `com.dpokluda.folio`, `productName` `Folio`, `files` (`src/**/*`, `themes/**/*`, `samples/**/*`, `!**/*.map`) and `directories.output` `release` (bd8f5ef)
- [X] T005 Declare the per-OS targets in package.json: `win.target` `nsis`; `mac.target` `dmg` with `category` `public.app-category.productivity`; `linux.target` `["AppImage", "deb"]` with `category` `Office` (bd8f5ef)
- [X] T006 Copy `themes/` into the packaged resources through `extraResources` with the filter `["**/*", "!**/fonts/*.ttf"]` in package.json, so the Aptos fonts never reach the theme folder the app loads (bd8f5ef)
- [X] T007 Resolve themes from `process.resourcesPath/themes` when `app.isPackaged` (`themesDir()`) in src/main.js, so the packaged app reads the `extraResources` copy (bd8f5ef)

**Checkpoint**: Foundation ready. `npm run dist` packages Folio for the host OS, and user story work can begin.

---

## Phase 3: User Story 1 - Package Folio for every desktop OS with one command (Priority: P1) 🎯 MVP

**Goal**: One command per OS produces the NSIS installer, the DMG, or the AppImage plus .deb in `release/`, without Administrator rights, Developer Mode or a signing certificate.

**Independent Test**: quickstart.md Scenario 1. Run `npm run dist` from a standard account, install the artifact and launch Folio; it shows the welcome document and every theme works.

### Implementation for User Story 1

- [X] T008 [US1] Create scripts/prepare-wincodesign.js. On Windows only, it downloads `winCodeSign-2.6.0.7z` and extracts it with `7za x -bd -snl- -y` (symlinks disabled) into electron-builder's `winCodeSign-2.6.0` cache folder. It skips the work when `windows-10\x64\signtool.exe` already exists and does nothing on macOS and Linux (dd44537)
- [X] T009 [US1] Add the `prepare:wincodesign` script to package.json and run it in `dist` and `dist:win` before electron-builder (dd44537)
- [X] T010 [P] [US1] Add a "Windows packaging note" to README.md covering the winCodeSign symlinks, the "A required privilege is not held by the client" error and the automatic pre-extraction (dd44537)
- [X] T011 [US1] Verify, from a clean packager cache, that `npm run dist` produces the NSIS installer end to end without Administrator rights or Developer Mode, following specs/002-cross-platform-packaging/quickstart.md Scenario 1 (dd44537)
- [X] T012 [US1] Turn `author` into `{ name, email }` in package.json so electron-builder can fill the .deb `Maintainer` field (4b2248b)
- [X] T013 [US1] Retire the workaround after the electron-builder 26 upgrade dropped `7zip-bin`: delete scripts/prepare-wincodesign.js and remove `prepare:wincodesign` from `dist` and `dist:win` in package.json (5f9a8a0)
- [X] T014 [US1] Rewrite the "Windows packaging note" in README.md as history: electron-builder 26 tolerates the symlink failure, fetches 7-Zip on demand and downloads winCodeSign only when signing is configured (5f9a8a0)
- [X] T015 [US1] In the "Packaging" section of README.md, explain that `npm run dist` equals the host-specific variant and that cross-targeting needs extra tooling such as Wine (59f97be)

**Checkpoint**: User Story 1 is fully functional. Installers build on Windows, macOS and Linux, and can be tested on their own.

---

## Phase 4: User Story 2 - Folio has its own recognizable app icon (Priority: P2)

**Goal**: Folio shows its own tile icon on the executable, bundle, packages and windows, generated from one SVG with `npm run icons`.

**Independent Test**: quickstart.md Scenario 2. Check the icon on the installed app and the `npm start` window, then run `npm run icons` and confirm it writes the PNG, `.ico` and `.icns` files.

### Implementation for User Story 2

- [X] T016 [P] [US2] Draw the app icon source build/icons/icon.svg: a light rounded tile with a subtle border, a stylized "F" in `#2D333B` and a teal caret gradient from `#2DD4BF` to `#0EA5A3` (c5171da)
- [X] T017 [P] [US2] Create scripts/generate-icons.js. It renders the SVG to a 1024×1024 PNG master with sharp, then builds the `.ico` (`png2icons.createICO`, BICUBIC, BMP entries) and the `.icns` (`createICNS`). It fails with `Missing source icon` or `Failed to build …` (c5171da)
- [X] T018 [US2] Add the `icons` script and the dev-only `sharp` ^0.35.3 and `png2icons` ^2.0.1 devDependencies to package.json and package-lock.json (c5171da)
- [X] T019 [US2] In package.json, point `win.icon`, `mac.icon` and `linux.icon` at build/icons/icon.ico, build/icons/icon.icns and build/icons/icon.png, and add `build/icons/**` to `files` (c5171da)
- [X] T020 [P] [US2] Add `appIconPath()` to src/main.js and pass it as the BrowserWindow `icon`. It returns `icon.ico` on Windows, `icon.png` elsewhere, and `undefined` when the file is missing (c5171da)
- [X] T021 [US2] Generate build/icons/icon.png, build/icons/icon.ico and build/icons/icon.icns with `npm run icons` and commit them (c5171da)
- [X] T022 [P] [US2] Document the icon source and the `npm run icons` workflow in a new "App icon" section of README.md (c5171da)
- [X] T023 [US2] Verify that `npm run dist:win` embeds the new icon in the packaged `Folio.exe`, following specs/002-cross-platform-packaging/quickstart.md Scenario 2 (c5171da)
- [X] T024 [US2] Scale the glyph group 1.26× about the tile centre in build/icons/icon.svg, then regenerate build/icons/icon.png, build/icons/icon.ico and build/icons/icon.icns (f96fc39)
- [X] T025 [US2] Refresh the artwork in build/icons/icon.svg: an 880 px tile with `rx` 200, a darker 26 px `#808A96` frame that stays visible on white backgrounds and at 16/32/48 px, and the glyph at 1.45×. Then regenerate build/icons/icon.png, build/icons/icon.ico and build/icons/icon.icns (68e67be)

**Checkpoint**: User Stories 1 and 2 both work on their own. Packages and dev windows carry the Folio tile.

---

## Phase 5: User Story 3 - Markdown files open with Folio and wear a Markdown-document icon (Priority: P3)

**Goal**: On Windows, Markdown files get Folio's "Markdown Document" type and the document icon. On macOS, Folio is declared as an alternate Markdown editor and a folder viewer, with the document icon.

**Independent Test**: quickstart.md Scenario 3. Install on Windows and check the five extensions in Explorer (icon, type, double-click). On macOS, check Open With and the document icon.

### Implementation for User Story 3

- [X] T026 [US3] Declare `mac.extendInfo.CFBundleDocumentTypes` in package.json with two types: "Markdown Document" (role `Editor`, `LSHandlerRank` `Alternate`, `net.daringfireball.markdown` and `public.plain-text`) and "Folder" (role `Viewer`, `LSHandlerRank` `None`, `public.folder`) (61017d1)
- [X] T027 [P] [US3] Draw the Markdown-document icon source build/icons/document.svg: a page with a folded upper-right corner, a `#808A96` frame and the Folio glyph at 1.3× (59f97be)
- [X] T028 [P] [US3] Generalize scripts/generate-icons.js to loop over `SOURCES = ['icon', 'document']`, and add a comment on why document icons stay distinct from the app icon (59f97be)
- [X] T029 [US3] Generate build/icons/document.png, build/icons/document.ico and build/icons/document.icns with `npm run icons` and commit them (59f97be)
- [X] T030 [US3] Add `win.fileAssociations` to package.json: `ext` `md`, `markdown`, `mdown`, `mkd`, `mkdn`; `name` `Folio.Markdown`; `description` `Markdown Document`; `mimeType` `text/markdown`; `role` `Editor`; `icon` build/icons/document.ico (59f97be)
- [X] T031 [US3] In package.json, ship build/icons/document.icns into the app bundle's Resources folder with `mac.extraResources`, and reference it as `CFBundleTypeIconFile` `document.icns` (59f97be)
- [X] T032 [US3] In README.md, rename "App icon" to "App & document icons" and add a "Markdown file associations" section covering Folio.Markdown, DefaultIcon, the fix for a per-user "Always use this app" override, and macOS `document.icns` (59f97be)

**Checkpoint**: User Stories 1–3 work. Associated Markdown files show the document icon and open in Folio.

---

## Phase 6: User Story 4 - The development runtime repairs itself on very new toolchains (Priority: P4)

**Goal**: The Electron runtime is repaired after `npm install` and before `npm start` or `dist*` when its own installer failed to unpack it. When the runtime is healthy, nothing happens.

**Independent Test**: quickstart.md Scenario 4. Delete the unpacked runtime, run `npm start` and confirm the repair, then confirm the next check is a no-op.

### Implementation for User Story 4

- [X] T033 [US4] Create scripts/ensure-electron.js with the platform executable map, the health check (`dist/version` equals the package version, `path.txt` equals the platform path, the executable exists) and a no-op exit when the runtime is healthy or Electron isn't installed (6bf8c90)
- [X] T034 [US4] Add to scripts/ensure-electron.js an architecture resolution that mirrors Electron's own installer (`npm_config_arch`, Rosetta → `arm64`), plus cache discovery (`electron_config_cache`, `ELECTRON_CACHE`, per-OS defaults) with a recursive search for `electron-v<version>-<platform>-<arch>.zip` (6bf8c90)
- [X] T035 [US4] Add the rest of the repair to scripts/ensure-electron.js: a download fallback through Electron's own installer script, native extraction (`ditto -x -k`, `Expand-Archive`, `unzip -o -q`), `electron.d.ts` hoisting, the `path.txt` write, post-extraction verification and `[ensure-electron]` error exits (6bf8c90)
- [X] T036 [US4] Add the `postinstall` and `ensure:electron` scripts to package.json, and prefix `start`, `dist`, `dist:win`, `dist:mac` and `dist:linux` with `npm run ensure:electron` (6bf8c90)
- [X] T037 [P] [US4] In README.md, add the bleeding-edge Node warning to the prerequisites and an "If Electron fails to install correctly" section covering native unzip, `npm run ensure:electron` and the LTS recommendation (6bf8c90)

**Checkpoint**: User Stories 1–4 work. A broken runtime unpack no longer blocks `npm start` or packaging.

---

## Phase 7: User Story 5 - Windows packaging survives file locks (Priority: P5)

**Goal**: Stale unpacked output is removed before packaging, a running packaged Folio is reported in plain words, and only the transient rcedit lock is retried.

**Independent Test**: quickstart.md Scenario 5. Run `npm run dist` while `release\win-unpacked\Folio.exe` is open and confirm the clear message; close Folio, re-run, and confirm packaging succeeds.

### Implementation for User Story 5

- [X] T038 [P] [US5] Create scripts/clean-release.js. It deletes every `release/*-unpacked` directory (`rmSync` with `maxRetries: 3`, `retryDelay: 200`) and does nothing when there is no `release/` folder. On `EBUSY`, `EPERM`, `ENOTEMPTY` or `EACCES` it stops with a "most likely a running Folio" message (002f2bb)
- [X] T039 [P] [US5] Create scripts/run-electron-builder.js. It forwards argv to the local electron-builder binary (the `.cmd` shim with `shell: true` on Windows) and tees its output. It retries only on `Unable to commit changes`, `rcedit-x64.exe` or `rcedit-ia32.exe`, with `MAX_ATTEMPTS = 3` and `RETRY_DELAY_MS = 4000`, and fails fast otherwise (002f2bb)
- [X] T040 [US5] Add the `clean:release` script to package.json, and end `dist`, `dist:win`, `dist:mac` and `dist:linux` with `npm run clean:release && node scripts/run-electron-builder.js`, adding `--win`, `--mac` or `--linux` as appropriate (002f2bb)
- [X] T041 [P] [US5] Document in README.md the rcedit "Unable to commit changes" failure, its causes (an antivirus scan or a running packaged Folio) and the automatic mitigation (002f2bb)

**Checkpoint**: User Stories 1–5 work. Windows lock failures are cleared automatically or explained.

---

## Phase 8: User Story 6 - Rebuild releases in one step and keep them working over time (Priority: P6)

**Goal**: A one-shot rebuild command, documented fixes for the Linux library failures and for a revoked macOS runtime, and an embedded runtime kept on a supported line.

**Independent Test**: quickstart.md Scenario 6. Run `pwsh scripts/build.ps1 -Clean` and check the artifact listing; follow the Linux prerequisites on Fedora or Ubuntu; run `spctl` on macOS.

### Implementation for User Story 6

- [X] T042 [P] [US6] Document the Linux packaging prerequisites in README.md: `libcrypt.so.1` for the .deb, `libfuse.so.2` for the AppImage, the install commands for Fedora/RHEL and Debian/Ubuntu, and the AppImage-only alternative (4b2248b)
- [X] T043 [US6] After Apple revoked Electron 31.7.7's notarization, upgrade `electron` from ^31.3.1 to ^43.2.0 together with `electron-builder` from ^24.13.3 to ^26.15.3 in package.json and package-lock.json (57f8363)
- [X] T044 [P] [US6] Write docs/macos-gatekeeper.md: symptoms, `spctl -a -vvv` diagnosis, root cause, the seven-step fix, the ad-hoc re-sign stopgap, prevention advice and the 2026-07-28 incident log (57f8363)
- [X] T045 [P] [US6] Create scripts/build.ps1 for PowerShell 7+ with `-Platform current|win|mac|linux`, `-Install`, `-Clean` and `-SkipIcons`, a fail-fast `Invoke-Npm`, a plain-words message for a locked `release/` folder, and a listing of the 10 largest artifacts by size (59f97be)
- [X] T046 [US6] Document "One-shot rebuild" in README.md: usage, options, and how `-Clean` differs from the cleanup `npm run dist` does (59f97be)

**Checkpoint**: All user stories are independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Dependency hygiene, cross-cutting documentation and gate validation

- [X] T047 Refresh dependencies in package.json and package-lock.json: `esbuild` ^0.28.2; Electron 43.7.7 and sharp 0.35.5 in the lockfile; expanded JSON arrays in the `build` block; and an `allowScripts` allowlist for `esbuild@0.28.2` and `electron-winstaller@5.4.0` (218bccc)
- [X] T048 [P] List build/icons/ and scripts/ in the "Project layout" section of README.md (59f97be)
- [X] T049 Run the packaging gates in specs/002-cross-platform-packaging/quickstart.md Scenario 7: gate 1 runs as the `build:renderer` stage of every dist script, and gate 4 is `npm run dist` on the host, as the commit messages record for Windows (dd44537, c5171da)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on T001. It blocks all user stories, because every story extends the `build` block or the `dist*` scripts.
- **User Stories (Phases 3–8)**: All depend on Foundational completion.
  - They can proceed in priority order (P1 → P6), or in parallel where their files don't overlap (see below).
- **Polish (Phase 9)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational. Depends on no other story.
- **User Story 2 (P2)**: Can start after Foundational. It adds icon fields to the `build` block and is independent of US1.
- **User Story 3 (P3)**: Needs US2's icon pipeline (T017, T018) to generate the document icon. T026 comes from the launch work in [003](../003-command-line-launch/spec.md) (61017d1) and can land before the rest of the story.
- **User Story 4 (P4)**: Can start after Setup, because it prefixes `start` and the `dist*` scripts. Independent of US1–US3.
- **User Story 5 (P5)**: Can start after Setup. T040 rewrites the same `dist*` lines as T036, so sequence those two tasks.
- **User Story 6 (P6)**: T045 calls `npm run icons` (US2) and the `dist*` scripts (Setup, US4, US5). T042, T043 and T044 are independent.

### Within Each User Story

- Source artwork comes before generation, and generation comes before wiring the outputs into package.json.
- A helper script comes before the npm script that calls it.
- README updates come after the behavior they describe; verification tasks come last.
- Finish each story before moving to the next priority.

### Parallel Opportunities

- Setup: T002 and T003.
- US1: T010 alongside T008 and T009.
- US2: T016, T017, T020 and T022.
- US3: T027 and T028.
- US4: T037 alongside T033–T036.
- US5: T038, T039 and T041.
- US6: T042, T044 and T045.
- Polish: T048 alongside T047.
- **Hotspot**: package.json is shared by most stories. Serialize the tasks that touch it: T001, T004–T006, T009, T012, T013, T018, T019, T026, T030, T031, T036, T040, T043 and T047.

---

## Parallel Example: User Story 5

```bash
# Launch both helpers together (different files, no shared state):
Task: "Create scripts/clean-release.js (delete release/*-unpacked, actionable lock message)"
Task: "Create scripts/run-electron-builder.js (forward argv, retry only on the rcedit lock signatures)"

# Documentation can proceed alongside:
Task: "Document the rcedit 'Unable to commit changes' failure and mitigation in README.md"

# Then wire both into package.json (T040).
```

## Parallel Example: User Story 2

```bash
Task: "Draw build/icons/icon.svg"
Task: "Create scripts/generate-icons.js"
Task: "Add appIconPath() and the BrowserWindow icon in src/main.js"
Task: "Document the icon workflow in README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL: blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 on each OS available.
5. Ship the installers if ready.

### Incremental Delivery

1. Setup + Foundational → `npm run dist` packages for the host.
2. Add User Story 1 → installers on all three OSes without admin rights or Developer Mode (MVP).
3. Add User Story 2 → Folio's own icon everywhere.
4. Add User Story 3 → Markdown files show the document icon and open in Folio.
5. Add User Story 4 → development and packaging survive bleeding-edge toolchains.
6. Add User Story 5 → Windows file locks are cleared or explained.
7. Add User Story 6 → one-shot rebuilds and documented recovery from environment failures.
8. Each story adds value without breaking the previous ones.

### As Actually Delivered (git history)

1. **2026-07-09**: Setup and Foundational (bd8f5ef); US1 Windows workaround (dd44537); US2 icon (c5171da, f96fc39).
2. **2026-07-10**: US1 .deb maintainer and US6 Linux prerequisites (4b2248b).
3. **2026-07-13**: US4 runtime self-heal (6bf8c90).
4. **2026-07-14**: US5 file-lock hardening (002f2bb).
5. **2026-07-16**: US2 artwork refresh (68e67be).
6. **2026-08-03**: US6 supported runtime line and macOS guide (57f8363).
7. **2026-08-04**: US3 macOS document types (61017d1).
8. **2026-08-20**: US3 document icon and associations, US6 `build.ps1`, US1 README note, Polish project layout (59f97be).
9. **2026-09-16**: US1 retirement of the Windows workaround (5f9a8a0).
10. **2026-09-30**: Polish dependency refresh (218bccc).

### Parallel Team Strategy

With a single maintainer, work in priority order. With help:

1. Finish Setup and Foundational together.
2. Then split along file lines:
   - One person on artwork and associations (US2, US3: `build/icons/`, `scripts/generate-icons.js`).
   - Another on build helpers (US4, US5: `scripts/ensure-electron.js`, `scripts/clean-release.js`, `scripts/run-electron-builder.js`).
   - Coordinate every package.json edit.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable (quickstart.md Scenarios 1–6)
- No automated tests were requested; verification follows quickstart.md and the constitution's gates
- Commit after each task or logical group; the trailing hash records where each task landed
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts (package.json and README.md are the shared files here), cross-story dependencies that break independence
- Open follow-ups are not tasks here: research.md → Retroactive findings lists the drift for a new feature directory (flow-forward)
