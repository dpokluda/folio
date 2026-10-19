---

description: "Task list for Folder Mode, Link Navigation & Back/Forward History"
---

# Tasks: Folder Mode, Link Navigation & Back/Forward History

**Input**: Design documents from `/specs/005-folder-mode-navigation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner; validation is manual per [quickstart.md](./quickstart.md) and the constitution's verification gates, so no test tasks are generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Retroactive Record**: Reconstructed 2026-10-18 from the diffs of `e2e2877`, `356cf20`, `4a9cc98` (Close Folder only), `8062af5` (guarded external open and folder refinements only), `f8f17fa` and `4ebcdb2`. Every task is complete (`[X]`) and ends with the commit that delivered it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single desktop project: main-process CommonJS modules in `src/`, the bundled renderer in `src/renderer/`, user documentation in `README.md`, all at the repository root (see plan.md → Project Structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The Electron-free folder module and the settings keys every story builds on

- [X] T001 Create the Electron-free module src/folder.js (requires only `fs`, `path`, `url`) with `MD_EXTS` (`.md`, `.markdown`, `.mdown`, `.mkd`, `.markdn`, `.mdtext`, `.mdtxt`), `SKIP_DIRS` (`node_modules`, `.git`, `.obsidian`, `.vscode`, `.idea`), `MAX_TREE_DEPTH = 16` and `isMarkdownFile()` (lower-cased extension check) (e2e2877)
- [X] T002 [P] Add `filesVisible: false` and `folder: null` to `DEFAULTS` in src/store.js (e2e2877)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The navigation pipeline shared by explorer clicks (US1), document links (US2) and external targets (US3)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement `folderIndexDoc(dir)` in src/folder.js, returning the first existing `_index.md`, `README.md`, `readme.md` or `index.md` in the folder, or `null` (e2e2877)
- [X] T004 Implement `resolveNavTarget(payload)` in src/folder.js: accept `{ path }` or `{ href, fromPath }`, split the `#anchor` off `href` (empty remainder → `null`), convert `file://` with `fileURLToPath()`, otherwise `decodeURIComponent()` (raw on error) and `/` → `path.sep`, keep absolute paths, resolve relative ones against `path.dirname(fromPath)` (no `fromPath` → `null`), then classify with `fs.statSync()` into `markdown` (file or folder index), `folder-empty`, `external` or `missing` (e2e2877)
- [X] T005 Extend `loadFile(filePath, anchor = null)` in src/main.js to send `anchor: anchor || null` in the `load-document` payload (e2e2877)
- [X] T006 Add `ipcMain.handle('navigate')` in src/main.js: `markdown` → `confirmDiscardIfDirty()` then `loadFile(target.path, target.anchor)`; `folder-empty` → info "Nothing to display for this folder." with the "Add an _index.md (or README.md)" hint; `missing` → warning "Cannot find the linked item."; `external` → hand the path to the OS; reply `{ ok }`, `{ ok: false, canceled: true }` or `{ ok: false, external: true }` (e2e2877)
- [X] T007 [P] Expose `navigate: (payload) => ipcRenderer.invoke('navigate', payload)` and `onOpenFolder: (cb) => listen('open-folder', cb)` on `window.folioAPI` in src/preload.js (e2e2877)
- [X] T008 Add the `navigateTo(payload)` helper in src/renderer/renderer.js that invokes `window.folioAPI.navigate()` and only logs a rejection, leaving the visible result to `load-document` or a dialog (e2e2877)

**Checkpoint**: Foundation ready. Any `{ path }` or `{ href, fromPath }` request resolves and displays in place, so user story work can begin.

---

## Phase 3: User Story 1 - Browse a folder of Markdown files (Priority: P1) 🎯 MVP

**Goal**: File > Open Folder… shows a left-hand explorer of the folder's Markdown files, opens the entry document, displays clicked files in place and keeps the highlight in sync.

**Independent Test**: Quickstart Scenario 1: open `folio-qs-005`, check the listed tree and exclusions, the entry document, clicking files, the highlight, toggling the pane and the unsaved-changes prompt.

### Implementation for User Story 1

