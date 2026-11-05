# Feature Specification: Print the Current Document View

**Feature Branch**: `main` (unchanged existing checkout)
**Created**: 2026-11-05
**Status**: Implemented, 2026-11-05; native printer qualification remains unverified.

**Input**: User description:
> Can we have single File > Print and print rendered or source based on the current view?
> If we are in source view, we would print the source, if in rendered view we would print that.

This feature supersedes the separate Print/Print Source menu contract of
[013-document-print-export](../013-document-print-export/spec.md).
That completed historical record remains unchanged.
The refinement belongs to the same unreleased `1.1.0` change set.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Print whichever view is active (Priority: P1)

A reader uses one familiar Print action rather than choosing a separate command for source.
Print follows the active document view: formatted content in preview mode and complete literal Markdown in source mode.

**Why this priority**: The requested simplification removes a redundant menu choice and makes printing match what the user is viewing.

**Independent Test**: Use the same Print command in preview, then source, then preview again.
Confirm each output matches that view without changing document mode or losing unsaved edits.

**Acceptance Scenarios**:

1. **Given** preview mode, **When** the user chooses **File > Print** or `Ctrl/Cmd+P`, **Then** the system print dialog targets the complete rendered document.
2. **Given** source mode, **When** the user uses the same command or shortcut, **Then** it targets the complete literal Markdown source, including unsaved edits and lines outside the visible editor area.
3. **Given** the user switches modes, **When** they print again, **Then** the new active view determines the output rather than the mode used for an earlier print.
4. **Given** either mode, **When** the File menu is opened, **Then** it contains one Print action and no Print Source action.
5. **Given** a source selection or rendered selection, **When** printing is prepared or canceled, **Then** the mode, selection, document text, and unsaved state are retained.

---

### User Story 2 - Keep PDF export explicitly rendered (Priority: P2)

A writer in source mode can still export the readable document to PDF without changing views.
Only Print follows the current view; Export to PDF retains its existing rendered-content purpose.

**Why this priority**: Printing must not accidentally change PDF export into a source export.

**Independent Test**: Export from both source and preview modes and confirm both PDFs contain formatted document content with the current edits.

**Acceptance Scenarios**:

1. **Given** source mode with unsaved edits, **When** the user chooses **Export to PDF**, **Then** the PDF contains their rendered document and source mode remains active.
2. **Given** preview mode, **When** the user exports, **Then** the existing full-document, selectable-text PDF behavior is unchanged.

### Edge Cases

- A long source document must print fully despite only some editor lines being visible.
- Rapidly switching views between Print invocations must not reuse a stale output-mode preference.
- Different document windows determine printing from their own current view.
- Dialog cancellation, output errors, temporary-resource cleanup, page size, appearance, and display-zoom behavior remain as defined by feature 013.
- No new output-mode preference or remembered Print Source choice is introduced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: File MUST contain exactly one Print action with the existing `Ctrl/Cmd+P` shortcut and no separate Print Source action.
- **FR-002**: Print MUST choose rendered content in preview mode and complete literal current Markdown in source mode.
- **FR-003**: Each Print invocation MUST use the active view of its owning document window rather than a stale cached mode or another window's view.
- **FR-004**: Print MUST retain feature 013's complete-document output, unsaved-text preservation, unchanged editor state, error/cancellation behavior, and resource cleanup.
- **FR-005**: Export to PDF MUST remain rendered-content export regardless of the current view.
- **FR-006**: Current user documentation MUST explain the single Print action and both view-dependent outcomes without advertising a separate Print Source command.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The File menu contains one Print command and zero Print Source commands.
- **SC-002**: Printing source, preview, and source again produces the correct content type in all three invocations with zero mode changes caused by printing.
- **SC-003**: Source output matches 100% of current Markdown, and source-mode PDF export continues to include formatted content rather than literal markup.
- **SC-004**: Existing full-document export, cancellation, error, and preservation checks continue to pass.

## Assumptions

- This is a refinement of the unreleased `1.1.0` update, not another version increment.
- Print selects the view when the command is handled; it does not add a view-choice dialog.
- PDF export is unchanged because the requested conditional behavior applies specifically to Print.
- Physical-printer and native-platform qualification remain unverified unless explicitly performed and recorded.
