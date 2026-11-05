# Feature Specification: Document Printing and Proper PDF Export

**Feature Branch**: `main` (existing checkout; no feature branch created)

**Created**: 2026-11-05

**Status**: Implemented (retroactive), 2026-11-05; physical-printer and native-platform qualification not run.

**Input**: User description:
> I would expect to see the actual document content to be exported/rendered as PDF, not a PDF screenshot of the Folio app! Is it possible to fix this?
> Also, is it possible to add Print feature? The idea is to print the rendered (or source) content of the document.
> If it is possible, we want to increment the version to 1.1.
> With that, could you actually update the project instruction file to always increment the version number (ask whether it is major version update (breaking change), minor version update (non-breaking feature update) or build (bug fix; no new feature).

**Retroactive Record**: Recorded after implementation on 2026-11-05, as requested by the user.
The implementation is in the local working tree based on `d17083c`, not in a new delivery commit or packaged release.
This feature extends [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) and replaces its application-layout PDF export behavior.
It preserves the styling and appearance contracts of [004-three-axis-theming](../004-three-axis-theming/spec.md),
the rendered math of [009-math-typesetting](../009-math-typesetting/spec.md),
and the diagrams of [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md).
It also supersedes the export-during-redraw limitation recorded in [011-system-appearance](../011-system-appearance/spec.md).
Earlier completed feature records remain unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export the complete rendered document (Priority: P1)

A reader exports a Markdown document to PDF to share or archive its readable content.
The PDF contains the entire document in normal page order, including content below the visible window.
It preserves document styling, links, images, formulas, and diagrams without showing Folio's application controls.

**Why this priority**: The existing export includes application controls and clips the document to its visible area, making the export unsuitable for sharing.

**Independent Test**: Export a long document with numbered paragraphs, a long code block, an image, a formula, and a diagram.
Confirm that its first and last markers and every numbered item appear in the PDF, text can be selected, and no application controls appear.

**Acceptance Scenarios**:

1. **Given** a document longer than the visible window, **When** the user chooses **File > Export to PDF**, **Then** the PDF contains the full document across as many pages as needed, not only its visible portion.
2. **Given** ordinary text, headings, links, lists, and fenced code, **When** the document is exported, **Then** its text remains selectable and searchable, and its content stays in document order.
3. **Given** sidebars, a status bar, find controls, and code-copy buttons are visible in Folio, **When** the document is exported, **Then** none of those controls or the application backdrop appears in the PDF.
4. **Given** unsaved edits in source mode, **When** the user exports, **Then** the PDF includes the current rendered edits without saving the document or changing its editor mode.
5. **Given** a selected style and light or dark appearance, **When** the document is exported, **Then** its document styling and readable colors are retained without changing the selected appearance.
6. **Given** images, formulas, or diagrams still being prepared, **When** the user exports, **Then** output waits for them rather than capturing empty placeholders.

---

### User Story 2 - Print the rendered document (Priority: P1)

A reader wants a paper copy of the formatted document.
They choose **File > Print** or the standard print shortcut and select a printer and settings in the operating system's print dialog.
The printed content is the document, not the Folio window.

**Why this priority**: Printing is the second requested way to use the rendered document outside Folio.
It must use the same content and pagination guarantees as PDF export.

**Independent Test**: Choose **File > Print** for a long rendered document, confirm the system print dialog opens, and print it to an available printer.
Check the first and last markers and the absence of application controls.

**Acceptance Scenarios**:

1. **Given** a document open in either preview or source mode, **When** the user chooses **File > Print** or presses `Ctrl+P` on Windows/Linux or `Cmd+P` on macOS, **Then** the system print dialog opens for its rendered content.
2. **Given** multiple Folio document windows, **When** the user prints from the active document window, **Then** only that window's document is submitted.
3. **Given** a print dialog is open, **When** the user cancels, **Then** no document is submitted and the document's text, unsaved state, editor mode, and selection remain unchanged.
4. **Given** a printer error or a closed output window, **When** printing cannot finish, **Then** Folio reports the failure rather than claiming success.

---

### User Story 3 - Print the complete Markdown source (Priority: P2)

A writer wants a paper copy of the Markdown source, including markup that is hidden in the rendered document.
They choose **File > Print Source**.
The full source is printed as readable, wrapping monospaced text rather than a capture of the editor's visible lines.

**Why this priority**: Source printing supports reviewing the actual document syntax without complicating the normal rendered print action.

**Independent Test**: Print a source document longer than the editor viewport, with Markdown syntax and unsaved edits.
Confirm that the output contains every source line and preserves the literal markup.

**Acceptance Scenarios**:

1. **Given** a long Markdown document, **When** the user chooses **File > Print Source**, **Then** the system print dialog opens for its complete current source, including lines outside the editor viewport.
2. **Given** source containing Markdown or HTML markup, **When** the source is printed, **Then** that markup is printed literally rather than interpreted as document formatting or executable content.
3. **Given** dark appearance or a changed display zoom, **When** source is printed, **Then** it uses readable black monospaced text on white paper and a stable output size.
4. **Given** either preview or source mode is active, **When** source printing completes or is canceled, **Then** the previously active mode and document text remain unchanged.

### Edge Cases

- Long documents, long code blocks, and wrapped source lines must paginate without clipping their final content.
- Dynamic page width uses A4 output; selecting US Letter uses Letter output.
- Display zoom changes the on-screen view but must not enlarge or shrink PDF or printed content.
- Untitled documents and built-in help copies can be exported or printed without being saved first.
- Local image paths are resolved relative to the document, not the output file's temporary location.
- Invalid diagrams retain the existing source-and-error fallback instead of disappearing from output.
- A theme or appearance redraw already in progress must settle before the rendered content is captured.
- A failed image or stylesheet load, or a preparation timeout, must prevent incomplete output and report an error.
- Canceling the PDF destination dialog must not create a PDF or change the document.
- A second print/export preparation for the same document while another is active reports that output is already in progress.
- Different document windows keep their output and preparation responses separate.
- Temporary output resources are removed after success, cancellation, or failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: PDF export MUST contain the entire current rendered document, including content outside the visible window, in document order.
- **FR-002**: Rendered PDF and printed output MUST exclude application menus, sidebars, status bars, find controls, copy buttons, and the application backdrop.
- **FR-003**: Ordinary PDF document text MUST remain selectable and searchable rather than becoming a raster capture of the application.
- **FR-004**: Rendered output MUST preserve the selected document style and effective appearance, including supported images, links, formulas, diagrams, and diagram-error fallbacks.
- **FR-005**: Output MUST use A4 for Dynamic or A4 page width and Letter for US Letter page width, independently of the window size and display zoom.
- **FR-006**: **File > Print** and the standard `Ctrl/Cmd+P` shortcut MUST open the system print dialog for rendered content.
- **FR-007**: **File > Print Source** MUST open the system print dialog for the complete current Markdown source, with literal markup and readable wrapping monospaced text.
- **FR-008**: Printing and export MUST include unsaved edits without saving or reloading the document and MUST preserve its text, unsaved state, editor mode, selection, and display zoom.
- **FR-009**: Rendered output MUST wait for document styling, images, formulas, and diagrams to be ready; failed preparation MUST produce an explicit error instead of incomplete output.
- **FR-010**: Canceling a destination or print dialog MUST not be reported as successful delivery or discard document work; printing failures MUST be reported.
- **FR-011**: Output MUST target the selected document window, keep preparation responses separate between windows, and reject overlapping output preparation for the same document.
- **FR-012**: Opened document content MUST NOT acquire file-system or shell privileges through printing, and temporary output resources MUST be removed after success, cancellation, or failure.
- **FR-013**: This non-breaking feature update MUST set the product version to `1.1.0` and keep the source manifests and current-version guide examples consistent.
- **FR-014**: Project instructions MUST require one version increment per change set and ask the user to select Major (breaking), Minor (non-breaking feature), or Build/patch (bug fix without a new feature), unless the category or target version was already specified.

### Key Entities

- **Current document**: The complete in-memory Markdown text associated with one Folio window, including unsaved edits and its source asset location.
- **Rendered output**: A document-only representation with current styling and completed visual content, used for both PDF export and rendered printing.
- **Source output**: The complete literal current Markdown text, independently printable without changing the editor mode.
- **Output operation**: One document's export or print request, its destination or printer settings, completion/cancellation/failure outcome, and temporary resources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Exporting the long acceptance document includes 100% of its 70 numbered paragraphs and 110 numbered code lines, its first and last markers, and its unsaved edit across more than two PDF pages.
- **SC-002**: All nine built-in Style/Page Width combinations produce a correctly sized A4 or Letter PDF with selectable text and zero application controls.
- **SC-003**: Rendered output includes at least one local image, one formula, and one completed diagram from the acceptance document, with no empty placeholders.
- **SC-004**: Source output matches 100% of the current Markdown text, including literal markup and content outside the editor viewport.
- **SC-005**: Across export and both print actions, source and preview modes retain the same document text and mode; source export also retains selection, focus, unsaved state, and display zoom.
- **SC-006**: Both print actions open a system print dialog, and cancellation, printer failure, and output-window closure have distinct outcomes without losing document work.
- **SC-007**: The product version is `1.1.0` in all three source manifest version fields, and the project instructions define all three version categories with one increment per change set.

## Assumptions

- Printing uses the operating system's existing printer support; installing or configuring printers is outside this feature.
- The native print dialog may override the initial paper choice using options supported by the chosen printer.
- Existing Markdown rendering, supported diagram syntax, font substitution, and external-image availability remain unchanged.
- PDF export remains a rendered-content action; a separate source-to-PDF export menu, batch printing, printer presets, and an in-app print-preview editor are out of scope.
- Local content and bundled rendering assets work offline; externally hosted document images still require access to their source.
- Version `1.1` means npm-compatible `1.1.0`; retrospective documentation belongs to this same change set and does not trigger a second increment.
- Completion refers to the local implementation and recorded verification, not a published package, a physical printout, or native macOS/Linux dialog qualification.
