---

description: "Task list for Mermaid Diagrams & Code Block Enhancements"
---

# Tasks: Mermaid Diagrams & Code Block Enhancements

**Input**: Design documents from `/specs/010-mermaid-diagrams-code-blocks/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested. Folio has no automated test runner. Validation is manual, per [quickstart.md](./quickstart.md) and the constitution's quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Retroactive Record**: Reconstructed 2026-10-18 from `1ce68e0` (2026-08-12) and the code-fence highlighting part of `5c3ee89` (2026-08-20). Every task is complete (`[X]`) and ends with the commit that delivered it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single Electron project** ([plan.md](./plan.md)): main process and preload in `src/`, the esbuild-bundled renderer in `src/renderer/`, themes in `themes/`, bundled documents in `samples/`, and the bundler in `build.js` at the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the diagram engine and keep the larger bundle fast to load

- [X] T001 Add the `mermaid` `^11.16.1` runtime dependency to package.json and lock it in package-lock.json (11.16.1, 107 new package entries) (1ce68e0)
- [X] T002 [P] Minify one-shot renderer builds with `minify: !watch` in build.js. `--watch` builds stay readable and source maps are still emitted; the comment explains that Mermaid dominates bundle parse time (1ce68e0)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The per-render plumbing and pass state that the diagram stories (US1–US3) share

**⚠️ CRITICAL**: No diagram story work can begin until this phase is complete

- [X] T003 Import `mermaid` into the renderer and thread a per-render collector through Markdown rendering (`const env = { mermaid: [] }; md.render(body, env)`) in `renderPreview()` in src/renderer/renderer.js (1ce68e0)
- [X] T004 Declare the module-level drawing-pass state in src/renderer/renderer.js: `mermaidGeneration` (integer, starts at 0), `mermaidPending` (`Promise.resolve()`), and `prefersDark` (a `matchMedia('(prefers-color-scheme: dark)')` list, or `null` when `matchMedia` is unavailable) (1ce68e0)

**Checkpoint**: Foundation ready. Diagram sources reach the render pass and pass state exists.

---

## Phase 3: User Story 1 - See Mermaid diagrams drawn in the preview (Priority: P1) 🎯 MVP

**Goal**: ```` ```mermaid ```` fences are drawn as diagrams in the preview, follow Light/Dark and the Style's font, and redraw on appearance or theme changes.

**Independent Test**: Open `Help > Markdown Formatting Tour` → **Diagrams**: a flowchart and a sequence diagram are drawn. Switching **Themes → Dark/Light** or the Style redraws them (quickstart V1–V3).

### Implementation for User Story 1

