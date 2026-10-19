---

description: "Task list for Math Typesetting (TeX)"
---

# Tasks: Math Typesetting (TeX)

**Input**: Design documents from `/specs/009-math-typesetting/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner; validation is manual per `quickstart.md` and the constitution's Verification gates, so each story ends with a "Validate" task instead of test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Retroactive record: every task below was delivered in `68e67be` (2026-07-16) and is marked done.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Desktop app (this repository)**: renderer ES modules and page in `src/renderer/`, bundled by `build.js` at the repository root; dependencies in `package.json`; generated assets in git-ignored folders under `src/renderer/`
- Paths below are relative to the repository root, as listed in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and repository hygiene for the generated math assets

- [X] T001 [P] Add `katex` (^0.16.47) and `@vscode/markdown-it-katex` (^1.1.2) to `dependencies` in package.json and lock them in package-lock.json (katex 0.16.47, @vscode/markdown-it-katex 1.1.2, commander 8.3.0) (68e67be)
- [X] T002 [P] Add `src/renderer/katex/` under "# Build output" in .gitignore, next to the bundle entries, so the generated stylesheet and fonts are never committed (68e67be)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Self-hosted math stylesheet and fonts. Without them typeset markup cannot display correctly, so every user story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement `copyKatexAssets()` in build.js: create `src/renderer/katex/fonts/` with `fs.mkdirSync(…, { recursive: true })` and copy `node_modules/katex/dist/katex.min.css` to `src/renderer/katex/katex.min.css`, with the comment "Vendor KaTeX's stylesheet + web fonts next to the bundle so math renders offline (no CDN, CSP-friendly)" (68e67be)
- [X] T004 Copy only the files ending in `.woff2` from `node_modules/katex/dist/fonts/` to `src/renderer/katex/fonts/` in `copyKatexAssets()` in build.js, and record in the comment why `.woff` and `.ttf` are never fetched (68e67be)
- [X] T005 Call `copyKatexAssets()` as the first statement of `run()` in build.js and log `[folio] KaTeX assets copied.`, so `build:renderer`, `watch:renderer`, `start` and every `dist*` script regenerate the assets (68e67be)
- [X] T006 [P] Link the self-hosted stylesheet with `<link rel="stylesheet" href="katex/katex.min.css" />` in src/renderer/index.html, after `app.css` and before the runtime `<link class="folio-theme">` layers, with a comment that the fonts live in `./katex/fonts` and are copied at build time (68e67be)
- [X] T007 Review the Content-Security-Policy in src/renderer/index.html: confirm that `font-src 'self' file: data:` and `style-src 'self' 'unsafe-inline' file:` already admit the local stylesheet, the fonts and KaTeX's inline `style` attributes, and keep `script-src 'self'` unchanged (no edit needed) (68e67be)

**Checkpoint**: `npm run build:renderer` produces `src/renderer/katex/katex.min.css` and 20 `KaTeX_*.woff2` files, and `git status` ignores them. User story implementation can now begin.

---

## Phase 3: User Story 1 - Read typeset formulas in the preview (Priority: P1) 🎯 MVP

**Goal**: `$…$` and `$$…$$` are typeset in the preview, in every container, following the text colour and zoom.

**Independent Test**: Scenario 1 in specs/009-math-typesetting/quickstart.md: open the test document and confirm inline and display formulas, containers, zoom and the source-mode round trip.

### Implementation for User Story 1

- [X] T008 [US1] Import the plugin with `import katexPlugin from '@vscode/markdown-it-katex';` next to the other markdown-it plugin imports in src/renderer/renderer.js (68e67be)
- [X] T009 [US1] Register `.use(katexPlugin, …)` after `.use(emojiPlugin)` on the shared `md` instance in src/renderer/renderer.js, with the comment "TeX math: `$...$` inline and `$$...$$` display, rendered to HTML+MathML by KaTeX", so formulas are typeset synchronously inside `md.render()` (68e67be)
- [X] T010 [US1] Verify in `renderPreview()` in src/renderer/renderer.js that the typeset HTML passes `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })` with its visible layer intact (spans with `class`/`style`/`aria-hidden`, SVG paths) and needs neither an allowlist change nor a post-sanitization pass (68e67be)
- [X] T011 [P] [US1] Verify that typeset math inherits the theme text colour in Light and Dark through `currentColor` in the generated src/renderer/katex/katex.min.css, so no `.katex` colour rules are needed in src/renderer/app.css or themes/base.css (68e67be)
- [X] T012 [US1] Validate User Story 1 with Scenario 1 in specs/009-math-typesetting/quickstart.md (inline and display forms, heading, list, quote, table and footnote, zoom, source-mode round trip with an unsaved edit) (68e67be)

**Checkpoint**: User Story 1 is fully functional and testable on its own: math typesets offline in the preview (until US2 lands, a TeX error shows the exception text rather than red source).

---

## Phase 4: User Story 2 - Keep a broken formula from spoiling the document (Priority: P2)

**Goal**: TeX errors, unknown commands and untrusted commands are confined to their formula and shown in place.

**Independent Test**: Scenario 2 in specs/009-math-typesetting/quickstart.md: `$\frac{1}{$` between two valid formulas shows red source with a hover message while everything else renders.

### Implementation for User Story 2

- [X] T013 [US2] Pass `{ throwOnError: false }` to the plugin in src/renderer/renderer.js and explain in the comment that the offending source is shown in red (KaTeX's default `errorColor` `#cc0000`, message in the tooltip) instead of aborting the render on a typo (68e67be)
- [X] T014 [US2] Leave KaTeX's `trust` (false) and `maxExpand` (1000) at their defaults in the plugin options in src/renderer/renderer.js, so `\href`, `\url`, `\includegraphics` and `\htmlClass`/`\htmlId`/`\htmlStyle`/`\htmlData` are refused and runaway macros end in an error (68e67be)
- [X] T015 [US2] Validate User Story 2 with Scenario 2 in specs/009-math-typesetting/quickstart.md (parse-error tooltip, unknown and refused commands, runaway macro, broken display equation, `<img onerror>` neutralized) (68e67be)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Export documents with math to PDF (Priority: P2)

**Goal**: PDFs contain the formulas exactly as the preview shows them.

**Independent Test**: Scenario 3 in specs/009-math-typesetting/quickstart.md: export the test document from the preview and from source mode and compare.

### Implementation for User Story 3

- [X] T016 [US3] Confirm that the `prepare-export` request in `handleMainRequest()` in src/renderer/renderer.js (leave source mode, which calls `renderPreview()`) hands `doExportPDF()` in src/main.js a page that already contains typeset math, so `printToPDF` needs no extra wait for formulas (no edit needed) (68e67be)
- [X] T017 [US3] Validate User Story 3 with Scenario 3 in specs/009-math-typesetting/quickstart.md (export from the preview and from source mode, A4 and US Letter page widths, error formulas in the PDF) (68e67be)

**Checkpoint**: Math reaches PDF output unchanged.

---

## Phase 6: User Story 4 - Read math offline (Priority: P3)

**Goal**: Math renders with its own typefaces without any network access, in development runs and in packaged builds on every platform.

**Independent Test**: Scenario 4 in specs/009-math-typesetting/quickstart.md: with the network off, every resource is `file://` and the packaged app renders identically.

### Implementation for User Story 4

- [X] T018 [US4] Confirm that `build.files` (`src/**/*`) in package.json packages the generated src/renderer/katex/ folder and that every `dist*` script in package.json runs `build:renderer` before electron-builder (no edit needed) (68e67be)
- [X] T019 [US4] Validate User Story 4 with Scenario 4 in specs/009-math-typesetting/quickstart.md (network off, `file://`-only resources and loaded KaTeX font faces, `npm run dist` on the host platform, generated assets under 0.5 MB) (68e67be)

**Checkpoint**: Offline and packaged rendering confirmed.

---

## Phase 7: User Story 5 - Write dollar signs and code without accidental math (Priority: P3)

**Goal**: Currency amounts, escaped dollar signs, code and unsupported math forms stay exactly as typed.

**Independent Test**: Scenario 5 in specs/009-math-typesetting/quickstart.md: the literal-dollar paragraph, escapes, code and the `math` fence render verbatim.

### Implementation for User Story 5

- [X] T020 [US5] Keep `enableBareBlocks`, `enableFencedBlocks`, `enableMathBlockInHtml` and `enableMathInlineInHtml` unset in the plugin options in src/renderer/renderer.js, so the default delimiter rules apply: an opener is "not immediately preceded by an ASCII letter, digit, underscore, `$` or `\`" and a closer is "not immediately followed by an ASCII letter, digit, underscore or `$`" (68e67be)
- [X] T021 [US5] Validate User Story 5 with Scenario 5 in specs/009-math-typesetting/quickstart.md (`$5 and $10`, `$20,000 and $30,000`, `US$5`, `\$x\$`, `$x$s`, the `$ 5 and $ 10` pairing caution, code span and fence, `math` fence, bare `\begin`, HTML block) (68e67be)

**Checkpoint**: All user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: User documentation and constitution gates

- [X] T022 Document math in README.md: the Features bullet "Math typesetting with KaTeX: inline `$…$` and display `$$…$$` TeX formulas, rendered in the preview and included in PDF exports", and the Format-section sentence that math is rendered with KaTeX (`$…$` inline, `$$…$$` display) (68e67be)
- [X] T023 Credit KaTeX "via @vscode/markdown-it-katex" in the Acknowledgements of README.md (68e67be)
- [X] T024 Run the constitution gates per specs/009-math-typesetting/quickstart.md: Gate 1 `npm run build:renderer`, Gate 3 Light and Dark in the Fluent, GitHub and Microsoft Word styles (Scenario 6), and the Gate 5 Principle III review of the CSP in src/renderer/index.html and of `renderPreview()` in src/renderer/renderer.js (68e67be)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on T001, because `copyKatexAssets()` reads `node_modules/katex/dist`. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. It registers the plugin that every later story configures or validates.
- **User Stories 2–5 (Phases 4–7)**: Depend on User Story 1 but not on each other.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2); no dependencies on other stories.
- **User Story 2 (P2)**: Needs T009 (the `.use()` call whose options it sets); independent of US3–US5.
- **User Story 3 (P2)**: Needs US1 only; it relies on the existing `prepare-export` path from [001](../001-markdown-viewer-editor/spec.md).
- **User Story 4 (P3)**: Needs Foundational and US1; independent of US2, US3 and US5.
- **User Story 5 (P3)**: Needs T009; independent of US2–US4.

