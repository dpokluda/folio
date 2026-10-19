# Feature Specification: Mermaid Diagrams & Code Block Enhancements

**Feature Branch**: `010-mermaid-diagrams-code-blocks`

**Created**: 2026-08-12

**Status**: Implemented (retroactive)

**Input**: User description: "Draw mermaid fenced code blocks as diagrams (flowchart, sequence, class, state, ER, Gantt, pie) in the preview and in PDF exports, with colours that follow the Light/Dark appearance; if a diagram fails to parse, show its source and the parser's message instead. Give every code fence a copy-to-clipboard button that appears on hover or keyboard focus and is left out of PDFs. Then make code-fence syntax colouring match Typora exactly, so themes colour code the same way they do in Typora."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `1ce68e0` (2026-08-12: diagrams, PDF-export wait, appearance-driven redraw, copy button, formatting-tour samples) and `5c3ee89` (2026-08-20: Typora-identical code-fence colouring only; that commit's text-rendering changes are documented by [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md)); related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (baseline preview, code-fence display and Export to PDF), [004-three-axis-theming](../004-three-axis-theming/spec.md) (the Style and Appearance axes the diagrams and code colours follow), [011-system-appearance](../011-system-appearance/spec.md) (OS-driven appearance flips that reuse this feature's diagram redraw).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Mermaid diagrams drawn in the preview (Priority: P1)

A writer keeps architecture notes in Markdown and describes flows and interactions with Mermaid syntax inside ```` ```mermaid ```` fenced blocks. When such a document is opened in Folio, each of those blocks appears as a drawn diagram (flowchart, sequence, class, state, entity-relationship, Gantt or pie) in its place on the page instead of a block of diagram source. The diagram is readable in both Light and Dark appearance, uses the same font as the surrounding text, and is redrawn automatically when the user changes the appearance or the Style.

**Why this priority**: Text-defined diagrams are common in technical Markdown, and Typora draws them. Showing their raw source makes these documents hard to read in Folio. Drawing them is the core of the feature and is valuable on its own.

**Independent Test**: Open `Help > Markdown Formatting Tour` and scroll to **Diagrams**. A flowchart and a sequence diagram are drawn. Switch between Light and Dark in the **Themes** menu, and between Styles: the diagrams are redrawn each time with a matching palette and font.

**Acceptance Scenarios**:

1. **Given** a document containing a ```` ```mermaid ```` block with a valid flowchart, **When** it is shown in the preview, **Then** a flowchart diagram is drawn where the block was and none of its source text is visible.
2. **Given** a document containing valid flowchart, sequence, class, state, entity-relationship, Gantt and pie blocks, **When** it is previewed, **Then** every block is drawn as its diagram type, in document order.
3. **Given** a diagram drawn in Light appearance, **When** the user selects **Dark** in the **Themes** menu, **Then** the diagram is redrawn with a dark palette without reopening the document, and selecting **Light** again restores the light palette.
4. **Given** a drawn diagram, **When** the user selects another Style (for example **Microsoft Word**), **Then** once the new Style has loaded the diagram is redrawn with its labels in that Style's body font.
5. **Given** a block whose info string is ```` ```Mermaid ```` or ```` ```mermaid title="Flow" ````, **When** it is previewed, **Then** it is drawn as a diagram too.
6. **Given** a diagram wider than the page, **When** it is previewed, **Then** it is scaled down to the page width and centred rather than overflowing the page.
7. **Given** diagram source that contains HTML markup or a click-callback directive, **When** it is drawn, **Then** no script from the diagram runs and the click callback is not attached.

---

### User Story 2 - Export documents with diagrams to PDF (Priority: P2)

A user shares design notes as PDF. When they choose `File > Export to PDF…`, the PDF shows the diagrams exactly as the preview does, even if the document was opened a moment earlier or was in source mode, and the export never hangs waiting for them.

**Why this priority**: PDF is how Folio documents leave the app. A PDF with empty spaces where the diagrams should be loses content silently. The story builds on Story 1 but can be tested on its own.

**Independent Test**: Open the Markdown Formatting Tour, switch to source mode (`Ctrl/Cmd+/`), and immediately choose `File > Export to PDF…`. The saved PDF contains both diagrams drawn, not their source and not empty areas.

**Acceptance Scenarios**:

1. **Given** a document with diagrams that was just opened and is still being drawn, **When** the user exports to PDF, **Then** the export waits until drawing has finished and the PDF contains every diagram.
2. **Given** source mode is active, **When** the user exports to PDF, **Then** Folio returns to the preview, draws the diagrams, and the PDF contains the drawn diagrams.
3. **Given** a document with a diagram that cannot be drawn, **When** it is exported, **Then** the PDF shows that diagram's source and the parser's message exactly as the preview does.
4. **Given** diagram drawing has not finished within 20 seconds, **When** the user exports, **Then** the export goes ahead after 20 seconds with whatever has been drawn instead of waiting forever.

---

### User Story 3 - Recover gracefully from a broken diagram (Priority: P3)

A user makes a typo in a diagram. Instead of a blank area, or a diagram that silently disappears, Folio shows the diagram's source as a code block followed by the parser's message, so the user can see what is wrong, fix it in source mode, and keep reading the rest of the document.

**Why this priority**: Diagram syntax is unforgiving, and documents written for newer tools can contain syntax Folio cannot draw. A typo must cost one diagram, never the content itself. The story is independent of export and of the copy button.

**Independent Test**: Create a document with one valid diagram and one malformed diagram (for example a flowchart whose last line is `A -->`). Preview it: the valid diagram is drawn, and the malformed one shows its source followed by the parser's message.

**Acceptance Scenarios**:

1. **Given** a malformed diagram, **When** it is previewed, **Then** its source appears as a plain code block followed by the parser's message in a warning colour, set in a monospace font with the message's line breaks and spacing preserved, so its marker points at the offending column.
2. **Given** a document with one malformed and two valid diagrams, **When** it is previewed, **Then** the two valid diagrams are drawn and only the malformed one falls back.
3. **Given** an empty ```` ```mermaid ```` block, or one that does not start with a recognised diagram type, **When** it is previewed, **Then** it is handled as a diagram that cannot be drawn and a message is shown, rather than an empty area.
4. **Given** a fallback is shown, **When** the user fixes the source in source mode and returns to the preview, **Then** the diagram is drawn.
5. **Given** malformed diagram source that contains characters such as `<`, `>` or `&`, **When** it falls back, **Then** those characters are displayed literally and never interpreted as markup.

---

### User Story 4 - Copy a code block with one click (Priority: P4)

A reader wants to run a command or reuse a snippet shown in a document. Hovering any fenced code block reveals a small copy button in its top-right corner. One click puts exactly the block's code on the clipboard and briefly confirms it. Keyboard users reach the same button with Tab. The button never shows up in PDFs, search results or copied text selections.

**Why this priority**: Selecting code by dragging is error-prone: it easily picks up too much or too little and adds a stray trailing line. A one-click copy is a convenience, independent of diagrams.

**Independent Test**: Open the Markdown Formatting Tour, hover the JavaScript block, click the copy button, and paste into any text editor: the pasted text is exactly the code, with no trailing blank line. Press Tab until the button is focused and press Enter: the result is the same. Export to PDF: no copy buttons appear.

**Acceptance Scenarios**:

1. **Given** a fenced code block, **When** the pointer moves over it, **Then** a copy button appears in its top-right corner, and **When** the pointer leaves, **Then** the button hides again.
2. **Given** the copy button is clicked, **Then** the clipboard holds the block's code exactly as written in the document, as plain text without the final line break, and the button shows a check mark labelled "Copied" for about 1.4 seconds before returning to normal.
3. **Given** a keyboard user, **When** they press Tab until the button has focus, **Then** the button becomes visible, and pressing Enter or Space copies the block.
4. **Given** the clipboard cannot be written, **When** the button is activated, **Then** it shows a "Copy failed" state in a failure colour for about 1.4 seconds.
5. **Given** a document with code blocks, **When** the user searches it with Find, opens the outline, or selects and copies text across a code block, **Then** the copy buttons contribute no text: no matches, no outline entries, nothing extra in the copied selection.
6. **Given** a document with code blocks, **When** it is exported to PDF, **Then** no copy buttons appear in the PDF.
7. **Given** Dark appearance, **When** the button is shown, **Then** it uses a dark variant that suits the dark page.

---

### User Story 5 - Code colours identical to Typora (Priority: P5)

A user who works in Typora on some machines and in Folio on others opens the same document with the same theme in both. Fenced code is coloured exactly as Typora colours it: the same parts of the code get the same colours from the theme's own code palette, in Light and Dark appearance and in every Style.

**Why this priority**: Theme compatibility is Folio's core promise. The first highlighter classified code differently from Typora (for example, plain identifiers stayed uncoloured where Typora colours them) and used a fixed palette of its own, so code looked different from Typora and ignored the theme's code colours. This refines the existing code-block display rather than adding new capability, so it comes last.

**Independent Test**: Open a document with JavaScript and Python fences in Typora and in Folio, both using the Fluent theme, and compare token colours side by side: they match. Switch Folio to Dark: the code switches to the theme's dark code palette.

**Acceptance Scenarios**:

1. **Given** a ```` ```js ```` fence, **When** it is previewed, **Then** keywords, variables, properties, strings, numbers, operators and comments are coloured from the active theme's code palette exactly as Typora colours the same fence with the same theme.
2. **Given** fences labelled ```` ```JS ````, ```` ```js title=app.js ````, ```` ```py ````, ```` ```sh ````, ```` ```yml ```` or ```` ```c# ````, **When** they are previewed, **Then** each is coloured as its language (JavaScript, Python, shell, YAML, C#).
3. **Given** a fence with no language, a language Folio has no grammar for (for example ```` ```php ````), or ```` ```text ````, **When** it is previewed, **Then** the code is shown as plain, readable text in the theme's code style, with every character displayed literally.
4. **Given** Dark appearance or a different Style, **When** fences are previewed, **Then** their colours follow that theme's code palette automatically, including token kinds that Typora colours from its own built-in defaults rather than from the theme (secondary strings, qualifiers, brackets, quotes, diff additions and removals, errors, emphasis, strong), which stay legible in Dark appearance.
5. **Given** a document with fences, **When** the user switches to source mode, **Then** the source editor's own syntax colours are unchanged by the fence colouring.
6. **Given** a fence, **When** it is previewed, **Then** its code is shown at the theme's intended code font size, the same size Typora uses, not smaller.

---

### Edge Cases

- **Unsaved edits**: the preview, and therefore every diagram, is always drawn from the current text. Leaving source mode draws diagrams from unsaved edits, and an export captures them as previewed.
- **Fast document switching**: when another document is opened (or the preview is re-rendered) while diagrams are still being drawn, the earlier drawing stops and none of its diagrams can appear in the new document.
- **Many diagrams**: diagrams are drawn one after another in document order. A failure in one of them does not stop the rest.
- **Appearance change in source mode**: no redraw happens while the source editor is showing. The diagrams are drawn in the current palette when the user returns to the preview.
- **Several windows**: an appearance change is app-wide, so every open window redraws its own diagrams, including windows in the background.
- **Style or Page-width change**: diagrams are redrawn only after the new theme has finished loading (or failed to load), so the labels are measured against the font that is actually in effect.
- **Slow diagrams during export**: if drawing has not finished after 20 seconds, the PDF is produced with whatever has been drawn. Diagrams still waiting appear as empty space.
- **Empty or unknown diagram**: an empty ```` ```mermaid ```` block, or one that names a diagram type the bundled engine does not recognise, falls back to the source-plus-message display. An empty block gets no copy button because there is nothing to copy.
- **Diagram types beyond the documented seven**: Folio does not filter diagram types. Any other type that the bundled diagram engine recognises is drawn as well, but only the seven listed types are promised.
- **Drawn diagrams have no copy button**: only fenced code blocks, and the fallback of a failed diagram, carry one. A successfully drawn diagram's source can be copied from source mode.
- **Blank or whitespace-only fences**: they get no copy button.
- **Trailing blank lines**: copying drops only the single line break that ends every block. Blank lines the author left at the end of the code are kept.
- **Clipboard refused**: the button shows its "Copy failed" state. Nothing else changes.
- **Indented code blocks** (four-space indented code rather than a fence): they are not fences, so they get neither a copy button nor language colouring.
- **Unknown or unsupported languages**: fences labelled with a language that has no grammar (for example `php`, `markdown`, `text`) are shown as plain text. If a grammar fails on a particular fence, that fence falls back to plain text and the rest of the document is unaffected.
- **Pathological lines**: if a single line produces more than 10,000 tokens, the rest of that line is shown as plain text so the preview cannot hang.

## Requirements *(mandatory)*

### Functional Requirements

**Diagrams**

- **FR-001**: System MUST treat a fenced code block (```` ``` ```` or `~~~`) whose info string (the words after the opening fence) starts with the word `mermaid`, in any letter case and optionally followed by further words, as a diagram rather than as code.
- **FR-002**: System MUST draw each diagram in place of its block in the rendered preview. It MUST support at least flowchart, sequence, class, state, entity-relationship, Gantt and pie diagrams, and MUST NOT restrict diagram types beyond what the bundled diagram engine supports.
- **FR-003**: System MUST show the document's text first and draw diagrams afterwards, one at a time in document order, so a document is readable before its diagrams finish.
- **FR-004**: System MUST draw diagrams in the diagram engine's strictest security mode: diagram text cannot run scripts or inject active content, and click callbacks declared in diagram source are disabled. The document MUST still be sanitized before display, and diagrams MUST be added only after sanitization.
- **FR-005**: Diagrams MUST use a light palette in Light appearance and a dark palette in Dark appearance.
- **FR-006**: When the appearance changes, every open window MUST redraw the diagrams of the document it shows in the new palette without any user action, including background windows. While source mode is active, the redraw MUST be deferred until the preview is shown again.
- **FR-007**: System MUST measure and set diagram labels in the active Style's body font, and MUST redraw diagrams after a Style or Page-width change once the new theme has finished loading.
- **FR-008**: System MUST give each diagram an identity that is unique within the document and the drawing pass, so one diagram's styling cannot affect another diagram.
- **FR-009**: If the preview is re-rendered while diagrams are still being drawn, System MUST stop the earlier drawing and MUST NOT let any of its results appear in the newer content.
- **FR-010**: System MUST centre each diagram and MUST scale a diagram wider than the page down to the page width, with horizontal scrolling as a fallback.
- **FR-011**: Diagram drawing MUST work fully offline, with everything it needs bundled with the app.