- [X] T005 [US1] Override markdown-it's `fence` rule in src/renderer/renderer.js. When the lower-cased first word of `md.utils.unescapeAll(token.info).trim()` is `mermaid` and `env.mermaid` exists, push `token.content` and emit `<div class="folio-mermaid" data-folio-mermaid="<index>"></div>`; otherwise delegate to the default fence renderer (1ce68e0)
- [X] T006 [US1] Implement `initMermaid()` in src/renderer/renderer.js. It calls `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme, fontFamily })`, where `theme` is `'dark'` when `prefersDark.matches` and `'default'` otherwise, and `fontFamily` comes from `getComputedStyle($write)` (omitted when empty) (1ce68e0)
- [X] T007 [US1] Implement `renderMermaidBlocks(sources)` in src/renderer/renderer.js: bump `mermaidGeneration` and resolve at once when there are no placeholders; otherwise draw the placeholders one at a time with `mermaid.render('folio-mermaid-<gen>-<n>', code)`, insert the SVG and call `bindFunctions(el)`, abandon the pass when the generation changes or the element is detached, remove the `d<id>` scratch element in `finally`, and log pass-level errors instead of rejecting `mermaidPending` (1ce68e0)
- [X] T008 [US1] Call `renderMermaidBlocks(env.mermaid)` right after `$write.innerHTML = DOMPurify.sanitize(…)` in `renderPreview()` in src/renderer/renderer.js, so diagram output never passes through the sanitizer (1ce68e0)
- [X] T009 [P] [US1] Add diagram layout rules in src/renderer/app.css: `#write .folio-mermaid` (`margin: 0 0 1.4em`, `text-align: center`, `overflow-x: auto`) and `#write .folio-mermaid > svg` (`max-width: 100%`, `height: auto`) (1ce68e0)
- [X] T010 [P] [US1] Send `appearance-changed` to every session from `nativeTheme.on('updated')` in src/main.js. The comment notes that Chromium updates `prefers-color-scheme` without firing a `change` event (1ce68e0)
- [X] T011 [P] [US1] Expose `onAppearanceChanged: (cb) => listen('appearance-changed', cb)` on `window.folioAPI` in src/preload.js (1ce68e0)
- [X] T012 [US1] Implement `refreshMermaid()` in src/renderer/renderer.js and subscribe it in `boot()` with `window.folioAPI.onAppearanceChanged(() => setTimeout(refreshMermaid, 0))`. `refreshMermaid()` does nothing in source mode or when `#write` has no `[data-folio-mermaid]`; otherwise it calls `renderPreview()`. A timer is used rather than `requestAnimationFrame`, which background windows suspend (1ce68e0)
- [X] T013 [US1] Make `applyTheme()` in src/renderer/renderer.js collect a `load`/`error` promise for each new `link.folio-theme` and call `refreshMermaid()` once all have settled, so diagrams are re-measured against the new Style's font (1ce68e0)
- [X] T014 [P] [US1] Add a **Diagrams** section with a `graph LR` flowchart and a `sequenceDiagram` to samples/formatting-tour.md (1ce68e0)

**Checkpoint**: User Story 1 is fully functional. Diagrams draw, follow Light/Dark and Style, and redraw in every window.

---

## Phase 4: User Story 2 - Export documents with diagrams to PDF (Priority: P2)

**Goal**: Export to PDF captures fully drawn diagrams without ever hanging.

**Independent Test**: Enter source mode in the formatting tour and immediately choose `File > Export to PDF…`. The PDF contains both drawn diagrams (quickstart V4).

### Implementation for User Story 2

- [X] T015 [US2] Add `whenMermaidSettled()`, which returns `mermaidPending.catch(() => {})`, in src/renderer/renderer.js (1ce68e0)
- [X] T016 [US2] Make `handleMainRequest('prepare-export')` in src/renderer/renderer.js leave source mode, which re-renders the preview, and resolve `true` only after `whenMermaidSettled()` (1ce68e0)
- [X] T017 [P] [US2] Raise the export-preparation wait in `doExportPDF()` in src/main.js to `ask(session, 'prepare-export', { fallback: true, timeoutMs: 20000 })` (the default is 4000 ms) and explain why in a comment: diagrams draw asynchronously (1ce68e0)

**Checkpoint**: User Stories 1 and 2 both work independently. Exports include diagrams, and the wait is capped at 20 s.

---

## Phase 5: User Story 3 - Recover gracefully from a broken diagram (Priority: P3)

**Goal**: A diagram that cannot be drawn shows its source and the parser's message, and the other diagrams are unaffected.

**Independent Test**: Preview a document with one malformed and one valid diagram. The valid one is drawn, and the malformed one shows its source plus the message (quickstart V5).

### Implementation for User Story 3

- [X] T018 [US3] Implement `renderMermaidError(el, code, err)` in src/renderer/renderer.js. It adds `folio-mermaid-error` and replaces the placeholder with the HTML-escaped source in `<pre class="md-fences"><code>`, followed by `<p class="folio-mermaid-message">` holding the escaped `err.message || err.str || 'Invalid diagram'` (1ce68e0)
- [X] T019 [US3] Route each diagram's `catch` in `renderMermaidBlocks()` in src/renderer/renderer.js to `renderMermaidError()`, only while the pass is current and the element is connected, so one failure never stops the remaining diagrams (1ce68e0)
- [X] T020 [P] [US3] Style the fallback in src/renderer/app.css: left-align `#write .folio-mermaid.folio-mermaid-error`; render `.folio-mermaid-message` in monospace (`var(--mono-font, …)`) at `0.8em`, `line-height: 1.5`, `white-space: pre-wrap`, colour `#b31d28`; and add `#f85149` in the `prefers-color-scheme: dark` block (1ce68e0)