- [X] T009 [US1] Implement `scanFolder(dir, depth = 0)` in src/folder.js: skip names starting with `.` and `SKIP_DIRS`, keep only `isMarkdownFile()` files, add a folder only if "`children.length > 0`", enter folders only while "`depth < MAX_TREE_DEPTH`", sort folders then files with `localeCompare(…, undefined, { numeric: true, sensitivity: 'base' })`, and return `[]` for an unreadable folder (e2e2877)
- [X] T010 [US1] Implement `entryDocFor(tree)` and `firstMarkdownIn(nodes)` in src/folder.js: the first top-level file named `_index.md`, `readme.md` or `index.md` (lower-cased comparison, in that order), else the first file of a level before descending into its folders, else `null` (e2e2877)
- [X] T011 [US1] Implement `doOpenFolder()` (unsaved-changes guard before `dialog.showOpenDialog({ properties: ['openDirectory'] })`) and `openFolder(dir, { openEntry })` (scan, set the current folder, `store.set('folder', dir)`, `store.set('filesVisible', true)`, send `open-folder` with `{ root: dir, name: path.basename(dir) || dir, tree }`, then `loadFile()` the `entryDocFor(tree)` result) in src/main.js (e2e2877)
- [X] T012 [US1] Add File > Open Folder… (`CmdOrCtrl+Shift+K` at the time) and View > Toggle File Explorer (`CmdOrCtrl+Shift+E` at the time) to src/menu.js, with `actions.openFolder` and `actions.toggleFiles` (sends `command` `{ name: 'toggle-files' }`) in src/main.js (e2e2877)
- [X] T013 [P] [US1] Add `aside#folio-files` (`#folio-files-title`, `nav#folio-files-tree`) before the outline pane and the status-bar `button#btn-files` (📁 **Files**) in src/renderer/index.html (e2e2877)
- [X] T014 [P] [US1] Style `#folio-files` (260 px pane), `.files-row`, `.files-twisty`, `.files-ico`, `.files-name` and `.files-file.active` with light rules and overrides inside `@media (prefers-color-scheme: dark)` in src/renderer/app.css (e2e2877)
- [X] T015 [US1] Render the explorer in src/renderer/renderer.js: `state.folder`, `state.tree`, `state.expanded`; `setFolder(payload, show)`; `renderFileTree()` with the "No markdown files" and "No folder open" placeholders; `renderTreeNode()` with ▸/▾ twisties, 📁/📂/📄 icons, the full-path tooltip, folder clicks toggling expansion and file clicks calling `navigateTo({ path })`; wire `onOpenFolder` (e2e2877)
- [X] T016 [US1] Keep the explorer in sync in src/renderer/renderer.js: `normPath()`/`samePath()` (separators normalized, lower-cased), `expandAncestorsOf()`, `syncFileTree()` called from `loadDocument()` and `onDocumentPathChanged`, and scroll the `.files-file.active` row into view (e2e2877)
- [X] T017 [US1] Add `setFilesVisible()`, the **Files** button handler, the `toggle-files` command and `filesVisible` in `persistState()` in src/renderer/renderer.js, and store `filesVisible` from `state-changed` only when `typeof state.filesVisible === 'boolean'` in src/main.js (e2e2877)
- [X] T018 [US1] Return `folder` and `settings.filesVisible` from `get-init` in src/main.js (filled from the stored `folder` until `5c48052` in 003) and apply them in `boot()` in src/renderer/renderer.js: `setFolder(init.folder, null)` before the first `loadDocument()`, then `setFilesVisible(!!s.filesVisible && !!state.folder)` (e2e2877)
- [X] T019 [US1] Start the explorer collapsed by removing the pre-expansion of top-level folders from `setFolder()`, so only `expandAncestorsOf(state.path)` opens folders, in src/renderer/renderer.js (356cf20)
- [X] T020 [US1] Remap File > Open Folder… to `CmdOrCtrl+Shift+O` and move View > Toggle Outline to `CmdOrCtrl+Shift+K` in src/menu.js (356cf20)

**Checkpoint**: User Story 1 is fully functional and testable on its own (Quickstart Scenario 1).

---

## Phase 4: User Story 2 - Follow links between documents in place (Priority: P2)

**Goal**: Clicking a link to a Markdown file or folder in the preview opens it in the same window, scrolled to its `#fragment`; in-page anchors scroll; untitled documents ignore relative links.

**Independent Test**: Quickstart Scenario 2: follow the folder, fragment, duplicate-heading, folder-without-index, missing-file and in-page links of `README.md`, and the relative and absolute links of an untitled document.

### Implementation for User Story 2

