---

description: "Task list for Three-Axis Theming: Style × Appearance × Page Width"
---

# Tasks: Three-Axis Theming: Style × Appearance × Page Width

**Input**: Design documents from `/specs/004-three-axis-theming/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested. Folio has no automated test runner; every story is validated manually with [quickstart.md](./quickstart.md) and the constitution's verification gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Retroactive Record**: Generated 2026-10-18 from the diffs of `1f452ec` (2026-07-14) and `4f48e69` (2026-07-16), plus the multi-window broadcast in `8062af5` (2026-07-14, owned by [007-multiple-windows](../007-multiple-windows/spec.md)). Every task is complete (`[X]`) and ends with the commit that delivered it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions; the trailing `(hash)` is the delivering commit

## Path Conventions

- **Desktop app (Electron)**: main-process modules in `src/`, renderer in `src/renderer/`, Typora-compatible themes in `themes/`, all at the repository root
- No `tests/` directory exists; validation is manual (see quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce the three-axis vocabulary and the new settings shape that every story reads

- [X] T001 [P] Define the axis whitelists `STYLE_FAMILIES = ['fluent', 'github', 'word']`, `APPEARANCES = ['light', 'dark']` and `PAGE_WIDTHS = ['dynamic', 'a4', 'letter']` and import `nativeTheme` from `electron` in src/main.js (1f452ec)
- [X] T002 [P] Replace the `theme: 'fluent.css'` default with `styleFamily: 'fluent'`, `appearance: 'light'` and `pageWidth: 'dynamic'` in `DEFAULTS` in src/store.js (1f452ec)
- [X] T003 [P] Remove the single `<link id="theme-style">` placeholder from src/renderer/index.html and note that theme layers are appended at runtime as `<link class="folio-theme">` elements after `app.css` (1f452ec)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The main-process → renderer layer-stack pipeline that every story relies on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Turn the Fluent width partials into standalone overlays — remove `@import url('fluent.css')` and rewrite the header comment — in themes/fluent-a4.css, themes/fluent-dynamic.css and themes/fluent-us-letter.css (1f452ec)
- [X] T005 [P] Implement `familyLayers(family)`, `widthLayer(family, width)` and `composeThemeFiles()` — whitelisting the stored `styleFamily`/`pageWidth` and falling back to `'fluent'`/`'dynamic'` — in src/main.js (1f452ec)
- [X] T006 [P] Rewrite `applyTheme(payload)` to accept an array or `{ files }`, remove every `link.folio-theme`, append one `<link rel="stylesheet" class="folio-theme">` per file in order (`href = state.themesBaseUrl + file`) and track `state.themeFiles` in src/renderer/renderer.js (1f452ec)
- [X] T007 Return `themeFiles: composeThemeFiles()` from the `get-init` handler (dropping the `themes`/`theme` fields and `listThemes()`) in src/main.js, and call `applyTheme(init.themeFiles)` in `boot()` in src/renderer/renderer.js (1f452ec)
- [X] T008 Add `pushTheme()` that sends `set-theme` with `{ files: composeThemeFiles() }` to the renderer in src/main.js (1f452ec)

**Checkpoint**: Foundation ready — a composed list reaches the renderer at startup and on demand; user story work can begin

---

## Phase 3: User Story 1 - Compose the page look from a Style and a Page width (Priority: P1) 🎯 MVP

**Goal**: The Themes menu offers Style and Page Width groups whose choices are composed into the look of the rendered page and the source editor, replacing 001's flat list of theme files

**Independent Test**: Open Help ▸ Markdown Formatting Tour and step through all three Styles and all three Page widths; each choice restyles the page (and the source editor in source mode) immediately and only the mark in the group used moves (quickstart.md Scenario 1)

### Implementation for User Story 1

- [X] T009 [P] [US1] Replace the folder-driven theme list (`titleCaseTheme()`, "(No themes found)") with a fixed Themes submenu — disabled "Style" header, Fluent / GitHub / Microsoft Word radios, separator, disabled "Page Width" header, Dynamic / A4 / US Letter radios — and change the `buildMenu()` parameters to `styleFamily`, `appearance`, `pageWidth` in src/menu.js (1f452ec)
- [X] T010 [US1] Feed `styleFamily`/`appearance`/`pageWidth` from the store into `buildMenu()` in `rebuildMenu()` and add the `setStyleFamily` and `setPageWidth` actions (`store.set` → `pushTheme()` → `rebuildMenu()`) in src/main.js (1f452ec)
- [X] T011 [P] [US1] Author the GitHub (Primer) Style overlay — `--gh-*` palette variables, system-UI and monospace font stacks, 600-weight headings with rules under h1/h2, Primer blockquote, tinted inline and fenced code, bordered tables and hr — in themes/github.css (1f452ec)
- [X] T012 [P] [US1] Delete the pre-combined `@import` wrappers themes/microsoft-word-a4.css, themes/microsoft-word-dynamic.css and themes/microsoft-word-us-letter.css so the Word Style is composed from themes/microsoft-word/word-type.css plus themes/microsoft-word/word-page-a4.css, themes/microsoft-word/word-page-letter.css or themes/microsoft-word/word-page-dynamic.css (1f452ec)

**Checkpoint**: User Story 1 is fully functional — nine Style × Page width looks in Light, switchable without restart and without touching unsaved edits

---

## Phase 4: User Story 2 - Switch the whole app between Light and Dark (Priority: P2)

**Goal**: An Appearance group flips the whole app — every theme layer, Folio's chrome and code colours — between light and dark palettes without swapping files

**Independent Test**: Toggle Appearance for each of the nine Style × Page width combinations, in the rendered view and in source mode; no light sheet, backdrop or panel remains under Dark (quickstart.md Scenario 2)

### Implementation for User Story 2

- [X] T013 [US2] Add `applyAppearance()` — `nativeTheme.themeSource = store.get('appearance') === 'dark' ? 'dark' : 'light'` — and call it at the end of `createWindow()` in src/main.js (1f452ec)
- [X] T014 [US2] Add the `setAppearance` action (`store.set('appearance', …)` → `applyAppearance()` → `rebuildMenu()`) in src/main.js (1f452ec)
- [X] T015 [US2] Add the Appearance group — disabled "Appearance" header, Light (checked unless `appearance === 'dark'`) and Dark radios, separators on both sides — between the Style and Page Width groups in src/menu.js (1f452ec)
- [X] T016 [P] [US2] Add `@media (prefers-color-scheme: dark)` blocks darkening the backdrop (`--bg-color: #0a0b0d`), the sheet (`#17181b`), zebra rows (`#1c1e22`) and the source-mode background (`#0f1012`) in themes/fluent-a4.css, themes/fluent-dynamic.css and themes/fluent-us-letter.css (1f452ec)
- [X] T017 [P] [US2] Add the Primer dark palette (`--gh-*` overrides, `--bg-color: #0d1117`, `--side-bar-bg-color: #010409`) to themes/github.css (1f452ec)
- [X] T018 [P] [US2] Add the Word "page on a darker desk" dark block — sheet `#1b1c1f` on `#0a0b0d`, light-grey monochrome headings, quotes and links, dark source-mode background — to themes/microsoft-word/word-type.css (1f452ec)
- [X] T019 [P] [US2] Add a dark block for Folio's chrome — outline sidebar, status bar, source-editor selection — and a GitHub-dark palette for the highlight.js token classes in src/renderer/app.css (1f452ec)