**Checkpoint**: User Stories 1–3 work. A typo costs one diagram, never the content.

---

## Phase 6: User Story 4 - Copy a code block with one click (Priority: P4)

**Goal**: Every non-blank fence gets a hover- and focus-revealed, icon-only copy button. It copies the exact code, confirms for 1.4 s, and is excluded from PDFs.

**Independent Test**: Hover a fence in the formatting tour, click the button and paste: the result is the exact code, with no trailing line break. Tab to the button and press Enter for the same result. Export to PDF shows no buttons (quickstart V6).

### Implementation for User Story 4

- [X] T021 [US4] Define the icon-only `COPY_ICON` and `CHECK_ICON` inline-SVG constants (`aria-hidden="true"`, no text node, so find and the outline never see a label) in src/renderer/renderer.js (1ce68e0)
- [X] T022 [US4] Implement `addCopyButton(pre)` in src/renderer/renderer.js: skip a `pre` that already has a `:scope > .folio-copy` child or whose code text is blank; append `<button type="button" class="folio-copy" contenteditable="false">`, labelled "Copy code" through `title` and `aria-label`; on click, call `preventDefault()`/`stopPropagation()` and `navigator.clipboard.writeText(code.textContent.replace(/\n$/, ''))` (1ce68e0)
- [X] T023 [US4] Implement `setCopyButtonLabel()` and `flashCopyButton(btn, ok)` in src/renderer/renderer.js. Success shows the check icon, `folio-copy-done` and "Copied"; failure shows `folio-copy-failed` and "Copy failed". A per-button timer, kept in a `WeakMap`, reverts the button to "Copy code" after 1400 ms (1ce68e0)
- [X] T024 [US4] In src/renderer/renderer.js, add `addCopyButtons()`, a sweep of `#write pre.md-fences`, and call it right after `renderMermaidBlocks()` in `renderPreview()`. Also call `addCopyButton()` on the fallback block inside `renderMermaidError()`, because that block is created after the sweep (1ce68e0)
- [X] T025 [P] [US4] Style the button in src/renderer/app.css: `#write pre.md-fences { position: relative }`; a 26×26 px button 6 px from the top-right with `opacity: 0`, revealed by `pre.md-fences:hover > .folio-copy` or `.folio-copy:focus-visible`; `folio-copy-done`/`folio-copy-failed` states pinned visible; `user-select: none`; a 14 px icon (1ce68e0)
- [X] T026 [US4] In src/renderer/app.css, add the button's dark palette (idle, hover, done, failed) to the `prefers-color-scheme: dark` block, and add `@media print { #write .folio-copy { display: none } }` so PDFs omit it (1ce68e0)

**Checkpoint**: User Story 4 works on any document with fences, independently of diagrams.

---

## Phase 7: User Story 5 - Code colours identical to Typora (Priority: P5)

**Goal**: Fences are tokenized by the same CodeMirror 5 modes Typora runs and emit Typora's `.cm-*` classes, so the theme's `--color-cm-*` palette colours them exactly as in Typora.

**Independent Test**: Inspect a `js` fence in DevTools: it has `code.cm-s-inner` with `cm-keyword`, `cm-def`, `cm-variable` and similar spans, and identifiers are coloured. Switching to Dark changes the colours through the theme palette (quickstart V7).

### Implementation for User Story 5