- [X] T021 [US2] Rewrite `wireLinks()` in src/renderer/renderer.js to intercept every `#write a[href]` with `preventDefault()`: `^(https?:|mailto:)` → `window.folioAPI.openExternal(href)`, `#…` → `scrollToAnchor()`, anything else → `navigateTo({ href, fromPath: state.path })` (e2e2877)
- [X] T022 [US2] Replace the index-suffixed `slugify(text, index)` ids with GitHub-style ids in src/renderer/renderer.js: `githubSlug()` (lower-case, trim, drop `[^\w\s-]`, whitespace → `-`) and `assignHeadingIds()` ("Existing `id` kept; otherwise `githubSlug(text)` … empty → `section`", repeats suffixed `-1`, `-2`, …), called from `buildOutline()` (e2e2877)
- [X] T023 [US2] Implement `scrollToAnchor(rawId)` (decode, then match the id, its slug, or a heading whose text slugifies the same; smooth scroll) and carry `load-document.anchor` through `state.pendingAnchor`, applied with `requestAnimationFrame()` after `renderPreview()` in `loadDocument()`, in src/renderer/renderer.js (e2e2877)

**Checkpoint**: User Stories 1 and 2 both work independently; links also work for single files opened with File > Open….

---

## Phase 5: User Story 3 - Open web links and other files safely (Priority: P3)

**Goal**: Web links go to the system browser; non-Markdown local targets are blocked (network paths, executables and scripts) or opened only after an explicit confirmation that shows the absolute path.

**Independent Test**: Quickstart Scenario 3: click the Web, Script, Data and Mail links (and, on Windows, a `//server/share` link).

### Implementation for User Story 3

- [X] T024 [US3] Define `UNSAFE_OPEN_EXTENSIONS` in src/main.js with the 28 executable and script types (`.exe`, `.bat`, `.cmd`, `.com`, `.msi`, `.scr`, `.pif`, `.cpl`, `.ps1`, `.psm1`, `.vbs`, `.vbe`, `.js`, `.jse`, `.wsf`, `.wsh`, `.hta`, `.jar`, `.reg`, `.lnk`, `.sh`, `.bash`, `.zsh`, `.py`, `.rb`, `.pl`, `.app`, `.command`) (8062af5)
- [X] T025 [US3] Implement `openExternalTarget(session, target)` in src/main.js: refuse `^(\\\\|//)` with "Blocked opening a network location.", refuse `UNSAFE_OPEN_EXTENSIONS` with "Blocked opening an executable or script.", otherwise ask "Open this file with its default application?" with `path.resolve(target)` as detail and Cancel as `defaultId` and `cancelId`, and call `shell.openPath(target)` only on Open (8062af5)
- [X] T026 [US3] Route the `navigate` handler's `external` kind through `await openExternalTarget(session, target.path)` instead of calling `shell.openPath()` directly in src/main.js (8062af5)
- [X] T027 [US3] Deny every `window.open` with `setWindowOpenHandler` and cancel non-`file://` `will-navigate` events in `createWindow()` in src/main.js, forwarding `http(s)` URLs to `shell.openExternal()` (8062af5)

**Checkpoint**: No document link can launch a program or open a network location; other files need explicit consent.

---

## Phase 6: User Story 4 - Go back and forward through visited documents (Priority: P4)

**Goal**: A per-window, browser-style history of displayed files with Go > Back and Go > Forward, guarded against unsaved edits.

**Independent Test**: Quickstart Scenario 4: follow two links, go Back twice and Forward twice, check truncation, the guard, a deleted entry and the reset on Help > Welcome.

### Implementation for User Story 4

- [X] T028 [US4] Add `history = []` and `historyIndex = -1` to `class Session` in src/main.js ("`-1` if and only if `history` is empty") (4ebcdb2)
- [X] T029 [US4] Implement `recordHistory()` (drop entries after `historyIndex`; "Only `history[historyIndex].anchor` updated" when the file is already the current entry), `resetHistory(session, filePath = null)`, `canGoBack()` and `canGoForward()` in src/main.js (4ebcdb2)
- [X] T030 [US4] Add the `{ record = true }` option to `loadFile()` and call `recordHistory(session, filePath, anchor)` when it is set in src/main.js (4ebcdb2)
- [X] T031 [US4] Implement `navigateHistory(session, delta)` in src/main.js: bounds check, "That document is no longer available." when the entry's file is gone, `confirmDiscardIfDirty()`, then set `historyIndex` and `loadFile(entry.path, entry.anchor, { record: false })` (4ebcdb2)
- [X] T032 [US4] Reset or seed the history in `loadBuiltinDoc()`, `doNew()`, `openFolder()` and `get-init` (`resetHistory(session, document.path || null)`) in src/main.js (4ebcdb2)
- [X] T033 [US4] Add the Go menu after Edit in src/menu.js (Back `Cmd+[` on macOS or `Alt+Left`, Forward `Cmd+]` or `Alt+Right`, `enabled` from `canGoBack`/`canGoForward`), and pass `canGoBack(session)`/`canGoForward(session)` and `actions.back`/`actions.forward` from `rebuildMenu()` in src/main.js (4ebcdb2)

