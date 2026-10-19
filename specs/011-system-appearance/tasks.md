---

description: "Task list for Follow the OS Light/Dark Setting (System Appearance)"
---

# Tasks: Follow the OS Light/Dark Setting (System Appearance)

**Input**: Design documents from `/specs/011-system-appearance/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested. Folio has no automated test runner, so validation is manual, following [quickstart.md](./quickstart.md) and the constitution's quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single desktop project**: Electron main-process modules in `src/`, renderer in `src/renderer/`, theme layers in `themes/`, README.md at the repository root
- There is no `tests/` directory; every task ends with the commit that delivered it

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm that the existing Appearance plumbing can carry a third value

- [X] T001 Trace the Appearance path built by 004 and 010 (`APPEARANCES`, `applyAppearance()`, `actions.setAppearance` and the `nativeTheme.on('updated')` → `appearance-changed` broadcast in src/main.js; `onAppearanceChanged` in src/preload.js; `refreshMermaid()` in src/renderer/renderer.js) and confirm that System needs no new IPC channel, listener or dependency (0bbcf84)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Let a stored `'system'` value reach the native theme source safely

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extend the allow-list to `const APPEARANCES = ['light', 'dark', 'system'];` in src/main.js (0bbcf84)
- [X] T003 Rewrite `applyAppearance()` in src/main.js to set `nativeTheme.themeSource` to the stored value when `APPEARANCES.includes(appearance)` and to `'light'` otherwise, replacing the `=== 'dark' ? 'dark' : 'light'` mapping (0bbcf84)
- [X] T004 [P] Document the third value on the `appearance` default in src/store.js, keeping the default `'light'` and using the comment `'light' | 'dark' | 'system' (follow the OS)` (0bbcf84)

**Checkpoint**: Foundation ready. A settings file containing `"appearance": "system"` already makes Folio follow the OS from launch.

---

## Phase 3: User Story 1 - Let the operating system decide Light or Dark (Priority: P1) 🎯 MVP

**Goal**: One choice, Themes ▸ System, hands the light/dark decision to the OS in every window and is remembered across launches.

**Independent Test**: With the OS in Dark and Folio on Light, choose Themes ▸ System. Folio turns dark at once with System as the only checked item; after a relaunch System is still checked and Folio is dark (quickstart scenarios 1–2).

### Implementation for User Story 1

- [X] T005 [US1] Add a `System` radio item after `Dark` in the Appearance block of `themeSubmenu` in src/menu.js, with `checked: appearance === 'system'`, `click: () => actions.setAppearance('system')`, no accelerator and no platform condition (0bbcf84)
- [X] T006 [US1] Narrow the `Light` radio item's rule in src/menu.js to `checked: appearance !== 'dark' && appearance !== 'system'`, so exactly one Appearance item is checked and a missing or unknown value shows Light (0bbcf84)
- [X] T007 [US1] Confirm that `actions.setAppearance` in src/main.js (`store.set('appearance', …)` → `applyAppearance()` → `rebuildMenu()`) persists and applies `'system'` unmodified, and that `createWindow()` re-applies the saved value at launch and for every new window (0bbcf84)

**Checkpoint**: User Story 1 is fully functional. System can be chosen, is persisted, falls back safely and works on macOS, Windows and Linux.

---

## Phase 4: User Story 2 - Follow the operating system's changes live (Priority: P2)

**Goal**: While System is selected, every change of the OS setting (manual, macOS Auto or scheduled) restyles all windows within 2 seconds; an explicit Light or Dark choice ignores the OS.

**Independent Test**: With System selected and two windows in the background, flip the OS. Both windows switch within 2 seconds without any interaction. With Dark selected, OS flips change nothing (quickstart scenario 3).

### Implementation for User Story 2

- [X] T008 [US2] Update the theming comment above `STYLE_FAMILIES` in src/main.js to say "Appearance (light/dark/system)", noting that `'system'` hands the choice to the OS and follows it live (macOS Auto appearance, scheduled Windows light/dark switch) (0bbcf84)
- [X] T009 [US2] Verify that under `themeSource = 'system'` an OS light/dark change restyles the page, source editor and chrome through the `@media (prefers-color-scheme: dark)` blocks in themes/base.css and src/renderer/app.css, and emits `nativeTheme` `'updated'`, so the existing listener in src/main.js sends `appearance-changed` to every live Session (0bbcf84)
- [X] T010 [US2] Verify in src/main.js that explicit `'light'` and `'dark'` keep overriding the OS, so OS flips change nothing, and that switching System → Dark → System takes effect immediately in every window (0bbcf84)

**Checkpoint**: User Stories 1 and 2 both work. Folio follows OS changes live in all windows, including background and minimized ones.

---

## Phase 5: User Story 3 - Diagrams follow the flip (Priority: P3)

**Goal**: Diagrams in every open preview are redrawn in the palette that matches an OS-driven flip, without a reload and without losing unsaved edits; PDF export keeps the appearance in effect.

**Independent Test**: With System selected, open Help ▸ Markdown Formatting Tour and flip the OS. Both diagrams redraw in the matching palette within 2 seconds; in source mode they match on return to the preview (quickstart scenarios 4–5).

### Implementation for User Story 3

- [X] T011 [US3] Verify the redraw path in src/renderer/renderer.js for OS-driven flips: `window.folioAPI.onAppearanceChanged(() => setTimeout(refreshMermaid, 0))` → `renderPreview()` from the in-memory `currentText()` → `initMermaid()` reading `prefersDark.matches`. Because it uses a timer rather than `requestAnimationFrame`, it also runs in background windows (0bbcf84)
- [X] T012 [US3] Verify the source-mode path in src/renderer/renderer.js: `refreshMermaid()` returns early while `state.sourceMode` is set, and `setSourceMode(false)` → `renderPreview()` draws the diagrams in the current palette when the preview returns (0bbcf84)
- [X] T013 [US3] Verify that `doExportPDF()` in src/main.js leaves `nativeTheme.themeSource` untouched under System (no forced Light), and that its `prepare-export` request waits on `whenMermaidSettled()` in src/renderer/renderer.js before the page is captured (0bbcf84)

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: User documentation and constitution gate validation

- [X] T014 [P] Add System to the Appearance list in the Features bullet and in the How-to-use "Switch themes" bullet of README.md, so both read **Appearance** (Light, Dark, System) (0bbcf84)
- [X] T015 Update the Themes section of README.md: change the table row to `Light · Dark · System` with "System follows the OS", and extend the Appearance paragraph to say that System sets `nativeTheme.themeSource` to `'system'`, tracks the OS live (macOS *Auto*, a scheduled Windows switch, e.g. via PowerToys) and re-renders Mermaid diagrams when it flips (0bbcf84)
- [X] T016 Run every scenario in specs/011-system-appearance/quickstart.md, including the constitution gates: `npm run build:renderer`, System flips under Fluent, GitHub and Microsoft Word, and the Principle III review of the reused `appearance-changed` channel (0bbcf84)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1, then US2 and US3, in priority order (P1 → P2 → P3)
  - US2 and US3 can proceed in parallel once US1's menu item exists. They can also be exercised before it by setting `"appearance": "system"` in `folio-settings.json` (quickstart scenario 2)
- **Polish (Final Phase)**: Depends on all user stories being complete; T014 may be drafted earlier (see below)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2); no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2); the runtime's `'system'` theme source does the tracking, so US2 only verifies and documents it
- **User Story 3 (P3)**: Can start after Foundational (Phase 2); relies on the diagram redraw path delivered by 010 (`1ce68e0`), not on US1 or US2 code

### Within Each User Story

- Code changes before the verification tasks that confirm them (T005–T006 before T007, T008 before T009–T010)
- Within the same file, tasks run sequentially (T005 → T006 in src/menu.js, T002 → T003 in src/main.js)
- Each story is complete before moving to the next priority

### Parallel Opportunities

- T004 (src/store.js) can run in parallel with T002–T003 (src/main.js)
- T014 (README.md) can be drafted while the story phases are verified; T015 edits the same file, so it follows T014
- The verification tasks of US2 (src/main.js) and US3 (src/renderer/renderer.js) can be split between two people once Phase 3 is done

---

## Parallel Example: Foundational phase and documentation

```bash
# Foundational edits touch different files:
Task: "Extend APPEARANCES and rewrite applyAppearance() in src/main.js"    # T002 → T003 (same file, sequential)
Task: "Document 'system' on the appearance default in src/store.js"        # T004 [P]