- [X] T027 [US5] Replace `highlight.js` `^11.10.0` with `@codemirror/legacy-modes` `^6.5.3` in package.json and package-lock.json (5c3ee89)
- [X] T028 [US5] Create src/renderer/highlight.js. It imports 78 CodeMirror 5 modes from 55 `@codemirror/legacy-modes/mode/*` files and `StringStream` from `@codemirror/language`, and defines the 170-key `MODES` alias table (C family, Web, Scripting, Systems, Functional, Data/config/query, Tooling). `php: null` maps PHP to plain text (5c3ee89)
- [X] T029 [US5] Implement `resolveMode(info)` and `hasLanguage(info)` in src/renderer/highlight.js: take the first whitespace-delimited word, lower-cased, and look it up as an own property of `MODES` (5c3ee89)
- [X] T030 [US5] Implement CodeMirror 5 class derivation in src/renderer/highlight.js: `TOKEN_ALIASES` (63 Lezer-style names folded onto CM5 names, `null` = no span), `normalizeToken()` (direct alias, then base-tag alias, then a valid-class-name check) and `cmClass()` (prefix `cm-` to each space-separated part) (5c3ee89)
- [X] T031 [US5] Implement `runMode()` and `highlightFence(code, info)` in src/renderer/highlight.js: drive `mode.token()` over a per-line `StringStream` (`TAB_SIZE` 4, `INDENT_UNIT` 2), report blank lines through `mode.blankLine`, nudge zero-width tokens, escape `& < > "`, stop styling a line after `MAX_TOKENS_PER_LINE` (10000), and fall back to escaped plain text for unknown languages or failing modes, logging mode errors (5c3ee89)
- [X] T032 [US5] In src/renderer/renderer.js, switch the markdown-it `highlight` hook to return `<pre class="md-fences"><code class="cm-s-inner language-<first word>">` (language escaped) wrapping `highlightFence(str, lang)`, remove the `highlight.js` import, and change the `renderMermaidError()` fallback from `hljs` classes to `<code class="cm-s-inner">` (5c3ee89)
- [X] T033 [P] [US5] In src/renderer/app.css, delete the GitHub light/dark highlight.js token palettes; add fence-scoped fallback colours from the `--color-cm-*` variables for `cm-string-2`, `cm-qualifier`, `cm-bracket`, `cm-quote`, `cm-positive`, `cm-negative`, `cm-error`, `cm-em` and `cm-strong`; and add `#write .md-fences > code, #write .md-fences > tt { font-size: inherit }` against compounded theme font sizes (5c3ee89)
- [X] T034 [P] [US5] Remove the obsolete `.md-fences .hljs` selector from the fenced inner-code reset in themes/base.css (5c3ee89)

**Checkpoint**: All user stories are independently functional. Fences now match Typora class-for-class.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and the constitution's quality gates

- [X] T035 [P] Document the fence copy button (hover or keyboard focus, excluded from PDFs), add the **Diagrams** feature bullet (seven types, Light/Dark colours, parse-failure fallback), and add the Mermaid acknowledgement in README.md (1ce68e0)
- [X] T036 Review the new `appearance-changed` channel and the 20 s `prepare-export` wait against constitution Principle III (quality gate 5), using src/preload.js, src/main.js and specs/010-mermaid-diagrams-code-blocks/contracts/ipc-channels.md (1ce68e0)
- [X] T037 Run the renderer build gate per quickstart V9: `npm run build:renderer` (minified) and `npm run watch:renderer` (readable), covering the build.js and src/renderer/highlight.js changes (1ce68e0, 5c3ee89)
- [X] T038 Validate the scenarios in specs/010-mermaid-diagrams-code-blocks/quickstart.md (V1–V8, V10), including the Light/Dark × Fluent/GitHub/Microsoft Word sweep (quality gate 3) (1ce68e0, 5c3ee89)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 and T002 can run together.
- **Foundational (Phase 2)**: Depends on T001 (the `mermaid` import). Blocks US1–US3.
- **User Stories (Phase 3+)**:
  - US1 depends on Foundational.
  - US2 and US3 extend US1's drawing pass.
  - US4 and US5 need only Setup and can proceed in parallel with US1.
- **Polish (Final Phase)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependencies on other stories.
- **User Story 2 (P2)**: Needs US1's `mermaidPending` (T007) and the source-mode exit that re-renders. Independently testable through export.
- **User Story 3 (P3)**: Needs US1's per-diagram `catch` site in `renderMermaidBlocks()` (T007). Independently testable with a malformed diagram.
- **User Story 4 (P4)**: Independent of US1–US3, except T024's fallback hook, which needs `renderMermaidError()` (T018). Testable on any fenced code.
- **User Story 5 (P5)**: Independent. T032 also retargets the US3 fallback markup (T018) from `hljs` to `cm-s-inner`. It shipped eight days later as its own increment (`5c3ee89`).