**Checkpoint**: Back and Forward work in every window, with menu items enabled exactly when a step exists.

---

## Phase 7: User Story 5 - Close the folder (Priority: P5)

**Goal**: File > Close Folder clears and hides the explorer, forgets the folder and returns to the Welcome document, behind the unsaved-changes guard.

**Independent Test**: Quickstart Scenario 5: close an open folder, check the window, the menu and the saved settings, then repeat with unsaved edits and Cancel.

### Implementation for User Story 5

- [X] T034 [US5] Split `openBuiltinDoc()` into the guarded wrapper and an unguarded `loadBuiltinDoc()` in src/main.js, so Close Folder shows Welcome without a second unsaved-changes prompt (4a9cc98)
- [X] T035 [US5] Implement `doCloseFolder()` in src/main.js: return when no folder is open, `confirmDiscardIfDirty()`, clear the folder, `store.set('folder', null)`, `store.set('filesVisible', false)`, send `open-folder` with `null`, `loadBuiltinDoc('welcome')` and `rebuildMenu()` (4a9cc98)
- [X] T036 [US5] Add File > Close Folder (`CmdOrCtrl+Shift+W`, `enabled: !!hasFolder`) to src/menu.js, and pass `hasFolder` from `rebuildMenu()`, add `actions.closeFolder` and rebuild the menu at the end of `openFolder()` in src/main.js (4a9cc98)
- [X] T037 [US5] Hide and clear the explorer when `open-folder` carries `null` by calling `setFolder(payload, !!payload)` in src/renderer/renderer.js (4a9cc98)

**Checkpoint**: The folder life cycle (open, browse, close) is complete.

---

## Phase 8: User Story 6 - See where a link points before clicking (Priority: P6)

**Goal**: A browser-style hint at the bottom-left of the document area shows a hovered link's target.

**Independent Test**: Quickstart Scenario 6: hover relative, web, mail and in-page links; leave the link; switch to source mode; check truncation.

### Implementation for User Story 6

- [X] T038 [P] [US6] Add `div#folio-link-hint` (`hidden`, `aria-hidden="true"`) inside `#folio-content` in src/renderer/index.html (f8f17fa)
- [X] T039 [P] [US6] Style `#folio-link-hint` in src/renderer/app.css: absolute at the bottom-left, `max-width: min(80%, 640px)`, single line with ellipsis, `pointer-events: none`, plus a dark-mode override (f8f17fa)
- [X] T040 [US6] Implement `linkHintText()`, `showLinkHint()`, `hideLinkHint()` and `setupLinkHint()` (delegated `mouseover`/`mouseout` on `#write`, `mouseleave` on `#folio-preview`, wired once from `boot()`) in src/renderer/renderer.js (f8f17fa)
- [X] T041 [US6] Call `hideLinkHint()` in `renderPreview()` and when `setSourceMode(true)` hides the preview in src/renderer/renderer.js (f8f17fa)

**Checkpoint**: All six user stories are independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Refinements that affect several stories, documentation, and validation

