# Feature Specification: Math Typesetting (TeX)

**Feature Branch**: `009-math-typesetting`

**Created**: 2026-07-16

**Status**: Implemented (retroactive)

**Input**: User description: "Render TeX math in the preview: inline formulas between $…$ and display equations between $$…$$, typeset properly and included in PDF exports. It has to work offline with no CDN, and a malformed formula must not break the rest of the document."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `68e67be` (2026-07-16), the same commit that delivered the source formatting commands specified in [008-source-editing-tools](../008-source-editing-tools/spec.md) and the icon artwork covered by [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md); only the math rendering is specified here. No later commit changed math behavior (`1ce68e0` touched only neighbouring README and lockfile lines). Related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (preview, safety filtering, source mode, PDF export), [004-three-axis-theming](../004-three-axis-theming/spec.md) (Light/Dark appearance), [008-source-editing-tools](../008-source-editing-tools/spec.md) (the Inline Math and Math Block commands insert the syntax rendered here), [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md) (diagrams, rendered separately).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read typeset formulas in the preview (Priority: P1)

A user opens a Markdown document that contains TeX math (inline formulas between single dollar signs, display equations between double dollar signs) and reads it the way it would look in a textbook. Inline formulas flow inside the sentence at the size of the surrounding text; display equations stand centered on their own line with full-size operators. Formulas work wherever text does: paragraphs, headings, list items, block quotes, table cells and footnotes. They take the page's text colour in Light and Dark appearance and scale with zoom. Switching to source mode shows the same formulas as the TeX that was typed.

**Why this priority**: Rendering is the feature. Without it a document full of `\frac{a}{b}` and `\sum_{i=1}^{n}` is unreadable, and every other story (errors, export, offline use) depends on formulas being typeset first.

**Independent Test**: Open a document containing `The area is $\pi r^2$.` and a three-line display block (`$$`, a line of TeX, `$$`) and confirm both are typeset. This delivers readable math with no other story in place.

**Acceptance Scenarios**:

1. **Given** a document containing `The area is $\pi r^2$.`, **When** it is opened in the preview, **Then** the sentence shows a typeset π r² inline, at the size of the surrounding text, followed by the period.
2. **Given** a display equation written as an opening `$$` line, one or more lines of TeX and a closing `$$` line (or as `$$…$$` alone on one line), **When** the document is rendered, **Then** the equation appears centered on its own line in display style, for example with a full-height integral sign and fraction.
3. **Given** formulas inside a heading, a list item, a block quote, a table cell and a footnote, **When** the document is rendered, **Then** each formula is typeset in place.
4. **Given** a rendered document with math in Light appearance, **When** the user selects `Themes > Appearance > Dark`, **Then** the formulas, including fraction bars, root signs and arrows, switch to the dark page's text colour together with the text, without reopening the document.
5. **Given** a rendered document with math, **When** the user zooms in (`Ctrl/Cmd +`) or out (`Ctrl/Cmd -`), **Then** the formulas scale together with the text.
6. **Given** a rendered document with math, **When** the user toggles source mode (`Ctrl/Cmd+/`), **Then** the formulas appear as the TeX source that was typed; **and when** the user edits a formula and clicks **Exit Source**, **Then** the preview shows the edited formula typeset, even though the edit is not saved yet.
7. **Given** the formula `$a--b$` in a document (in ordinary prose Folio turns `--` into a dash), **When** it is rendered, **Then** the formula shows two minus signs, not a dash, because formula text is never altered by typographic replacements.

---

### User Story 2 - Keep a broken formula from spoiling the document (Priority: P2)

A user writes a formula with a mistake, such as a missing brace or a misspelled command. Instead of a blank or half-rendered preview, they see the whole document as usual, and the broken formula is pointed out in place: its TeX source is shown in red, and resting the pointer on it shows what is wrong. An unknown command is flagged in red while the rest of its formula is still typeset. Commands that would turn a formula into a link, load an image or inject page attributes are refused the same way, so a document received from someone else cannot use math to smuggle in active content.

**Why this priority**: The request states that a malformed formula must not break the rest of the document. Typos are inevitable while writing TeX, and opened documents are untrusted input.

**Independent Test**: Put `$\frac{1}{$` between two valid formulas in one paragraph and confirm that only that formula shows as red source with a hover message while everything else renders.

**Acceptance Scenarios**:

1. **Given** a paragraph containing `$\frac{1}{$` between two valid formulas, **When** it is rendered, **Then** the broken formula appears as its TeX source in red, its error message appears when the pointer rests on it, and the two valid formulas and the rest of the document render normally.
2. **Given** a display equation containing a TeX error, **When** the document is rendered, **Then** the equation's source appears in red in its place and the paragraphs after it render normally.
3. **Given** `$\foo + 1$`, where `\foo` is not a known command, **When** it is rendered, **Then** `\foo` appears in red while `+ 1` is typeset.
4. **Given** `$\href{https://example.com}{x}$` or `$\includegraphics{x.png}$`, **When** it is rendered, **Then** no link or image is created and the command name appears in red.
5. **Given** a formula that defines a macro which expands forever, such as `$\def\a{\a}\a$`, **When** it is rendered, **Then** the typesetter gives up and shows that formula as an error, and the app stays responsive.
6. **Given** a document that mixes formulas with embedded HTML carrying a script handler (for example `<img src="x" onerror="alert(1)">`), **When** it is rendered, **Then** the formulas are typeset and the script does not run.

---

### User Story 3 - Export documents with math to PDF (Priority: P2)

A user shares a document as a PDF with `File > Export to PDF…`. The PDF shows exactly the formulas they saw in the preview, drawn with the same math typefaces, also when they started the export while editing in source mode.

**Why this priority**: The request names PDF export explicitly, and a PDF is how a Folio document usually leaves the app. It builds on User Story 1.

**Independent Test**: Export the quickstart test document and compare the PDF with the preview.

**Acceptance Scenarios**:

1. **Given** a document with inline and display math shown in the preview, **When** the user chooses `File > Export to PDF…` and saves, **Then** every formula appears typeset in the PDF as it does in the preview.
2. **Given** the user is in source mode, **When** they choose `File > Export to PDF…`, **Then** Folio first returns to the rendered view and the PDF contains typeset formulas, not TeX source.
3. **Given** a document containing a broken formula, **When** it is exported, **Then** the PDF shows the same red source for that formula and the rest of the document typeset normally.

---

### User Story 4 - Read math offline (Priority: P3)

A user on a machine without network access (on a plane, behind a strict firewall, on an air-gapped computer) opens a document with math. Formulas look exactly as they do online, drawn with the proper math typefaces, because everything needed to draw them ships with Folio. Nothing is fetched from the internet, on any platform.

**Why this priority**: The request requires offline use with no content delivery network, and Folio promises to work fully locally. It ranks after the visible behavior because it is a property of how formulas are delivered rather than a separate workflow.

**Independent Test**: Disable every network connection, start Folio (a development run and an installed build), open a document with math, and confirm that the formulas render with the math typefaces and that no network request is made.

**Acceptance Scenarios**:

1. **Given** the computer has no network connection, **When** a document with math is opened, **Then** formulas render with the math typefaces, identical to an online session, rather than with a fallback system font.
2. **Given** Folio installed from its Windows, macOS or Linux package, **When** a document with math is opened, **Then** formulas render correctly, because the math typefaces and styles are part of the installed app.
3. **Given** the developer tools' network view is open (`View > Toggle Developer Tools`), **When** a document with math renders, **Then** every math font and style is loaded from Folio's own files and no request leaves the computer.

---

### User Story 5 - Write dollar signs and code without accidental math (Priority: P3)

A writer mentions prices, shell variables and code snippets. These must not be swallowed into formulas: amounts such as `$5 and $10`, dollar signs escaped with a backslash, and anything inside inline code or code blocks stay exactly as typed.

**Why this priority**: False positives would garble everyday prose and code samples, but they only matter once math rendering exists, and most dollar signs in prose are protected by the delimiter rules without any effort from the writer.

**Independent Test**: Render a paragraph with `It costs $5 and $10.`, `US$5 and US$10`, `\$x\$`, an inline code span and a fenced code block that contain dollar signs, and confirm each shows exactly as typed.

**Acceptance Scenarios**:

1. **Given** `It costs $5 and $10.`, **When** it is rendered, **Then** the text reads exactly `It costs $5 and $10.` with no formula.
2. **Given** `\$x\$`, **When** it is rendered, **Then** it reads `$x$`, with no formula.
3. **Given** `US$5 and US$10`, **When** it is rendered, **Then** it reads exactly as typed, because a dollar sign directly after a letter or digit never starts a formula.
4. **Given** the inline code span `` `echo $HOME` `` and a fenced code block containing `$x$`, **When** they are rendered, **Then** both show their dollar signs as code, untouched.