**Checkpoint**: User Stories 1 and 2 both work independently — all 18 looks are reachable

---

## Phase 5: User Story 3 - Keep my theme across launches and upgrades (Priority: P3)

**Goal**: The three choices persist across launches, and an upgrading user's single-theme preference is converted once into the matching Style and Page width

**Independent Test**: Choose GitHub/Dark/US Letter, quit and relaunch; then seed `"theme": "microsoft-word-us-letter.css"` in the settings file and relaunch (quickstart.md Scenario 3)

### Implementation for User Story 3

- [X] T020 [US3] Implement `migrateLegacyTheme(parsed)` in src/store.js: return `null` when `styleFamily` is already saved or `theme` is not a string; otherwise lower-case the name and map `word` → `'word'`, `github` → `'github'`, else `'fluent'`, and `letter` → `'letter'`, `a4` → `'a4'`, else `'dynamic'`, always with `appearance: 'light'` (1f452ec)
- [X] T021 [US3] Apply the migration in the `Store` constructor — merge `{ ...DEFAULTS, ...parsed, ...migrated }`, `delete this.data.theme`, and `_flush()` once when a migration happened — in src/store.js (1f452ec)

**Checkpoint**: Selections survive restarts and upgrades; unreadable or unrecognised values fall back to Fluent / Light / Dynamic

