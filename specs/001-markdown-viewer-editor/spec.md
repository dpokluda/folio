# Feature Specification: Themed Markdown Viewer & Source Editor

**Feature Branch**: `001-markdown-viewer-editor`

**Created**: 2026-07-09

**Status**: Implemented (retroactive)

**Input**: User description: "Build Folio, a lightweight desktop Markdown viewer with light editing that complements Typora on machines where I have no Typora license. Opening a .md file shows it rendered as a themed, paged 'sheet' styled by unmodified Typora CSS themes, and I can flip into a themed source editor and back. Support GitHub-flavored Markdown (tables, task lists, footnotes, emoji, autolinks, typographic replacements), New/Open/Open Recent/Save/Save As with an unsaved-changes indicator and prompts, Export to PDF, a headings outline sidebar, zoom, a Typora-style status bar with word, character and line counts and reading time, and a Welcome document on launch with the bundled documents available from the Help menu. Documents can come from anywhere, so rendering them must be safe, and if the file changes on disk the view should refresh without losing my unsaved edits."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `bd8f5ef` (2026-07-09) with same-day follow-ups `578e52e`, `ec3e6f4` and `9c3abe5`; then `946b5a4` and `6bf8c90` (2026-07-13; relative-asset part only), `abc8522` and `8062af5` (2026-07-14; sanitization, navigation hardening, save-guard and live-reload parts only), `664668d` (2026-08-06) and `5c3ee89` (2026-08-20; text-rendering part only); related specs: [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md), [003-command-line-launch](../003-command-line-launch/spec.md), [004-three-axis-theming](../004-three-axis-theming/spec.md) (supersedes this feature's single-file theme list), [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md), [006-find-in-document-and-files](../006-find-in-document-and-files/spec.md), [007-multiple-windows](../007-multiple-windows/spec.md), [008-source-editing-tools](../008-source-editing-tools/spec.md), [009-math-typesetting](../009-math-typesetting/spec.md), [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md), [011-system-appearance](../011-system-appearance/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read any Markdown file as a themed, paged sheet (Priority: P1)

A Typora user on a machine without a Typora license opens a Markdown file and sees it the way their
Typora theme presents it: a page ("sheet") whose typography, colors, width and backdrop come from an
unmodified Typora theme. Folio greets them with a Welcome document at launch, remembers recently
opened files, and offers its bundled guides from the Help menu.

**Why this priority**: Viewing is the product's core promise ("the themes I already use just work").
Without a faithful rendered page nothing else matters, and a read-only viewer is already useful on
its own.

**Independent Test**: Launch Folio, open the bundled Markdown Formatting Tour and a Markdown file of
your own, and confirm that every construct renders on a themed page. No editing is needed.

**Acceptance Scenarios**:

1. **Given** Folio is launched without a document to open, **When** the window appears, **Then** the bundled Welcome document is shown as a rendered, themed page and the title bar reads "Welcome - Folio".
2. **Given** Folio is running, **When** the user chooses File > Open… (`Ctrl/Cmd+O`) and picks a Markdown file, **Then** the file is rendered as a themed page, the title bar shows its file name, and it becomes the first entry of File > Open Recent.
3. **Given** a document containing a table, a task list, a footnote, emoji shortcodes such as `:rocket:`, a bare `https://` address, `~~strikethrough~~`, straight quotes and `--`, **When** it is displayed, **Then** it shows a formatted table, checkboxes, a footnote reference with its footnote section, emoji, a clickable link, struck-through text, and typographic quotes and dashes.
4. **Given** a document that starts with a `---` … `---` front matter block, **When** it is displayed, **Then** the metadata appears verbatim in a subtle monospace box above the content instead of becoming a giant heading.
5. **Given** a document that references `images/diagram.png` relative to its own folder, **When** it is displayed, **Then** the image loads from that folder.
6. **Given** a fenced code block tagged with a recognized language, **When** it is displayed, **Then** the code appears inside the theme's code-block frame with syntax coloring.
7. **Given** any document is open, **When** the user chooses Help > Markdown Formatting Tour or Help > Welcome, **Then** that bundled guide is shown as an untitled document named after the guide.
8. **Given** File > Open Recent lists earlier files, **When** the user chooses Clear Recent, **Then** the submenu shows only a disabled "(No recent files)" entry.
9. **Given** Folio is running, **When** the user chooses Help > About Folio, **Then** a dialog shows the app version and the statement that Folio is not affiliated with, endorsed by, or sponsored by the Typora team.
10. **Given** the user resized the window and quit, **When** Folio starts again, **Then** the window opens at the remembered size.

---

### User Story 2 - Flip into a themed source editor and save edits without losing work (Priority: P2)

The user makes light edits. One keystroke, or a status-bar button, swaps the rendered page for a
source editor that the same Typora theme styles, and the same keystroke swaps back to the
re-rendered page. Unsaved changes are always visible in the title bar, and the file commands never
quietly throw them away.

**Why this priority**: Light editing is the second half of "view and lightly edit". It needs the
viewer (US1) only for the page it toggles back to, and it is where work can be lost, so the
unsaved-changes guard ships with it.

**Independent Test**: Open a scratch Markdown file, switch to source mode, edit, watch the unsaved
marker, then exercise Save, Save As, New, and closing the window with each answer of the save prompt.

**Acceptance Scenarios**:

1. **Given** a rendered document, **When** the user presses `Ctrl/Cmd+/`, chooses View > Toggle Source Code Mode, or clicks the status bar's `</> Source` button, **Then** a theme-styled source editor replaces the page, shows the document's Markdown with the caret in it, and the button now reads "Exit Source".
2. **Given** the user has edited text in the source editor, **When** they leave source mode, **Then** the page is re-rendered from the edited text.
3. **Given** a document with no unsaved changes, **When** the user types in the source editor, **Then** the title bar gains a leading "•"; **When** they undo back to the last saved text, **Then** the "•" disappears.
4. **Given** unsaved edits to a file on disk, **When** the user presses `Ctrl/Cmd+S`, **Then** the file is overwritten with the edited text and the "•" disappears.
5. **Given** an untitled document (File > New, the Welcome document, or the Markdown Formatting Tour), **When** the user saves, **Then** a Save As dialog opens suggesting `<document name>.md`; after saving, the title shows the new file name, the file joins Open Recent, and the bundled guide is unchanged.
6. **Given** unsaved edits, **When** the user chooses File > New, File > Open…, a Help guide, or File > Reload from Disk, closes the window, or quits, **Then** Folio asks "Do you want to save the changes you made?" with Save, Don't Save and Cancel, and Cancel leaves the document, the edits and the window as they were.
7. **Given** that prompt is answered with Save but the save fails or its Save As dialog is cancelled, **When** the prompt closes, **Then** the pending action does not happen and the edits remain.
8. **Given** the user quit Folio while the source editor was showing, **When** Folio starts again, **Then** it opens in source mode.

---

### User Story 3 - Open documents from anywhere without putting the machine at risk (Priority: P3)

Markdown files arrive from colleagues, downloads and exports, and they can embed raw HTML and links.
The user opens them without worrying that a document can run code, open windows, or replace Folio's
interface. Web links still work, in the system browser.

**Why this priority**: Every document is untrusted input. The protection is invisible when it works,
so it ranks after the visible viewing and editing journeys, but a build that renders arbitrary files
must not ship without it.

**Independent Test**: Open a test document that contains a script element, an image with an error
handler, script-bearing links and ordinary web links; confirm that nothing executes, the rest of the
document renders, and web links open in the default browser.

**Acceptance Scenarios**:

1. **Given** a document containing `<script>` elements, attributes such as `onerror=` or `onclick=`, or `javascript:` links, **When** it is displayed and its links are clicked, **Then** none of that code runs and the rest of the document renders normally.
2. **Given** a document that uses harmless inline HTML such as `<u>underlined</u>` or `<kbd>Ctrl</kbd>`, **When** it is displayed, **Then** the formatting appears.
3. **Given** a link to an `http://` or `https://` address, **When** the user clicks it, **Then** the address opens in the system's default browser and the Folio window keeps showing the document.
4. **Given** document content that tries to open a new window or to move the window to a web address, **When** that happens, **Then** no new window appears and the window stays on the document; web addresses are handed to the system browser instead.

---

### User Story 4 - See external changes without losing unsaved edits (Priority: P4)

The user keeps a document open in Folio while another tool (a script, a sync client, another editor)
changes the file. A clean view refreshes by itself, in place. If the user has unsaved edits, Folio
asks before replacing them and defaults to keeping them. A manual Reload from Disk is one keystroke
away.

**Why this priority**: It keeps the viewer trustworthy next to other tools, but Folio is already
useful without it.

**Independent Test**: Open a file, change it from a terminal and watch the page refresh; repeat with
unsaved edits and try both answers of the prompt; then use File > Reload from Disk.

**Acceptance Scenarios**:

1. **Given** a file is open with no unsaved edits, **When** another program saves a change to it, **Then** Folio shows the new content within about two seconds, without a prompt, keeping the reading position.
2. **Given** a file is open with unsaved edits, **When** another program changes it, **Then** Folio asks whether to "Reload" or "Keep My Changes", with Keep My Changes as the default; Keep leaves the edits untouched, and Reload replaces them with the file's new content.
3. **Given** Folio itself saves the open file, **When** the save completes, **Then** Folio does not treat its own write as an external change.
4. **Given** a document backed by a file, **When** the user chooses File > Reload from Disk (`Ctrl/Cmd+R`), **Then** the file is read again in place, after the save prompt if there are unsaved edits; for an untitled document the command is disabled.
5. **Given** another tool saves by replacing the file, or the file is briefly missing, **When** that happens, **Then** the view is not cleared, and it refreshes once the file has new content.

---

### User Story 5 - Find your way around and size up a document (Priority: P5)

As in Typora, a headings outline lets the user jump around long documents, a status bar shows live
word, character and line counts with an estimated reading time, and the whole view can be zoomed for
comfortable reading.

**Why this priority**: These Typora conventions make long documents pleasant, but each one improves
on plain reading rather than enabling it.

**Independent Test**: Open the Markdown Formatting Tour, show the outline and jump to a heading,
compare the status-bar numbers with the source, zoom in, out and back, then relaunch and confirm the
zoom level was kept.

**Acceptance Scenarios**:

1. **Given** a document with headings, **When** the user chooses View > Toggle Outline (`Ctrl/Cmd+Alt+O`) or clicks the status bar's Outline button, **Then** a sidebar lists every heading indented by level and the Outline button shows as active; clicking an entry scrolls the page smoothly to that heading.
2. **Given** any document, **When** it is shown or edited, **Then** the status bar reads "N words · N chars · N lines · ~N min read", using singular labels for 1 and updating as the user types.
3. **Given** any view, **When** the user zooms in (`Ctrl/Cmd++`), zooms out (`Ctrl/Cmd+-`) or resets (`Ctrl/Cmd+0`), or uses the same commands in the View menu, **Then** the whole window content scales in 10% steps between 50% and 250%, the status bar stays at the bottom of the window, and the level is restored at the next launch.
4. **Given** Windows or Linux, **When** the user presses `Ctrl+=`, `Ctrl++`, `Ctrl+-` or `Ctrl+0` on the main keyboard or the numeric keypad, even while the source editor has focus, **Then** the matching zoom command runs.

---

### User Story 6 - Export a document to PDF (Priority: P6)

To share a document with someone who does not use Markdown, the user exports the rendered, themed page
to a PDF whose paper size follows the theme's page width.

**Why this priority**: Useful for sharing, but not needed for viewing or editing.

**Independent Test**: Export the Markdown Formatting Tour once with an A4 page width and once with
US Letter, then open both PDFs and check the paper size and content.

**Acceptance Scenarios**:

1. **Given** a rendered document, **When** the user chooses File > Export to PDF… and accepts the suggested name (the document's name with a `.pdf` extension, next to the file when it has one), **Then** a PDF of the rendered page, including the theme's backgrounds, is written there.
2. **Given** the US Letter page width is active, **When** the user exports, **Then** the PDF uses US Letter paper; with any other page width it uses A4.
3. **Given** the source editor is showing, **When** the user exports, **Then** Folio first switches to the rendered page, so the PDF contains the rendered document and not the Markdown source.
4. **Given** the export dialog is open, **When** the user cancels it, **Then** no file is written.

---

### Edge Cases

- A file that cannot be read (missing, no permission), including an Open Recent entry whose file has moved, produces an error naming the file and the reason. The current document stays open, and the stale entry remains in the list until Clear Recent.
- Choosing a file from File > Open Recent while there are unsaved edits replaces the document without the save prompt. This is a known gap in the shipped behavior; see research.md → Retroactive findings.
- Saving to a read-only or otherwise unwritable location shows an error naming the file, and the document stays marked as unsaved. If the current text cannot be obtained within 4 seconds, nothing is written and the save counts as failed, so a pending close or replace is cancelled.
- An untitled document has no folder, so relative image references in it do not resolve until it is saved; after Save As they resolve against the new folder.
- File > New while the rendered page is showing displays an empty page; the user switches to source mode to start typing.
- Front matter is recognized only at the very start of a document (an optional byte-order mark is allowed). A `---` block anywhere else is ordinary Markdown.
- Statistics count the Markdown text, including markup characters and front matter, not the rendered words. An empty document shows 0 words, 0 chars, 0 lines and "~1 min read".
- Clicking a task-list checkbox on the rendered page changes only the on-screen tick; the document text is not modified.
- While the source editor is showing, the outline keeps the headings of the last rendered page; it refreshes when the user returns to the rendered page.
- Zooming beyond 250% or below 50% has no further effect; Reset Zoom returns to 100%.
- If the open file is deleted, its last content stays on screen and nothing reloads. Reload from Disk then reports that the file cannot be read.
- Images load from the local disk, from data embedded in the document, or from `https://` addresses. Images on plain `http://` addresses do not load.
- Exporting while there are unsaved edits exports what is on screen, including the edits, without saving them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Folio MUST render a Markdown document into a page that an unmodified Typora theme styles exactly as it styles Typora's own page (typography, colors, page width and backdrop), by following the page structure and naming conventions that Typora themes target.
- **FR-002**: Folio MUST render standard Markdown plus GitHub-flavored tables, strikethrough, task-list checkboxes, footnotes, emoji shortcodes and automatic links for bare web addresses, and MUST apply typographic replacements (curly quotes, en and em dashes, ellipses). A single line break inside a paragraph MUST NOT become a hard break.
- **FR-003**: Fenced code blocks MUST appear inside the theme's code-block frame; blocks tagged with a recognized language MUST be syntax-colored, and other blocks MUST be shown as plain, escaped text. Typora-identical code coloring is specified by 010.
- **FR-004**: A front matter block at the very start of a document (a `---` line, the metadata, and a closing `---` line, optionally preceded by a byte-order mark) MUST be shown verbatim, as literal text, in a subtle monospace box above the content, and MUST NOT be interpreted as Markdown or HTML.
- **FR-005**: Relative image references MUST resolve against the folder of the open document. References that already name a scheme (such as `https:`, `file:` or `data:`), references starting with `//`, and in-page anchors (`#…`) MUST be left unchanged.
- **FR-006**: The area around the page MUST be painted with the active theme's page-background color (white when the theme defines none), so themes that place the page on a tinted backdrop look as they do in Typora.
- **FR-007**: Text MUST be drawn with grayscale, not colored subpixel, antialiasing on every platform, so glyph weight matches Typora's rendering of the same theme.
- **FR-008**: When launched with no document to open, Folio MUST show the bundled Welcome document, a short getting-started guide, as an untitled document named "Welcome". If the bundled copy cannot be read, Folio MUST show a minimal built-in welcome message instead.
- **FR-009**: The Help menu MUST offer "Welcome" and "Markdown Formatting Tour", which open the bundled guides as untitled documents with those names; the tour MUST demonstrate the supported Markdown constructs. Because the guides are untitled, saving one MUST always ask for a new location, so the shipped copies are never overwritten.
- **FR-010**: File > Open… (`Ctrl/Cmd+O`) MUST let the user pick one file, offering a Markdown filter (`.md`, `.markdown`, `.mdown`, `.mkd`, `.txt`) and an all-files filter, and MUST display the file as UTF-8 text.
- **FR-011**: Folio MUST keep a list of the 10 most recently opened or saved files, newest first and without duplicates, persisted across launches. File > Open Recent MUST list them by file name, open the chosen file, offer Clear Recent, and show a disabled "(No recent files)" item when the list is empty.
- **FR-012**: If a file cannot be opened, Folio MUST show an error naming the file and the reason, and MUST keep the current document unchanged.
- **FR-013**: The window title MUST read `<name> - Folio`, where `<name>` is the file name, or "Untitled", "Welcome" or "Markdown Formatting Tour" for an untitled document, prefixed with "• " while the document has unsaved changes.
- **FR-014**: Help > About Folio MUST show the app version, a one-line description, and the non-affiliation disclaimer (Folio is not affiliated with, endorsed by, or sponsored by the Typora team).
- **FR-015**: Folio MUST remember the window size between launches (1100 × 820 at first launch, never smaller than 640 × 480).
- **FR-016**: `Ctrl/Cmd+/`, View > Toggle Source Code Mode, and the status bar's Source button MUST switch between the rendered page and a source editor that follows Typora's source-mode conventions, so the active Typora theme's source-mode rules (including its source-mode background) style it. The button MUST read "Source" on the rendered page and "Exit Source" in the source editor, and MUST show as active in source mode.
- **FR-017**: The source editor MUST show the document's Markdown with Markdown syntax coloring and soft-wrapped lines, and MUST support undo and redo, bracket matching, highlighting of other occurrences of the selected text, and Tab to indent. Entering source mode MUST place keyboard focus in the editor.
- **FR-018**: Leaving source mode MUST re-render the page from the editor's current text. Switching modes MUST NOT save anything.
- **FR-019**: Folio MUST remember whether the source editor was showing and restore that mode at the next launch.
- **FR-020**: A document MUST count as having unsaved changes exactly when its current text differs from the text it had when last opened, reloaded or saved; undoing back to that text clears the state.
- **FR-021**: File > New (`Ctrl/Cmd+N`) MUST replace the current document with an empty untitled document named "Untitled".
- **FR-022**: File > Save (`Ctrl/Cmd+S`) MUST write the current text as UTF-8 to the document's file and clear the unsaved state; for an untitled document it MUST behave like Save As.
- **FR-023**: File > Save As… (`Ctrl/Cmd+Shift+S`) MUST ask for a location, suggesting the current file or `<name>.md` for an untitled document and offering a Markdown (`.md`, `.markdown`) and an all-files filter. After writing, that file MUST become the current document: title, recent list, and the folder used for relative images.
- **FR-024**: Before File > New, File > Open…, a Help guide, File > Reload from Disk, closing the window, or quitting replaces or discards a document with unsaved changes, Folio MUST ask "Do you want to save the changes you made?" with Save (the default), Don't Save and Cancel. Cancel MUST leave everything unchanged, and Save MUST let the action proceed only if the save succeeded.
- **FR-025**: If a save fails, Folio MUST show an error naming the file and the reason, and MUST keep the document marked as unsaved.
- **FR-026**: Folio MUST treat every document as untrusted: raw HTML in a document MUST be displayed only after scripts, event-handler attributes, script-bearing links and other executable content have been removed, while ordinary formatting markup still displays.
- **FR-027**: The window MUST NOT run any script other than Folio's own, whether inline or remote.
- **FR-028**: Clicking an `http://` or `https://` link MUST open it in the system's default browser while the window keeps showing the document. No other kind of address may be handed to the system browser.
- **FR-029**: Document content MUST NOT be able to open new windows or navigate the window away from Folio's interface. Such attempts MUST be refused, and an `http(s)` target MUST be handed to the system browser instead.
- **FR-030**: Images MAY come from the local disk, from data embedded in the document, or from `https://` addresses; images from any other remote source, such as plain `http://`, MUST be blocked.
- **FR-031**: While a document backed by a file is open, Folio MUST notice changes that other programs make to that file, checking about once per second, including saves that replace the file instead of rewriting it. Folio's own saves MUST NOT count as external changes.
- **FR-032**: When an external change is detected and the document has no unsaved changes, Folio MUST reload it in place without asking and keep the reading position: proportionally on the rendered page, and at the same scroll offset in the source editor.
- **FR-033**: When an external change is detected and the document has unsaved changes, Folio MUST ask, naming the file, whether to "Reload" or "Keep My Changes", with Keep My Changes as both the default and the dismiss action.
- **FR-034**: File > Reload from Disk (`Ctrl/Cmd+R`) MUST re-read the open file in place, keeping the reading position and going through the save prompt when there are unsaved changes. It MUST be disabled when the document has no file.
- **FR-035**: A temporarily missing file MUST NOT clear or replace the view; reloading resumes once the file has new content. Reloads MUST NOT change the recent-files list.
- **FR-036**: View > Toggle Outline (`Ctrl/Cmd+Alt+O`) and the status bar's Outline button MUST show or hide a sidebar that lists the rendered document's headings (levels 1–6) indented by level. Clicking an entry MUST scroll the page smoothly to that heading. The outline starts hidden when a window opens (startup layout is defined by 003).
- **FR-037**: A status bar along the bottom of the window MUST hold the Outline and Source toggle buttons, each showing whether its mode is active, and live document statistics formatted as "N words · N chars · N lines · ~N min read", with singular labels for 1 and locale-appropriate digit grouping.
- **FR-038**: Statistics MUST be computed from the document's Markdown text: words are runs of non-whitespace characters; characters are all characters, including spaces and line breaks; lines are the number of lines (0 for an empty document); reading time is words ÷ 200, rounded, and at least 1 minute. They MUST update when a document loads, on every edit, and when the mode changes.
- **FR-039**: View > Zoom In, Zoom Out and Reset Zoom (`Ctrl/Cmd++`, `Ctrl/Cmd+-`, `Ctrl/Cmd+0`) MUST scale the whole window content (page, editor, sidebar and status bar) in 10% steps from 50% to 250%, with Reset returning to 100%. The layout MUST fill the window, with the status bar visible, at every level.
- **FR-040**: On Windows and Linux the zoom shortcuts MUST also accept `Ctrl+=`, `Ctrl+Shift+=`, the numeric keypad's `+`, `-` and `0`, and layouts where `+` sits on another key, including while the source editor has focus.
- **FR-041**: The zoom level MUST be remembered across launches.
- **FR-042**: File > Export to PDF… MUST save the rendered page, including the theme's backgrounds, as a PDF at a location the user chooses, suggesting the document's path with a `.pdf` extension (or `<name>.pdf` for an untitled document). Cancelling MUST write nothing, and a failure MUST show an error.
- **FR-043**: The PDF's paper size MUST be US Letter when the active page width is US Letter, and A4 otherwise.
- **FR-044**: If the source editor is showing when the user exports, Folio MUST switch to the rendered page first, so the PDF always shows the rendered document, including unsaved edits.

### Key Entities *(include if feature involves data)*

- **Document**: The Markdown text shown in a window. It is either backed by a file (it has a path, and that file's folder is used to resolve relative images) or untitled (it has only a display name: "Untitled", "Welcome" or "Markdown Formatting Tour"). It carries the text as last opened, reloaded or saved, and its unsaved-changes state is derived by comparing that text with the current text.
- **Bundled guide**: A document shipped with Folio (Welcome, Markdown Formatting Tour). It is always opened as an untitled copy, so the original is never modified.
- **Recent files list**: Up to 10 absolute file paths, most recent first, without duplicates, persisted across launches.
- **View preferences**: Whether the source editor is showing (restored at launch), the zoom level (a step from −5 to +15 around 100%, restored at launch), and the window size (restored at launch). Outline visibility is also remembered, but a new window always starts with the outline hidden.
- **Document statistics**: Words, characters, lines and estimated reading minutes, derived from the document's Markdown text.
- **Front matter**: The optional metadata block at the very start of a document, displayed verbatim and never rendered as Markdown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every bundled theme, the Markdown Formatting Tour renders with every construct styled by the theme (no unstyled or raw-Markdown fragments), and the same theme styles the source editor, without any Folio-specific change to the theme's rules.
- **SC-002**: From launch, a user can be reading any local Markdown file in 3 interactions or fewer (open command, choose the file, confirm), and a recently used file in 2 (Open Recent, choose the file).
- **SC-003**: Switching between the rendered page and the source editor takes a single keystroke or click in either direction and never alters the document text (100% round-trip fidelity).
- **SC-004**: In every guarded flow (New, Open…, Help guides, Reload from Disk, closing the window, quitting), unsaved edits are discarded only after an explicit "Don't Save": 0 silent losses across repeated trials, including trials where the save itself fails.
- **SC-005**: With no unsaved edits, an external change to the open file is visible within 2 seconds with the reading position kept; with unsaved edits, 0 edits are lost unless the user chooses "Reload".
- **SC-006**: Across a test document set covering script elements, event-handler attributes, script-bearing links and attempts to open windows or leave the page, 0 pieces of document-supplied code execute and 0 new windows open, while 100% of `http(s)` links open in the system browser.
- **SC-007**: The status bar's word and line counts match an independent count of the Markdown text (whitespace-separated words; lines as numbered in the source editor) exactly, and refresh on every keystroke.
- **SC-008**: Zoom offers 21 levels (50% to 250% in 10% steps); at every level the status bar is fully visible with no dead space below it, and the chosen level is restored after a restart.
- **SC-009**: In 100% of exports the PDF uses the expected paper size (A4 or US Letter) and shows the rendered page, never the Markdown source.
- **SC-010**: Every image that a document references by a relative path, and that exists relative to the document's folder, appears on the rendered page.

## Assumptions

- Folio complements Typora: the rendered page is read-only and all editing happens in the source editor (constitution Principle II). Turning the page into a WYSIWYG editor is out of scope.
- This spec describes a single window. Multiple independent windows, each with its own document, unsaved state and file watching, are specified by 007; every behavior here applies per window.
- When this feature shipped, the Themes menu listed a flat set of bundled Fluent and Microsoft Word theme files, one of them active, and the PDF paper size followed that theme's name. That selection model was superseded by 004 (Style × Appearance × Page width). This spec relies on 004 for choosing a theme and on its Page width for the PDF paper size. Dark variants of the screen elements introduced here arrived with 004's Appearance axis, and following the OS light/dark setting is 011.
- Out of scope and specified elsewhere: packaging, app identity and file associations (002); opening files or folders from the command line or the operating system (003); folder mode, the Files button in the status bar, and links between documents, including non-web links such as `mailto:` (005); Find and Find in Files (006); multiple windows (007); the Format menu, line numbers and Copy File Path (008); math (009); diagrams, code copy buttons and Typora-identical code coloring (010); following the OS appearance (011).
- Documents are UTF-8 text files. Folio needs no network access, except to display `https://` images that a document references.
- Keyboard shortcuts use Cmd on macOS and Ctrl on Windows and Linux; otherwise behavior is the same on all three platforms, including grayscale text rendering.
- Statistics deliberately count the Markdown text as a quick indicator; they are not a rendered-word count.
- The bundled Welcome document and Markdown Formatting Tour evolve with the app; for example, the tour gains diagram examples in 010.