---

### Edge Cases

- **Spaces next to dollar signs**: pairing is positional. `costs $ 5 and $ 10` *is* treated as a formula, because the second `$` is followed by a space and therefore closes the first, while `$5 and $10` is not. Writers escape literal dollar signs as `\$` when in doubt.
- **Unclosed or empty delimiters**: a single `$` without a valid partner, and a `$$` in running text without a closing `$$`, are shown literally; so is an empty pair (`$$` or `$$$$` in running text). An inline formula never continues past a blank line.
- **Display pair inside a sentence**: `The value $$x+1$$ follows.` typesets `x+1` as a display equation that splits the line.
- **Unterminated display block**: a line starting with `$$` whose block is never closed, or a one-line `$$…$$` followed by more text on the same line (even trailing spaces), runs on to the next line containing `$$` or to the end of the document (or of the enclosing list or quote), like an unclosed code block. That whole span is treated as one formula and is usually shown as a red error.
- **Display-only environments inline**: an inline formula that uses `align`, `equation`, `gather`, `alignat` or `CD` is typeset in display style instead of failing.
- **Forms that are not typeset**: a fenced code block labelled `math` is shown as a code block; `\begin{…}…\end{…}` written without dollar delimiters is shown as text; dollar signs inside embedded HTML blocks are left as typed; chemistry notation (`\ce`) is not available and is flagged as an unknown command.
- **Explicit colours**: a formula that sets its own colour (`\color{black}{…}`) keeps it in Dark appearance, where it can be hard to read. The red error colour is also the same in both appearances.
- **Headings with math**: the formula is typeset on the page, but the outline entry and the heading's link anchor are built from the heading's plain text, so the outline shows the formula's characters as flat text (repeated, plus raw TeX) instead of a typeset formula, and the anchor name contains the same text.
- **Very wide display equations**: they do not wrap. An equation wider than the page column extends past it and is cut off at the window edge, with no horizontal scrolling.
- **Macro definitions**: `\def` and `\newcommand` apply only inside the formula that defines them.
- **Source mode and reloads**: there is no live typesetting while editing in source mode. Formulas are typeset again whenever the preview is rendered: on opening, on leaving source mode, on reload from disk and before PDF export.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The preview MUST typeset TeX enclosed in single dollar signs (`$…$`) as an inline formula within the line of text, at the size of the surrounding text.
- **FR-002**: The preview MUST typeset TeX enclosed in double dollar signs (`$$…$$`) as a display equation centered on its own line, whether it is written as a block (an opening `$$` at the start of a line and a closing `$$` at the end of a later line), as `$$…$$` alone on one line, or as a `$$…$$` pair inside a paragraph.
- **FR-003**: A `$` MUST open an inline formula only when it is not immediately preceded by a letter (A–Z, a–z), a digit, an underscore, a backslash or another `$`; the next unescaped `$` MUST close it only when that `$` is not immediately followed by a letter (A–Z, a–z), a digit, an underscore or another `$`. When either condition fails, the opening `$` MUST be shown literally. An inline formula MUST NOT extend across a blank line.
- **FR-004**: A backslash-escaped dollar sign (`\$`) outside a formula MUST be shown as a literal `$`; inside a formula it MUST be part of the TeX (drawing a dollar sign) and MUST NOT close the formula.
- **FR-005**: Dollar signs inside inline code spans, fenced code blocks and indented code blocks MUST be shown as typed. A `$` or `$$` within a line of text that has no valid closing delimiter later in the same paragraph MUST be shown literally (a `$$` that starts a line opens a display block instead; see Edge Cases).
- **FR-006**: The text of a formula MUST reach the typesetter unchanged: the document's typographic replacements (smart quotes, dashes, symbols such as ©), emoji shortcodes and automatic link detection MUST NOT alter it.
- **FR-007**: An inline formula that uses a display-only environment (`align`, `equation`, `gather`, `alignat`, `CD`) MUST be typeset in display style.
- **FR-008**: Typeset formulas (glyphs, fraction bars, root signs and stretchy symbols) MUST use the colour of the surrounding text, MUST follow Light/Dark appearance changes without the document being reopened, and MUST scale with the text size and zoom.
- **FR-009**: A formula that cannot be parsed MUST be shown in its place as its TeX source in a red error colour, with the error message available on hover; all other content, including other formulas, MUST render normally.
- **FR-010**: An unknown command MUST be shown in the error colour within its otherwise typeset formula.
- **FR-011**: Formulas MUST NOT be able to create links, load images or set page classes, ids, styles or data attributes: `\href`, `\url`, `\includegraphics`, `\htmlClass`, `\htmlId`, `\htmlStyle` and `\htmlData` MUST be refused and shown in the error colour, and runaway macro expansion MUST end in an error instead of hanging the app.
- **FR-012**: Typeset formulas MUST pass through the same safety filtering as the rest of the rendered document before they are displayed, and that filtering MUST preserve their visible typeset form.
- **FR-013**: Source mode MUST show formulas as plain TeX source; leaving source mode MUST typeset the current text, including unsaved edits.
- **FR-014**: `File > Export to PDF…` MUST produce typeset formulas identical to the preview, including when the export is started from source mode.
- **FR-015**: Math MUST render fully offline on macOS, Windows and Linux: the math typefaces and styles MUST ship inside every build and installer, and rendering MUST NOT contact any network service or require loosening the app's protection against remote and inline scripts.
- **FR-016**: The following MUST NOT be typeset: fenced code blocks labelled `math` (shown as code blocks), `\begin…\end` environments written without dollar delimiters (shown as text), and dollar signs inside embedded HTML blocks (shown as typed).