---

## Phase 6: User Story 4 - Export PDFs on the selected paper size (Priority: P4)

**Goal**: Export to PDF uses Letter paper for US Letter and A4 paper for A4 and Dynamic

**Independent Test**: Export the same document with each Page width and inspect the PDF page size (quickstart.md Scenario 4)

### Implementation for User Story 4

- [X] T022 [US4] Replace `pageSizeForTheme()` (theme-filename sniffing) with `pageSizeForWidth()` returning `'Letter'` only for `pageWidth === 'letter'` and `'A4'` otherwise, and pass it as `pageSize` to `printToPDF()` in `doExportPDF()` in src/main.js (1f452ec)

**Checkpoint**: PDF paper size follows the Page width regardless of Style and Appearance

---

## Phase 7: User Story 5 - Keep using my Typora themes and add one as a new Style (Priority: P5)

**Goal**: A symmetric `themes/` layout (shared `base.css` + one folder per Style with `dynamic.css`, `a4.css`, `us-letter.css`) and a documented procedure make adding a Typora theme as a Style "one folder plus a registration"

**Independent Test**: Following only the README, add a copy of a bundled Style under a new name, register it, and check it with all three Page widths and both Appearances without editing existing theme files (quickstart.md Scenario 5)

### Implementation for User Story 5

- [X] T023 [US5] Replace README.md's "drop any `.css` into `themes/` and restart" instructions with registering the theme as a new Style in `familyLayers`/`STYLE_FAMILIES` (src/main.js) plus a radio entry in src/menu.js, noting that a `@media (prefers-color-scheme: dark)` palette makes it Dark-aware (1f452ec)
- [X] T024 [US5] Rename the foundation `fluent.css` to themes/base.css and add a header describing it as the shared foundation that also carries the Fluent palette (4f48e69)
- [X] T025 [P] [US5] Move the Fluent width overlays to themes/fluent/a4.css, themes/fluent/dynamic.css and themes/fluent/us-letter.css, pointing their headers at `base.css` (4f48e69)
- [X] T026 [P] [US5] Move the GitHub overlay to themes/github/github.css and give GitHub its own width overlays themes/github/a4.css, themes/github/dynamic.css and themes/github/us-letter.css, carrying Fluent's geometry and dark rules (4f48e69)
- [X] T027 [P] [US5] Move the Word family overlay and width overlays into themes/word/word.css, themes/word/a4.css, themes/word/dynamic.css and themes/word/us-letter.css with family-vs-width header comments, and move the fonts note to themes/word/fonts/README.txt (4f48e69)
- [X] T028 [US5] Point `familyLayers()` at `base.css` plus `github/github.css` or `word/word.css`, collapse `widthLayer()` to the uniform `<family>/<width>.css` path, and document the symmetric layout in the theming comment in src/main.js (4f48e69)
- [X] T029 [P] [US5] Update the Aptos exclusion in .gitignore to `themes/word/fonts/*.ttf`, confirming the `extraResources` filter `!**/fonts/*.ttf` in package.json still matches the new folder (4f48e69)
- [X] T030 [US5] Document the symmetric `themes/` tree, the per-Style layer table ("Fluent needs no family overlay") and the updated new-Style procedure (create `themes/<family>/`, register it, use a self-contained theme as its own base) in the Themes section of README.md (4f48e69)

**Checkpoint**: All user stories are independently functional; every Style follows the same folder contract

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, multi-window integration and gate validation that span several stories