**Diagram failures**

- **FR-012**: When a diagram cannot be drawn for any reason (syntax error, empty block, unrecognised diagram type), System MUST show in its place the diagram source as a plain code block, followed by the parser's message, or "Invalid diagram" when no message is available. It MUST NOT leave a blank area or show the engine's own error graphic.
- **FR-013**: System MUST show the failure message in a monospace font with its line breaks and leading spaces preserved, in a warning colour with distinct Light and Dark variants.
- **FR-014**: System MUST display diagram source and failure messages as literal text and MUST NOT interpret them as markup.
- **FR-015**: A failure in one diagram MUST NOT prevent the other diagrams in the document from being drawn.

**PDF export**

- **FR-016**: Export to PDF MUST first return to the preview if source mode is active, then wait until the current diagram-drawing pass has finished before capturing the page, so diagrams and failure fallbacks appear in the PDF as they do in the preview.
- **FR-017**: The export MUST wait at most 20 seconds for diagrams and then proceed with whatever has been drawn.

**Copy button**

- **FR-018**: Every fenced code block with non-blank content MUST carry a copy button in its top-right corner, including the fallback block of a diagram that cannot be drawn. Blocks with no non-whitespace content MUST NOT have one.
- **FR-019**: The copy button MUST stay invisible until the pointer is over its code block or the button has keyboard focus. It MUST be a real button in the keyboard tab order that Enter or Space activates, and its accessible name and tooltip MUST be "Copy code".
- **FR-020**: Activating the button MUST put the block's code on the clipboard exactly as written in the document: plain text, without colouring markup and without the single line break that ends every block. Activation MUST NOT trigger any other action on the page.
- **FR-021**: After each activation the button MUST show, for 1.4 seconds, either a check mark and the label "Copied" or, when the clipboard write fails, the label "Copy failed" in a failure colour. It MUST stay visible for that time even if the pointer leaves, then revert to "Copy code". Several buttons MUST be able to show their confirmations at the same time.
- **FR-022**: The copy button MUST NOT add text to the document. It MUST produce no find-in-document matches and no outline entries, MUST NOT be included in text selections, and MUST NOT be editable.
- **FR-023**: The copy button MUST have Light and Dark visual variants and MUST be left out of printed and exported PDF output.

**Typora-identical code colouring**