### Key Entities

- **Formula**: a piece of TeX in a document. It has a kind (inline or display), its TeX source, and an outcome: typeset, or shown in place as an error with a message. Formulas are independent: an error, a refused command or a macro definition in one formula never affects another.
- **Math typefaces and styles**: the fonts and style rules needed to draw formulas. They ship with the app, are identical on every platform, are never downloaded, and always match the typesetter version of the build.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the quickstart test document, 100% of the valid formulas (inline and display, including those in headings, lists, quotes, tables and footnotes) appear typeset on first open, with none shown as raw TeX.
- **SC-002**: Adding one malformed formula to a document changes the appearance of that formula only: 0 other paragraphs or formulas render differently, and the error message is available by hovering the formula.
- **SC-003**: 100% of the literal-dollar examples in the test document (`$5 and $10`, `$20,000 and $30,000`, `US$5 and US$10`, `\$x\$`, dollar signs in code) display exactly as typed.
- **SC-004**: With every network connection disabled, formulas render with the same typefaces and layout as online, and 0 network requests are made to display them.
- **SC-005**: A PDF exported from the test document contains every formula shown in the preview (same count, same appearance), whether the export starts from the preview or from source mode.
- **SC-006**: After an appearance switch between Light and Dark, formulas show the new text colour at the same moment as the surrounding text, with no reload, reopen or second step.
- **SC-007**: Formulas are already typeset the moment the preview appears; users never see raw TeX that is replaced later (0 intermediate states).
- **SC-008**: The math typefaces and styles add less than 0.5 MB to the app (about 320 KB as shipped).

## Assumptions

- The preview, the safety filtering of rendered documents, source mode, reload from disk and PDF export already exist ([001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md)). This feature adds formulas to that pipeline and changes none of those behaviors.
- Light/Dark appearance and the Style families come from [004-three-axis-theming](../004-three-axis-theming/spec.md). Formulas follow the text colour, so no per-theme work is needed; this also covers the System appearance later added by [011-system-appearance](../011-system-appearance/spec.md).
- Authoring help, `Format > Inline Math` (`Ctrl/Cmd+M`, wraps the selection in `$…$`) and `Format > Math Block` (`Ctrl/Cmd+Shift+M`, inserts a `$$` block), is specified in [008-source-editing-tools](../008-source-editing-tools/spec.md). This feature renders whatever those commands insert.
- Diagram fences are rendered by [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md) and are unaffected by math.
- The supported TeX is the LaTeX math subset of the bundled typesetter; anything outside it is flagged with the error presentation above. No add-on packages (such as chemistry notation) are loaded.
- The goal is visual typesetting in the preview and in PDF. Editing math visually in the preview is out of scope (editing happens in source mode), as is screen-reader support beyond what the typeset output already provides.
- Behavior is identical on macOS, Windows and Linux; nothing in this feature is platform-specific.
- Opened documents are untrusted input; formulas get no more privileges than any other document content.
