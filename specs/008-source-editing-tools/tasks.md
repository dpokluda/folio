---

description: "Task list for Source Formatting Commands, Line Numbers & Copy File Path"
---

# Tasks: Source Formatting Commands, Line Numbers & Copy File Path

**Input**: Design documents from `/specs/008-source-editing-tools/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner, so validation is manual, following `quickstart.md` and the constitution's verification gates. No test tasks are generated.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested on its own.

**Retroactive Record**: All tasks were delivered in commit `68e67be` (2026-07-16) and are marked done. Each task's description names the exact code that shipped.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single Electron app**: main-process modules live in `src/` and the bundled renderer in `src/renderer/` at the repository root. There is no `tests/` directory.
- The generated bundle `src/renderer/bundle.js` is never edited by hand.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the CodeMirror building blocks available to the renderer. No new npm dependency is needed.

- [X] T001 Import `EditorSelection` and `Prec` from `@codemirror/state`, and `lineNumbers` from `@codemirror/view`, in src/renderer/renderer.js. These packages are already in package.json, so no install is needed (68e67be)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the command payload plumbing and the reusable toast. User Story 1 (the formatting hint) and User Story 5 (the copy confirmation) depend on both.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Change `handleCommand(name)` to `handleCommand(payload)`, reading `payload.name`. Wire `window.folioAPI.onCommand((payload) => handleCommand(payload))` so commands can carry data (`format`, `text`), in src/renderer/renderer.js (68e67be)
- [X] T003 [P] Add the transient notice element `<div id="folio-toast" hidden role="status" aria-live="polite"></div>` inside `#folio-content`, after `#folio-link-hint`, in src/renderer/index.html (68e67be)
- [X] T004 [P] Style `#folio-toast` in src/renderer/app.css as a non-interactive bottom-center pill: `position: absolute`, `bottom: 24px`, `max-width: min(80%, 520px)`, nowrap with ellipsis, `pointer-events: none`, `user-select: none`, 0.18 s opacity/transform transition, `.folio-toast-show` visible state and `[hidden] { display: none }`. Add the dark palette (`#303338`) in the `@media (prefers-color-scheme: dark)` block (68e67be)
- [X] T005 Cache `$toast` and implement `showToast(text)` in src/renderer/renderer.js: ignore empty text, clear both pending timers, set `textContent`, restart the transition with a forced reflow, remove `.folio-toast-show` after 1600 ms and set `hidden` 220 ms later; route the `toast` command (`payload.text`) in `handleCommand` (68e67be)

**Checkpoint**: Foundation ready. Commands can carry payloads and any code path can show a toast.

---

## Phase 3: User Story 1 - Apply inline formatting from the keyboard or the Format menu (Priority: P1) 🎯 MVP

**Goal**: Bold, Italic, Underline, Strikethrough, Inline Code and Inline Math wrap, insert or unwrap Markdown marks in source mode, from shortcuts and from a new Format menu. In the rendered view, Format menu commands make no edit and show a hint.

**Independent Test**: In source mode, select a word and press each of the six inline shortcuts twice; the marks appear, then disappear. With an empty selection the caret lands between the inserted marks. In the rendered view, Format > Bold shows "Switch to Source mode (Ctrl/Cmd+/) to format text" and leaves the document unchanged (quickstart.md §1–2).

### Implementation for User Story 1