- **FR-024**: System MUST colour fenced code with the same language grammars and token categories Typora uses, so an unmodified Typora theme's code palette colours fences in Folio exactly as it does in Typora.
- **FR-025**: System MUST take a fence's language from the first word of its info string, matched case-insensitively. It MUST accept common aliases, with 169 recognised names covering 78 language grammars and dialects (for example `js`/`javascript`/`jsx`/`mjs`, `ts`/`tsx`, `py`/`python`, `sh`/`bash`/`zsh`/`shell`/`console`, `yml`/`yaml`, `cs`/`csharp`/`c#`, `sql`/`mysql`/`postgres`, `dockerfile`/`docker`, `diff`/`patch`).
- **FR-026**: System MUST show a fence as plain, correctly escaped text in the theme's code style when it has no language, names a language without a grammar (for example `php`), or its grammar fails. Other fences MUST NOT be affected.
- **FR-027**: Code colours MUST come from the active theme's code palette and follow Style and Appearance changes automatically. Token categories that Typora colours from its built-in defaults rather than from the theme (secondary strings, qualifiers, brackets, quotes, diff additions and removals, errors, emphasis, strong) MUST be coloured from the theme's palette, with fallbacks, so they stay legible in Dark appearance.
- **FR-028**: Fence colouring MUST NOT change the colours of the source editor.
- **FR-029**: System MUST show fenced code at the theme's intended code font size, as Typora does, and not at a compounded smaller size.
- **FR-030**: Colouring MUST be bounded: after 10,000 tokens on a single line, System MUST show the rest of that line as plain text, so a misbehaving grammar cannot hang the preview.

**Samples**

- **FR-031**: The bundled Markdown Formatting Tour MUST include a **Diagrams** section with a flowchart and a sequence diagram.

### Key Entities

- **Diagram block**: A fenced block labelled `mermaid`. It has its source text, its position in the document, a drawing state (waiting, drawn, or failed with a message) and the palette it was drawn with (light or dark).
- **Code block**: Any other fenced block. It has an optional declared language (the first word of its info string), its code text, and a copy-button state (ready, copied, or copy failed).
- **Language name table**: The mapping from fence language names and aliases (case-insensitive) to a colouring grammar, or to plain text when no grammar exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the Markdown Formatting Tour, 2 of 2 sample diagrams are drawn, with none shown as source, in each of the 6 Style × Appearance combinations (Fluent, GitHub, Microsoft Word × Light, Dark).
- **SC-002**: After an appearance switch, 100% of the drawn diagrams in every open window show the new palette with no extra user action.
- **SC-003**: A PDF exported from a document whose diagrams finish drawing within 20 seconds contains 100% of those diagrams and no copy buttons, and no export waits longer than 20 seconds for diagrams.
- **SC-004**: In a document with N diagrams of which one is malformed, N−1 diagrams are drawn, and the malformed one shows its complete source and a parser message, leaving no blank areas.
- **SC-005**: Copying a code block takes one click (or one key press once the button has focus), and the pasted text matches the code as written character for character in 100% of tested blocks, including blocks that contain `<`, `&`, tabs and trailing blank lines.
- **SC-006**: The copy confirmation stays visible for 1.4 seconds (±0.2 s) after each activation, and searching a document for "Copy" finds no matches contributed by copy buttons.
- **SC-007**: In a side-by-side comparison of the same JavaScript and Python fences in Typora and in Folio with the same theme, no token is coloured differently and no fence differs in font size.
- **SC-008**: All 169 recognised language names produce coloured code. A fence labelled with any other name renders as plain text with no visible markup and no rendering error.
- **SC-009**: Diagrams and code colouring render with networking disabled; they need no network requests.

## Assumptions

- The Light/Dark Appearance and Style axes, and switching between them, come from [004-three-axis-theming](../004-three-axis-theming/spec.md). This feature only reacts to them. A **System** appearance that follows the OS is added later by [011-system-appearance](../011-system-appearance/spec.md), and its live OS-driven flips reuse this feature's redraw-on-appearance-change behaviour.
- Preview rendering and sanitization, source mode, fenced-code display and `File > Export to PDF…` (including the page size taken from the Page width) are baseline behaviour from [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md). This feature changes how fences are coloured and decorated, and makes export wait for diagrams.
- Find in document ([006-find-in-document-and-files](../006-find-in-document-and-files/spec.md)) and the outline already exist. The copy button is designed not to interfere with them.
- Diagram colours use the diagram engine's built-in light and dark palettes. They do not take on each Style family's colours; only the Style's body font carries over.
- "Identical to Typora" applies to the languages Folio has a grammar for. Fences in other languages are shown as plain text.
- Diagram syntax is whatever the bundled release of the diagram engine supports. Documents that use newer syntax fall back as described in User Story 3.
- Clipboard access, hover and keyboard focus behave the same on macOS, Windows and Linux. No platform-specific behaviour is required.
- Math typesetting ([009-math-typesetting](../009-math-typesetting/spec.md)) and indented (non-fenced) code blocks are out of scope.