### Within Each User Story

- Code changes before the checks that rely on them; the "Validate" task always comes last.
- T013, T014 and T020 all touch the same options object in src/renderer/renderer.js, so they run one after another even though their stories are independent.
- Each story is complete when its quickstart scenario passes.

### Parallel Opportunities

- T001 (package.json) and T002 (.gitignore).
- T006 (src/renderer/index.html) alongside T003–T005 (build.js).
- T011 (stylesheet and theme check) alongside T010 (sanitizer check).
- Once US1 is done, the read-only validation tasks T015, T017, T019 and T021 can run in parallel.
- T022 and T023 both edit README.md, so they stay sequential.

---

## Parallel Example: User Story 1

```bash
# After T009 registers the plugin, run both checks together:
Task: "Verify sanitization keeps KaTeX's visible layer in renderPreview() in src/renderer/renderer.js"
Task: "Verify currentColor inheritance in src/renderer/katex/katex.min.css (no rules needed in src/renderer/app.css)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T007): assets copied, stylesheet linked, CSP confirmed
3. Complete Phase 3: User Story 1 (T008–T012)
4. **STOP and VALIDATE**: run quickstart.md Scenario 1
5. Math now typesets offline in the preview

### Incremental Delivery

1. Setup + Foundational → offline assets ready
2. Add User Story 1 → typeset preview (MVP)
3. Add User Story 2 → red-source errors, untrusted commands refused
4. Add User Story 3 → PDF export confirmed
5. Add User Story 4 → offline and packaged builds confirmed
6. Add User Story 5 → literal-dollar behavior confirmed
7. Polish → README.md and constitution gates

### Parallel Team Strategy

Folio has a single maintainer, so the stories were done in priority order. Historically all 24 tasks landed in one commit, `68e67be`, alongside the Format menu, line numbers and Copy File Path of [008](../008-source-editing-tools/spec.md). The math portion is about 30 lines of code plus README.md text.

---

## Notes

- Tasks marked [P] touch different files and have no dependencies on unfinished tasks
- The [Story] label maps each task to a user story in spec.md for traceability
- Tests were not requested; "Validate" tasks are manual runs of quickstart.md scenarios
- "No edit needed" tasks record design checks evidenced by code comments ("CSP-friendly") and by files left unchanged; they carry the hash of the commit whose change they validated
- Out of scope here: the Format menu math commands ([008](../008-source-editing-tools/spec.md)), Mermaid diagrams ([010](../010-mermaid-diagrams-code-blocks/spec.md)) and theming ([004](../004-three-axis-theming/spec.md))
- Known limitations found while documenting are recorded in research.md under "Retroactive findings", not as open tasks