# README work alongside story verification:
Task: "Add System to the Features and How-to-use bullets in README.md"     # T014 [P]
Task: "Verify the renderer redraw path in src/renderer/renderer.js"        # T011 [US3]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: User Story 1 (T005–T007)
4. **STOP and VALIDATE**: run quickstart scenarios 1–2
5. Because `themeSource = 'system'` delegates tracking to the runtime, this MVP already follows OS changes. The remaining phases verify and document that behavior.

### Incremental Delivery

1. Setup + Foundational → a stored `'system'` value is honored
2. Add User Story 1 → System is selectable and persisted (MVP)
3. Add User Story 2 → live OS tracking confirmed in all windows
4. Add User Story 3 → diagram redraw and PDF behavior confirmed
5. Polish → README updated, gates run. Everything shipped together in `0bbcf84` (2026-09-30)

### Parallel Team Strategy

With multiple developers:

1. One developer completes Setup + Foundational (a few lines in src/main.js and src/store.js)
2. Then:
   - Developer A: User Story 1 (src/menu.js)
   - Developer B: User Stories 2 and 3 verification (src/main.js, src/renderer/renderer.js), using a hand-edited settings file
   - Developer C: README.md (T014–T015)

---

## Notes

- All 16 tasks shipped in the single commit `0bbcf84` (+19/−12 lines in README.md, src/main.js, src/menu.js and src/store.js). The verification tasks (T001, T007, T009–T013) changed no code: they confirm that existing code from `1f452ec` (Appearance axis) and `1ce68e0` (diagram redraw) already carries System
- T015 left the sentence "That's 3 × 2 × 3 = 18 combinations" under the Themes table unchanged, and it has been stale since this feature (see [research.md](./research.md#retroactive-findings), finding 1). Under the flow-forward rule it is to be fixed by a later change, not by rewriting this record
- Tasks marked [P] touch different files and have no dependencies on unfinished tasks
- The [USn] story label maps a task to its user story for traceability
- Each user story should be independently completable and testable
- No tests were requested; validate with quickstart.md
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