- [X] T006 [US1] Add the `INLINE_FORMATS` table (bold `**`, italic `*`, underline `<u>`/`</u>`, strikethrough `~~`, code `` ` ``, math `$`) and implement `toggleWrap(view, before, after)` with `state.changeByRange` in src/renderer/renderer.js, checking in order: unwrap when the marks sit just outside a non-empty selection; unwrap when the selection starts and ends with the marks; otherwise wrap, with the caret between the marks for an empty selection and the original text still selected otherwise (68e67be)
- [X] T007 [US1] Implement `applyFormat(kind)` in src/renderer/renderer.js. Outside source mode, or before the editor exists, call `showToast('Switch to Source mode (Ctrl/Cmd+/) to format text')` and return. Otherwise run the inline command for `INLINE_FORMATS[kind]` and call `editor.focus()`. Route the `format` command (`payload.format`) in `handleCommand` (68e67be)
- [X] T008 [US1] Add `formattingKeymap` entries `Mod-b`, `Mod-i`, `Mod-u`, `Mod-Shift-x`, `Mod-e` and `Mod-m`, each calling `toggleWrap` and returning `true`. Install `Prec.highest(keymap.of(formattingKeymap))` ahead of the default, history and search keymaps in `createEditor()` in src/renderer/renderer.js (68e67be)
- [X] T009 [P] [US1] Add the Format menu to src/menu.js, built with a `fmt(label, accel, kind)` helper (`registerAccelerator: false`, `click: () => actions.format(kind)`). Items: Bold `CmdOrCtrl+B`, Italic `CmdOrCtrl+I`, Underline `CmdOrCtrl+U`, Strikethrough `CmdOrCtrl+Shift+X`, Inline Code `CmdOrCtrl+E`, then a separator and Inline Math `CmdOrCtrl+M`. Place the menu between Edit and View (68e67be)
- [X] T010 [P] [US1] Add `format: (kind) => sendFocused('command', { name: 'format', format: kind })` to the menu `actions` in src/main.js (68e67be)

**Checkpoint**: User Story 1 is fully functional and testable on its own. This is the MVP: quicker inline formatting in source mode.

---

## Phase 4: User Story 2 - Turn lines into headings and back (Priority: P2)

**Goal**: Ctrl/Cmd+1…6 and Format > Heading 1…6 set every touched line to that heading level, replacing an existing level and toggling off when the level is already set.

**Independent Test**: On a plain line, press `Ctrl/Cmd+2`, then `Ctrl/Cmd+3`, then `Ctrl/Cmd+3`. The line reads `## …`, then `### …`, then plain text again. A multi-line selection converts every line (quickstart.md §3).

### Implementation for User Story 2

- [X] T011 [US2] Implement `setHeading(view, level)` in src/renderer/renderer.js: collect every line from `doc.lineAt(range.from)` to `doc.lineAt(range.to)` for each range (duplicates removed), match each against `^(#{1,6})[ \t]+`, strip the prefix when its level equals `level`, otherwise replace or prepend `'#'.repeat(level) + ' '`, and dispatch once with `scrollIntoView: true` (68e67be)
- [X] T012 [US2] Route `h1`…`h6` (`/^h[1-6]$/`, level `Number(kind.slice(1))`) in `applyFormat`, and add `Mod-1`…`Mod-6` to `formattingKeymap`, in src/renderer/renderer.js (68e67be)
- [X] T013 [P] [US2] Append a separator and Heading 1…Heading 6 (`CmdOrCtrl+1`…`CmdOrCtrl+6`, kinds `h1`…`h6`) to the Format menu in src/menu.js (68e67be)

**Checkpoint**: User Stories 1 and 2 both work on their own.

---

## Phase 5: User Story 3 - Insert links, code blocks and math blocks (Priority: P3)

**Goal**: Link, Code Block and Math Block insert their templates with the caret at the next place to type. Ctrl/Cmd+Shift+E is freed for Code Block by moving the pane toggles to Ctrl/Cmd+Alt+E and Ctrl/Cmd+Alt+O.

**Independent Test**:
- `Ctrl/Cmd+K` on a selection gives `[sel](|)`, and with no selection gives `[|]()`.
- `Ctrl/Cmd+Shift+E` at the end of a line opens an empty fenced block with the caret inside.
- `Ctrl/Cmd+Shift+M` encloses a selected line in `$$` lines.
- `Ctrl/Cmd+Alt+E` and `Ctrl/Cmd+Alt+O` toggle the explorer and outline, and `Ctrl/Cmd+Shift+E` no longer does (quickstart.md §4–5).

### Implementation for User Story 3

- [X] T014 [US3] Implement `insertLink(view)` in src/renderer/renderer.js. An empty selection gets `[]()` with the caret at `from + 1`; a selection `S` becomes `[S]()` with the caret at `from + S.length + 3`, between the parentheses (68e67be)
- [X] T015 [US3] Implement `insertFencedBlock(view, open, close)` in src/renderer/renderer.js: prefix `\n` when `from` is not at a line start, replace the selection with `open⏎body⏎close`, and select the body or leave the caret on the empty body line (68e67be)
- [X] T016 [US3] Route `link`, `codeblock` (```` ``` ````) and `mathblock` (`$$`) in `applyFormat`, and add `Mod-k`, `Mod-Shift-e` and `Mod-Shift-m` to `formattingKeymap`, in src/renderer/renderer.js (68e67be)
- [X] T017 [US3] Add Code Block `CmdOrCtrl+Shift+E` and Link `CmdOrCtrl+K` after Inline Code, and Math Block `CmdOrCtrl+Shift+M` after Inline Math, in the Format menu in src/menu.js (68e67be)
- [X] T018 [US3] Free `CmdOrCtrl+Shift+E` in src/menu.js: add a `ctrlAltItem(label, letter, onClick)` helper (macOS: native accelerator `Cmd+Alt+<letter>`; Windows/Linux: label `<label>\tCtrl+Alt+<letter>` with no accelerator, because Chromium's Windows menu would print "Alt+Ctrl+…") and use it for View > Toggle File Explorer (`E`, was `CmdOrCtrl+Shift+E`) and View > Toggle Outline (`O`, was `CmdOrCtrl+Shift+K`) (68e67be)
- [X] T019 [US3] In `boot()` in src/renderer/renderer.js, add a `window` keydown listener on non-macOS platforms only. When Ctrl+Alt is held without Shift or Meta, it toggles the file explorer on `e.code === 'KeyE'` and the outline on `KeyO`, calling `preventDefault()` (68e67be)
- [X] T020 [P] [US3] Update the status-bar tooltips to "Toggle File Explorer (Ctrl/Cmd+Alt+E)" on `#btn-files` and "Toggle Outline (Ctrl/Cmd+Alt+O)" on `#btn-outline`, in src/renderer/index.html (68e67be)

**Checkpoint**: All 15 Format commands work, and no Format shortcut collides with another Folio command.

---

## Phase 6: User Story 4 - Show line numbers in the source editor (Priority: P4)

**Goal**: View > Show Line Numbers toggles a muted gutter in the source editor. It applies live, is off by default, is remembered across launches and is mirrored by the menu check mark.

**Independent Test**: With fresh settings there is no gutter. Toggling the item on shows numbers immediately, with the caret and undo history intact. After a relaunch the gutter is still shown. Toggling it off hides the gutter (quickstart.md §6).

### Implementation for User Story 4

- [X] T021 [P] [US4] Add `lineNumbers: false, // optional source-editor gutter line numbers` to `DEFAULTS` in src/store.js. A missing key resolves to `false` through `{ ...DEFAULTS, ...parsed }`, so no migration is needed (68e67be)
- [X] T022 [US4] In src/renderer/renderer.js, add `state.lineNumbers` (default `false`) and `const lineNumbersCompartment = new Compartment()`. Mount `lineNumbersCompartment.of(state.lineNumbers ? lineNumbers() : [])` in `createEditor()` (68e67be)
- [X] T023 [US4] In src/renderer/renderer.js, implement `setLineNumbers(on)` (dispatch `lineNumbersCompartment.reconfigure(on ? lineNumbers() : [])` when the editor exists, then `persistState()`), handle the `toggle-line-numbers` command, add `lineNumbers` to the `persistState()` payload, and restore `state.lineNumbers = !!s.lineNumbers` in `boot()` before the editor is lazily created (68e67be)
- [X] T024 [US4] In src/main.js, return `settings.lineNumbers` from `get-init`; in `state-changed`, store `lineNumbers` only when `typeof state.lineNumbers === 'boolean'` and then call `rebuildMenu()`; pass `lineNumbers: !!store.get('lineNumbers')` to `buildMenu`; and add `toggleLineNumbers: () => sendFocused('command', { name: 'toggle-line-numbers' })` (68e67be)
- [X] T025 [US4] In src/menu.js, accept `lineNumbers` in the `buildMenu({ … })` parameters and add the View > Show Line Numbers checkbox after Toggle Outline: `type: 'checkbox'`, `checked: !!lineNumbers`, no accelerator, `click: () => actions.toggleLineNumbers()` (68e67be)
- [X] T026 [P] [US4] Style the gutter under `#typora-source` in src/renderer/app.css: `.cm-lineNumbers .cm-gutterElement` gets `color: currentColor; opacity: 0.38; padding: 0 8px 0 12px`, `.cm-activeLineGutter` gets `background: transparent; opacity: 0.7`, and the earlier transparent, borderless `.cm-gutters` rule stays in place (68e67be)

**Checkpoint**: Line numbers work in source mode, persist, and are independent of the formatting stories.

---

## Phase 7: User Story 5 - Copy the open document's path (Priority: P5)

**Goal**: File > Copy File Path (Ctrl/Cmd+Shift+C) copies the focused window's document path to the clipboard and confirms with a toast. The command is disabled for untitled documents.

**Independent Test**:
- With a saved file, `Ctrl/Cmd+Shift+C` puts the absolute path on the clipboard, and "Path copied to clipboard" appears and is gone within 2 s.
- After File > New the item is disabled.
- After Save As it is enabled again (quickstart.md §7).

### Implementation for User Story 5

- [X] T027 [US5] Implement `copyDocumentPath()` in src/main.js: resolve the window with `focusedSession()` (return when there is none); if `session.currentPath` is null, send `{ name: 'toast', text: 'Save the document first to copy its path' }`; otherwise call `clipboard.writeText(session.currentPath)` (already imported) and send `{ name: 'toast', text: 'Path copied to clipboard' }`; add `copyPath: () => copyDocumentPath()` to `actions` (68e67be)
- [X] T028 [P] [US5] Add File > Copy File Path (`CmdOrCtrl+Shift+C`, `enabled: !!hasFile`, `click: () => actions.copyPath()`) to src/menu.js, between separators after Save As… and before Export to PDF… (68e67be)

**Checkpoint**: All five user stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: User documentation and the constitution's verification gates.

- [X] T029 [P] Document in README.md under "How to use": the **Format** menu (wrap, insert-with-caret and toggle behavior; Bold, Italic, Underline `<u>…</u>`, Strikethrough, Inline Code, Code Block and Link shortcuts; Inline Math and Math Block; Headings `Ctrl/Cmd+1`…`6`), **Line numbers** (View > Show Line Numbers, remembered, off by default), **Copy file path** (`Ctrl/Cmd+Shift+C` with its toast), and the moved Toggle File Explorer `Ctrl/Cmd+Alt+E` and Toggle Outline `Ctrl/Cmd+Alt+O` shortcuts (68e67be)
- [X] T030 Run the specs/008-source-editing-tools/quickstart.md validation: `npm run build:renderer`, a smoke test of every Format command in source mode and the rendered view plus line numbers and Copy File Path, the Light/Dark × Fluent/GitHub/Microsoft Word check of the gutter and toast, and a Principle III review of the new `command` payloads and `state-changed` field (68e67be)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; start immediately.
- **Foundational (Phase 2)**: depends on Setup. It blocks User Story 1, which shows the hint toast through `applyFormat`, and User Story 5, which receives the toast through the `toast` payload. Both need payload-aware `handleCommand` and `showToast`.
- **User Stories (Phases 3–7)**: all depend on Foundational.
  - User Story 1 creates the Format menu, `applyFormat` and `formattingKeymap`, which User Stories 2 and 3 extend.
  - User Stories 4 and 5 are independent of the formatting stories.
- **Polish (Phase 8)**: depends on all user stories.

### User Story Dependencies

- **User Story 1 (P1)**: can start after Foundational. Depends on no other story.
- **User Story 2 (P2)**: extends `applyFormat`, `formattingKeymap` and the Format menu from User Story 1, and is testable on its own.
- **User Story 3 (P3)**: extends the same three pieces from User Story 1. T018 and T019 (the pane-toggle move) must land together with T016 and T017, so that `Ctrl/Cmd+Shift+E` is never bound twice.
- **User Story 4 (P4)**: can start after Foundational and needs only T001's `lineNumbers` import. It is independent of User Stories 1–3.
- **User Story 5 (P5)**: can start after Foundational, using the `toast` command and `showToast`. It is independent of User Stories 1–4.

### Within Each User Story

- Renderer transforms come before routing them in `applyFormat` and `formattingKeymap`.
- The menu items (src/menu.js) and the main-process `actions` (src/main.js) can be written in parallel with the renderer work. They meet at the `command` payload contract.
- Each story is complete before moving on to the next priority.

### Parallel Opportunities

- T003 and T004 run in parallel: they touch `index.html` and `app.css`.
- In User Story 1, T009 (`menu.js`) and T010 (`main.js`) run in parallel with T006–T008 (`renderer.js`).
- In User Story 4, T021 (`store.js`) and T026 (`app.css`) run in parallel with the renderer and main-process tasks.
- User Stories 4 and 5 can be built in parallel with User Stories 1–3 once Foundational is done.

---

## Parallel Example: User Story 4

```bash
# Different files, no unfinished dependencies — launch together:
Task: "Add lineNumbers: false to DEFAULTS in src/store.js"
Task: "Style .cm-lineNumbers .cm-gutterElement (currentColor, opacity 0.38) under #typora-source in src/renderer/app.css"

# Then, sequentially within the renderer and main process:
Task: "Add state.lineNumbers + lineNumbersCompartment and mount it in createEditor() in src/renderer/renderer.js"
Task: "Implement setLineNumbers(), toggle-line-numbers routing, persistState field and boot restore in src/renderer/renderer.js"
Task: "Wire get-init / state-changed / buildMenu / toggleLineNumbers in src/main.js"
Task: "Add View > Show Line Numbers checkbox in src/menu.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T005).
3. Complete Phase 3: User Story 1 (T006–T010).
4. **STOP and VALIDATE**: run quickstart.md §1–2. The inline shortcuts and Format menu work in source mode, and the hint appears in the rendered view.
5. Deploy or demo if ready.

### Incremental Delivery

1. Setup + Foundational: payload plumbing and toast ready.
2. Add User Story 1: inline formatting (MVP).
3. Add User Story 2: headings.
4. Add User Story 3: links and blocks, plus the pane-shortcut move.
5. Add User Story 4: the line-number gutter.
6. Add User Story 5: Copy File Path.
7. Polish: README and the constitution gates.

Each story adds value without breaking the earlier ones. Historically, all of it shipped in the single commit `68e67be`.

### Parallel Team Strategy

With multiple developers:

1. The team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Stories 1 → 2 → 3, which share `applyFormat`, `formattingKeymap` and the Format menu.
   - Developer B: User Story 4 (line numbers).
   - Developer C: User Story 5 (Copy File Path).
3. The stories integrate through the `command` channel payloads in [contracts/ipc-channels.md](./contracts/ipc-channels.md).

---

## Notes

- Tasks marked [P] touch different files and have no unfinished dependencies.
- The [Story] label maps each task to its user story for traceability.
- Every task ends with the commit that delivered it. All tasks come from `68e67be`. The same commit's KaTeX rendering (009) and icon artwork (002) are excluded.
- Constraints carried verbatim from data-model.md: `lineNumbers` is a "boolean", "default `false`", "stored only if `typeof === 'boolean'`"; toast text is "assigned with `textContent`, never parsed as HTML".
- Known limitations and README drift found after delivery are in research.md, "Retroactive findings". Per the constitution's flow-forward rule, fixes belong in a new feature directory.
- Avoid: vague tasks, same-file conflicts, and cross-story dependencies that break independence.