### Within Each User Story

- US1: T005 → T006 → T007 → T008 in sequence (same file). T010 + T011 → T012 → T013. T009 and T014 at any time.
- US2: T015 → T016; T017 in parallel.
- US3: T018 → T019; T020 in parallel.
- US4: T021 → T022 → T023 → T024; T025 → T026 (same file).
- US5: T027 → T028 → T029 → T030 → T031 → T032; T033 and T034 in parallel with the module work.

### Parallel Opportunities

- Setup: T001 ∥ T002.
- US1: T009 (app.css) ∥ T010 (main.js) ∥ T011 (preload.js) ∥ T014 (formatting-tour.md), alongside the renderer.js sequence.
- US2: T017 (main.js) ∥ T015–T016 (renderer.js).
- US3: T020 (app.css) ∥ T018–T019 (renderer.js).
- US4: T025 (app.css) ∥ T021–T024 (renderer.js).
- US5: T033 (app.css) ∥ T034 (themes/base.css) ∥ T028–T031 (highlight.js).
- Across stories: US5 can be built entirely in parallel with US1–US4.

---

## Parallel Example: User Story 1

```bash
# Launch the non-renderer pieces of User Story 1 together:
Task: "Add diagram layout rules in src/renderer/app.css"
Task: "Send appearance-changed to every session from nativeTheme 'updated' in src/main.js"
Task: "Expose onAppearanceChanged on window.folioAPI in src/preload.js"
Task: "Add a Diagrams section with a flowchart and a sequence diagram to samples/formatting-tour.md"
```

## Parallel Example: User Story 5

```bash
# Theme-side changes alongside the highlighter module:
Task: "Replace the highlight.js palettes with the fence-scoped .cm-* fallback colours and the font-size fix in src/renderer/app.css"
Task: "Remove the obsolete .md-fences .hljs selector in themes/base.css"
Task: "Implement runMode() and highlightFence() in src/renderer/highlight.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T004)
3. Complete Phase 3: User Story 1 (T005–T014)
4. **STOP and VALIDATE**: quickstart V1–V3. The formatting tour shows drawn diagrams in Light and Dark.
5. Demo: documents with diagrams are readable in Folio.

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → diagrams in the preview (MVP)
3. US2 → diagrams in PDFs
4. US3 → graceful fallback for broken diagrams
5. US4 → copy buttons on fences. US1–US4 shipped together in `1ce68e0` (2026-08-12).
6. US5 → Typora-identical colouring, shipped as its own increment in `5c3ee89` (2026-08-20).

### Parallel Team Strategy

With multiple developers:

1. The team completes Setup + Foundational together.
2. Developer A: US1 → US2 → US3, the diagram pipeline in src/renderer/renderer.js.
3. Developer B: US4, the copy button (renderer.js copy section + app.css). It coordinates with A only on T024's fallback hook.
4. Developer C: US5, the new src/renderer/highlight.js plus the CSS and theme changes.

---

## Notes

- Tasks marked [P] touch different files and have no unfinished dependencies.
- The [Story] label maps each task to its user story for traceability.
- Each user story should be independently completable and testable.
- Every task ends with the commit that delivered it. Cross-cutting validation tasks cite both commits.
- **No task updates README.md for `5c3ee89`.** That update never happened: README still credits highlight.js in Features, Project layout and Acknowledgements ([research.md](./research.md) F1). A follow-up feature should fix it.
- The text-rendering part of `5c3ee89` is documented by [001](../001-markdown-viewer-editor/spec.md), not here: the `disable-lcd-text` switch in `src/main.js`, and removing the `-webkit-text-stroke` weight compensation, including the `-webkit-text-stroke: 0` overrides on the diagram and copy-button rules.
- Avoid: vague tasks, same-file conflicts, and cross-story dependencies that break independence.