- [X] T031 [P] Rewrite README.md for the three axes — Features bullet, theming-contract bullet (layer stack plus `nativeTheme` dark mode), How to use ("Switch themes"; "Export to PDF … follows the active Page width") and the Themes section (axis table, 3 × 2 × 3 = 18 combinations, layer table, "Appearance is not a file swap") (1f452ec)
- [X] T032 Broadcast Style/Page-width changes to every open window by replacing `pushTheme()` with `pushThemeAll()` over all Sessions in src/main.js, delivered with the per-window Sessions of [007-multiple-windows](../007-multiple-windows/spec.md); Appearance is already app-wide (8062af5)
- [X] T033 [P] Update README.md's Aptos note to `themes/word/fonts/` and the project-layout line to "base.css + per-family folders (fluent/ github/ word/)" (4f48e69)
- [X] T034 Run the quickstart.md scenarios and constitution gates 1–5 against the final layout (themes/base.css, themes/fluent/, themes/github/, themes/word/, src/main.js, src/menu.js, src/store.js): `npm run build:renderer`, smoke test with unsaved edits, Light/Dark × every Style, `npm run dist` font exclusion, Principle III review of the `set-theme`/`get-init` payloads (4f48e69)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational completion
  - US1 → US2 → US3 → US4 → US5 in priority order (US3 and US4 could also run in parallel with US1/US2)
- **Polish (Phase 8)**: T031 after US1–US4; T032 after US1 and 007's per-window Sessions; T033 after US5; T034 last

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependency on other stories
- **User Story 2 (P2)**: Starts after Foundational — T015 inserts its group into US1's Themes submenu (T009), but Dark is testable on its own
- **User Story 3 (P3)**: Needs only T002 (new defaults); the persistence half is observable once the setters exist (T010, T014), the migration half is testable alone by seeding the settings file
- **User Story 4 (P4)**: Needs only T002 (`pageWidth` key) — independent of the other stories
- **User Story 5 (P5)**: Restructures the files created by US1 and US2 and must carry their light and dark rules along; T023 needs the registration points from T009/T010

### Within Each User Story

- Main-process state and actions (src/main.js) before the menu items that call them (src/menu.js)
- Theme stylesheet tasks marked [P] are independent of each other and of the JavaScript tasks
- Story complete (checkpoint passed in quickstart.md) before moving to the next priority

### Parallel Opportunities

- Setup: T001, T002, T003 (three different files)
- Foundational: T004, T005, T006 (theme CSS, src/main.js, src/renderer/renderer.js)
- US1: T009, T011, T012 alongside each other; T010 after T009
- US2: T016, T017, T018, T019 (four different stylesheets) while T013–T015 proceed
- US5: T025, T026, T027, T029 after T024

---

## Parallel Example: User Story 2

```bash
# Launch the four dark-palette tasks for User Story 2 together:
Task: "Add dark blocks to themes/fluent-a4.css, themes/fluent-dynamic.css and themes/fluent-us-letter.css"
Task: "Add the Primer dark palette to themes/github.css"
Task: "Add the Word dark block to themes/microsoft-word/word-type.css"
Task: "Add the chrome + highlight.js dark block to src/renderer/app.css"
```

## Parallel Example: User Story 5

```bash
# After T024 (base.css rename), move the three Style folders together:
Task: "Move Fluent width overlays to themes/fluent/"
Task: "Create themes/github/ with github.css and its width overlays"
Task: "Move Word layers to themes/word/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md Scenario 1 — nine Light looks, single window
5. Demo the composed Themes menu

### Incremental Delivery

1. Setup + Foundational → layer pipeline ready
2. Add User Story 1 → Style × Page width (MVP)
3. Add User Story 2 → Dark across the whole app
4. Add User Story 3 → persistence and legacy migration; must ship in the same release as US1 so upgrading users keep their theme
5. Add User Story 4 → PDF paper size
6. Historically, steps 2–5 shipped together in `1f452ec`; the multi-window broadcast (T032) followed hours later with `8062af5`, and User Story 5's restructure shipped two days later in `4f48e69`

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (menu + GitHub overlay), then User Story 5
   - Developer B: User Story 2 (appearance + dark palettes)
   - Developer C: User Stories 3 and 4 (settings migration, PDF size)
3. Stories integrate in the shared Themes submenu and src/main.js actions

---

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No test tasks: tests were not requested and Folio has no test runner; checkpoints are validated with quickstart.md
- Commit after each task or logical group (here: `1f452ec`, `8062af5`, `4f48e69`)
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