- [X] T042 [P] Introduce the shared `INDEX_DOC_NAMES = ['_index.md', 'readme.md', 'index.md']` in src/folder.js, drive `entryDocFor()` from it, and make `folderIndexDoc()` match it case-insensitively through `readdirSync()` on every platform (8062af5)
- [X] T043 [P] Move the folder state and handlers onto the per-window `Session` in src/main.js: `session.currentFolder`, `doOpenFolder(session)`, `openFolder(session, …)` and `doCloseFolder(session)` run through `withSession()`, and `navigate` and `get-init` resolve `sessionFor(event.sender)` (8062af5)
- [X] T044 [P] Document folder mode in README.md: Features bullet, How to use → Open a folder, the **Files** status-bar button, and the `src/folder.js` entry in Project layout (e2e2877)
- [X] T045 Update the Open Folder and Toggle Outline shortcuts in README.md (356cf20)
- [X] T046 Document File > Close Folder (`Ctrl/Cmd+Shift+W`) in README.md (4a9cc98)
- [X] T047 Document Go > Back and Go > Forward with their per-platform keys in the Features and How to use sections of README.md (4ebcdb2)
- [X] T048 Validate the shipped feature with specs/005-folder-mode-navigation/quickstart.md: gate 1 build, Scenarios 1–6 including the unsaved-changes guard, Light/Dark and every Style, and the Principle III review of `navigate`, `open-folder` and external opening (4ebcdb2)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on T001; BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1, US2, US3, US4 and US6 can then proceed in parallel (if staffed); US5 needs US1
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5 → P6)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2); no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational; independent of US1 (links work without an open folder); its in-folder navigation shows up in the US1 explorer through `syncFileTree()`
- **User Story 3 (P3)**: Can start after Foundational (it replaces T006's `external` branch); independent of US1; reached through the links of US2
- **User Story 4 (P4)**: Can start after Foundational; records every `loadFile()` from US1 and US2 but is testable with File > Open… and links alone
- **User Story 5 (P5)**: Depends on US1 (a folder must be open to close it)
- **User Story 6 (P6)**: Can start after Foundational; needs only the rendered preview from 001

### Within Each User Story

- `src/folder.js` logic before the `src/main.js` handlers that call it
- Main-process actions before the `src/menu.js` items that invoke them
- Markup (`index.html`) and styles (`app.css`) in parallel, before the `renderer.js` behavior that uses them
- Story complete before moving to the next priority

### Parallel Opportunities

- T002 (`src/store.js`) runs alongside T001 (`src/folder.js`)
- T007 (`src/preload.js`) runs alongside T005–T006 (`src/main.js`)
- T013 (`index.html`) and T014 (`app.css`) run alongside each other and alongside T009–T012
- T038 and T039 run alongside each other
- T042 (`src/folder.js`), T043 (`src/main.js`) and T044 (`README.md`) run alongside each other
- US3, US4 and US5 all edit `src/main.js`, so a single developer sequences them even though they are logically independent

---

## Parallel Example: User Story 1

```bash
# Once T009–T012 have defined the tree and the menu wiring, the presentation tasks touch separate files:
Task: "Add aside#folio-files and button#btn-files in src/renderer/index.html"
Task: "Style #folio-files, .files-row and .files-file.active (light and dark) in src/renderer/app.css"
```

## Parallel Example: User Story 6

```bash
Task: "Add div#folio-link-hint inside #folio-content in src/renderer/index.html"
Task: "Style #folio-link-hint (bottom-left, ellipsis, pointer-events: none, dark override) in src/renderer/app.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run Quickstart Scenario 1
5. Deploy/demo if ready

### Incremental Delivery (as it happened)

1. `e2e2877` (2026-07-14 09:52): Setup + Foundational + US1 + US2 shipped together as the folder-mode MVP
2. `356cf20` (2026-07-14 10:03): US1 refinements (collapsed start, Open Folder shortcut)
3. `4a9cc98` (2026-07-14 11:04): US5 Close Folder
4. `8062af5` (2026-07-14 16:10): US3 guarded external open, plus T042–T043 polish
5. `f8f17fa` (2026-07-15): US6 hover hint
6. `4ebcdb2` (2026-07-20): US4 Back/Forward
7. Each step added value without breaking the previous ones

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1, then User Story 5
   - Developer B: User Story 2, then User Story 6
   - Developer C: User Story 3, then User Story 4 (both in `src/main.js`)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps each task to a user story for traceability
- Each user story is independently completable and testable through its quickstart scenario
- All tasks are `[X]`: this is a retroactive record, and the commit in parentheses is the evidence
- Changes made later by other features are not tasks here: `5c48052` (003) stopped restoring the last folder at launch; `68e67be` (008) moved Toggle File Explorer to `Ctrl/Cmd+Alt+E` and added the Windows/Linux key handler; `8062af5` also invalidates the Find in Files cache in `openFolder()`/`doCloseFolder()` (006)
- README gaps found during reconstruction (hover hint, the stale "remembered between launches" sentence, the `index.md` fallback) were never done, so they are not listed as tasks; see research.md → Retroactive findings
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
