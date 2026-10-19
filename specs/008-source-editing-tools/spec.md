# Feature Specification: Source Formatting Commands, Line Numbers & Copy File Path

**Feature Branch**: `008-source-editing-tools`

**Created**: 2026-07-16

**Status**: Implemented (retroactive)

**Input**: User description: "Make light editing in source mode quicker. Add a Format menu with keyboard shortcuts for bold, italic, underline, strikethrough, inline code, code block, link, inline math, math block and headings 1 to 6: wrap the selection, or insert the marks with the caret between them when nothing is selected, and toggle the formatting off when it is applied again. Add an optional line-number gutter to the source editor (off by default, remembered), and a File > Copy File Path command that copies the open document's full path with a short confirmation."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `68e67be` (2026-07-16), which also added TeX math rendering (documented in [009-math-typesetting](../009-math-typesetting/spec.md)) and new icon artwork ([002-cross-platform-packaging](../002-cross-platform-packaging/spec.md)); both are out of scope here. The behavior below is unchanged in the code as of 2026-10-18. Related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (source mode, outline, Welcome document), [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md) (file explorer, whose shortcut this feature moves), [007-multiple-windows](../007-multiple-windows/spec.md) (per-window documents; its later Window menu keeps Cmd+M free for Inline Math), [009-math-typesetting](../009-math-typesetting/spec.md) (renders the TeX that Inline Math and Math Block insert), [004-three-axis-theming](../004-three-axis-theming/spec.md) and [006-find-in-document-and-files](../006-find-in-document-and-files/spec.md) (unchanged by this feature).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply inline formatting from the keyboard or the Format menu (Priority: P1)

A writer editing a document in source mode selects a word or phrase and presses Ctrl/Cmd+B, or chooses Format > Bold, to make it bold without typing the Markdown marks by hand. Italic (`*…*`), Underline (`<u>…</u>`), Strikethrough (`~~…~~`), Inline Code (`` `…` ``) and Inline Math (`$…$`) work the same way. When nothing is selected, the empty pair of marks is inserted with the caret between them so the writer can keep typing. Applying the same command to text that is already formatted removes the marks again.

**Why this priority**: Inline emphasis is the most frequent light edit. It is the smallest slice that makes source-mode editing quicker on its own, and it introduces the Format menu, the shortcut handling and the "switch to source mode" hint that every other formatting command reuses.

**Independent Test**: Open any saved Markdown file, switch to source mode, select a word and press each of the six inline shortcuts twice. Each first press adds the marks around the still-selected word and each second press removes them; with an empty selection the caret lands between the inserted marks.

**Acceptance Scenarios**:

1. **Given** source mode with the word `word` selected, **When** the user presses Ctrl/Cmd+B, **Then** the text becomes `**word**` and `word` is still selected.
2. **Given** the text `**word**` with either `word` or the whole `**word**` selected, **When** the user presses Ctrl/Cmd+B, **Then** the marks are removed and `word` is selected.
3. **Given** source mode with nothing selected, **When** the user presses Ctrl/Cmd+U, **Then** `<u></u>` is inserted with the caret between `<u>` and `</u>`.
4. **Given** selected text in source mode, **When** the user presses Ctrl/Cmd+I, Ctrl/Cmd+Shift+X, Ctrl/Cmd+E or Ctrl/Cmd+M (or picks Italic, Strikethrough, Inline Code or Inline Math from the Format menu), **Then** the selection is wrapped in `*…*`, `~~…~~`, `` `…` `` or `$…$` respectively.
5. **Given** source mode, **When** the user picks a command from the Format menu with the mouse, **Then** the formatting is applied and keyboard focus returns to the editor so typing can continue immediately.
6. **Given** the rendered view is showing, **When** the user picks any command from the Format menu, **Then** the document is not changed and a brief hint "Switch to Source mode (Ctrl/Cmd+/) to format text" appears.
7. **Given** a saved document in source mode, **When** a formatting command changes it, **Then** the title bar shows the unsaved-changes marker `•`, and pressing Ctrl/Cmd+Z reverts the formatting.

---

### User Story 2 - Turn lines into headings and back (Priority: P2)

Ctrl/Cmd+1 … Ctrl/Cmd+6, or Format > Heading 1 … Heading 6, sets the line holding the caret, or every line touched by the selection, to that heading level. Existing heading marks are replaced rather than stacked, and choosing the level a line already has turns it back into a plain line.

**Why this priority**: Headings give a document its structure and feed the outline, and counting `#` marks by hand is error-prone. The command builds on the Format menu from User Story 1 but is useful on its own.

**Independent Test**: In source mode, put the caret on a plain line and press Ctrl/Cmd+2, then Ctrl/Cmd+3, then Ctrl/Cmd+3 again. The line reads `## …`, then `### …`, then plain text again.

**Acceptance Scenarios**:

1. **Given** the caret on the plain line `Introduction`, **When** the user presses Ctrl/Cmd+2, **Then** the line becomes `## Introduction`.
2. **Given** the line `## Introduction`, **When** the user presses Ctrl/Cmd+3, **Then** the line becomes `### Introduction` (the level is replaced, not added to).
3. **Given** the line `### Introduction`, **When** the user presses Ctrl/Cmd+3, **Then** the line becomes `Introduction`.
4. **Given** a selection spanning three plain lines, **When** the user presses Ctrl/Cmd+1, **Then** all three lines become level-1 headings.
5. **Given** the rendered view is showing, **When** the user picks Format > Heading 2, **Then** nothing in the document changes and the "Switch to Source mode" hint appears.

---

### User Story 3 - Insert links, code blocks and math blocks (Priority: P3)

Ctrl/Cmd+K turns the selected text into the text of a Markdown link and leaves the caret where the address goes; with nothing selected it inserts an empty `[]()` with the caret inside the brackets. Ctrl/Cmd+Shift+E and Ctrl/Cmd+Shift+M put a fenced code block (```` ``` ````) or a display-math block (`$$`) on their own lines around the selection, or create an empty block with the caret on its body line. Because Ctrl/Cmd+Shift+E used to toggle the file explorer, the file explorer and outline toggles move to Ctrl/Cmd+Alt+E and Ctrl/Cmd+Alt+O.

**Why this priority**: These commands are used less often than inline marks and headings, but they save the most typing (brackets, parentheses, fence lines) and are where caret placement matters most.

**Independent Test**: In source mode, select a word and press Ctrl/Cmd+K, then type an address; on an empty line press Ctrl/Cmd+Shift+E and type code; select a formula line and press Ctrl/Cmd+Shift+M. Then press Ctrl/Cmd+Alt+E and Ctrl/Cmd+Alt+O and confirm they toggle the file explorer (with a folder open) and the outline.

**Acceptance Scenarios**:

1. **Given** `Folio` is selected, **When** the user presses Ctrl/Cmd+K, **Then** the text becomes `[Folio]()` with the caret between `(` and `)`.
2. **Given** nothing is selected, **When** the user presses Ctrl/Cmd+K, **Then** `[]()` is inserted with the caret between `[` and `]`.
3. **Given** the caret at the end of a line of text, **When** the user presses Ctrl/Cmd+Shift+E, **Then** three new lines follow that text: an opening ```` ``` ```` fence, an empty body line holding the caret, and a closing ```` ``` ```` fence.
4. **Given** the whole line `E = mc^2` is selected from its first character, **When** the user presses Ctrl/Cmd+Shift+M, **Then** the line is enclosed by a `$$` line above and a `$$` line below and remains selected.
5. **Given** source mode with a folder open, **When** the user presses Ctrl/Cmd+Shift+E, **Then** a code block is inserted and the file explorer does not toggle; **When** the user presses Ctrl/Cmd+Alt+E (Cmd+Option+E on macOS), **Then** the file explorer toggles; **When** the user presses Ctrl/Cmd+Alt+O, **Then** the outline toggles.
6. **Given** a link or block was just inserted, **When** the user applies the same command again, **Then** another link or block is inserted (these three commands always insert; they do not toggle).

---

### User Story 4 - Show line numbers in the source editor (Priority: P4)

View > Show Line Numbers toggles a muted gutter of line numbers beside the source editor. It is off by default, takes effect immediately, shows a check mark while on, and is remembered between launches.

**Why this priority**: Line numbers help when a position has to be found or quoted (a review comment, an error message), but many users never need them. The setting is independent of the formatting commands.

**Independent Test**: With fresh settings, enter source mode and confirm no gutter. Turn View > Show Line Numbers on: numbers appear at once while the caret and undo history stay intact. Quit and relaunch: the numbers are still shown. Turn the setting off: they disappear.

**Acceptance Scenarios**:

1. **Given** Folio has never stored this preference, **When** the user enters source mode, **Then** no line numbers are shown and View > Show Line Numbers is unchecked.
2. **Given** source mode, **When** the user chooses View > Show Line Numbers, **Then** a gutter numbering each line of the document appears immediately, the item is checked, and the text, caret position and undo history are unchanged.
3. **Given** line numbers are on, **When** the user quits and relaunches Folio and enters source mode, **Then** the gutter is shown.
4. **Given** the rendered view is showing, **When** the user toggles View > Show Line Numbers, **Then** the next time source mode is shown the gutter matches the new setting.
5. **Given** line numbers are on, **When** the user views the source editor in any Style family in Light or Dark appearance, **Then** the numbers are muted relative to the document text and the gutter has no background panel or divider line of its own, so the theme's page shows through.

---

### User Story 5 - Copy the open document's path (Priority: P5)

File > Copy File Path (Ctrl/Cmd+Shift+C) puts the full path of the document in the current window on the clipboard, ready to share or paste into a terminal, and briefly confirms with "Path copied to clipboard".

**Why this priority**: It is a small convenience that is independent of editing. It also introduces the short, unobtrusive confirmation notice used by the formatting hint.

**Independent Test**: Open a saved file, press Ctrl/Cmd+Shift+C and paste into any text field: the document's absolute path appears and a confirmation shows for about two seconds. Choose File > New: File > Copy File Path is disabled.

**Acceptance Scenarios**:

1. **Given** a document opened from disk, in either the rendered view or source mode, **When** the user presses Ctrl/Cmd+Shift+C, **Then** the clipboard holds the document's full absolute path as plain text and "Path copied to clipboard" appears near the bottom center of the document area and is gone within about 2 seconds.
2. **Given** an untitled document (File > New, the Welcome document or the Markdown Formatting Tour), **When** the user opens the File menu, **Then** Copy File Path is disabled; if the command is triggered anyway, nothing is copied and the notice reads "Save the document first to copy its path".
3. **Given** a saved document with unsaved edits, **When** the user copies its path, **Then** the path on disk is copied and the edits stay unsaved and untouched.
4. **Given** an untitled document that the user saves with Save As, **When** the save completes, **Then** Copy File Path becomes available and copies the new path.
5. **Given** two windows showing different documents, **When** the user invokes Copy File Path, **Then** the path of the focused window's document is copied and the confirmation appears in that window.
6. **Given** a screen reader is running, **When** a confirmation or hint appears, **Then** its text is announced without moving keyboard focus.

---

### Edge Cases

- **Removing formatting needs a selection**: with only the caret inside `**word**`, pressing Ctrl/Cmd+B inserts another empty pair of marks at the caret instead of removing the bold. The text (with or without its marks) has to be selected to remove formatting.
- **Single marks inside double marks**: Italic's `*` is half of Bold's `**`, and Inline Math's `$` is half of `$$`. Applying Italic to the text inside `**word**` (or to the whole `**word**`) therefore removes one asterisk on each side and leaves `*word*`, rather than adding italic on top of bold.
- **Multi-line selections**: inline marks wrap the whole selection once, at its start and end, not each line. Headings apply to every line the selection touches, including blank lines (which become empty headings) and a line on which the selection merely ends at its very first character.
- **Mixed heading levels**: each selected line is evaluated on its own. Lines already at the chosen level lose their heading marks; the other lines are set to that level.
- **What counts as a heading**: only one to six `#` at the very start of a line followed by a space or tab. An indented heading, `#text` without a space, or an underlined (`===`/`---`) heading is not recognized, so the new marks are added in front of it.
- **Blocks in the middle of a line**: the opening fence always starts on its own line, but text that follows the selection or caret on the same line ends up directly after the closing fence (for example ```` ```text ````), which breaks the block. Code Block inserts no language name; the user can type one after the opening fence.
- **Link, Code Block and Math Block never toggle**: applying them again inserts another link or block.
- **Rendered view and focus**: the rendered view is not an editing surface. Formatting shortcuts pressed there never change the document, and the Format menu commands show the hint. In source mode the shortcuts act only while the editor itself has keyboard focus (not while typing in a find field or the Find in Files box), whereas a Format menu command always targets the editor.
- **One selection at a time**: the source editor has a single caret or selection, so every command acts on exactly one place.
- **Copy File Path without a saved document**: the item is disabled for untitled documents and when no window is open; the fallback notice covers the case where the command fires without a saved path.
- **Repeated notices**: a new notice replaces the one on screen and restarts its timer. A notice that is too long for one line is cut off with an ellipsis rather than wrapping.
- **Several windows**: the line-number preference is stored once for the whole app, but only the window where it is toggled updates immediately. Other open windows keep their current gutter until it is toggled there or the window is reopened, and the check mark in the View menu shows the most recently stored value.
- **Platform differences**: macOS shows the moved pane toggles as Cmd+Option+E and Cmd+Option+O. Windows and Linux show them as "Ctrl+Alt+E" and "Ctrl+Alt+O", in the conventional modifier order.

## Requirements *(mandatory)*

### Functional Requirements

**Format menu and invocation**

- **FR-001**: The app MUST provide a top-level Format menu listing, in this order, Bold, Italic, Underline, Strikethrough, Inline Code, Code Block and Link; then, after a separator, Inline Math and Math Block; then, after a separator, Heading 1 to Heading 6. The items MUST show the shortcuts Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+U, Ctrl/Cmd+Shift+X, Ctrl/Cmd+E, Ctrl/Cmd+Shift+E, Ctrl/Cmd+K, Ctrl/Cmd+M, Ctrl/Cmd+Shift+M and Ctrl/Cmd+1 to Ctrl/Cmd+6 respectively.
- **FR-002**: Each Format command MUST work both from the menu and from its shortcut while the source editor has keyboard focus. The shortcuts MUST take precedence over the editor's built-in key bindings and over the native bold, italic and underline keystrokes of the text-editing surface, so that one keystroke applies the command exactly once.
- **FR-003**: Format commands MUST change the document only in source mode. The Format menu items MUST stay enabled in both views. When a Format command is chosen from the menu while the rendered view is showing, the app MUST leave the document unchanged and show the transient hint "Switch to Source mode (Ctrl/Cmd+/) to format text".
- **FR-004**: After a Format command is chosen from the menu in source mode, keyboard focus MUST return to the source editor.
- **FR-005**: Formatting changes MUST behave like typed edits. They mark the document as having unsaved changes and can be undone and redone.

**Inline formatting**

- **FR-006**: Bold, Italic, Underline, Strikethrough, Inline Code and Inline Math MUST use the mark pairs `**`…`**`, `*`…`*`, `<u>`…`</u>`, `~~`…`~~`, `` ` ``…`` ` `` and `$`…`$` respectively.
- **FR-007**: With a non-empty selection that is not already formatted, an inline command MUST insert the opening mark before the selection and the closing mark after it, and MUST keep the original text selected.
- **FR-008**: With an empty selection, an inline command MUST insert the opening and closing marks at the caret and place the caret between them.
- **FR-009**: An inline command MUST remove its marks instead of adding them when (a) the selection is non-empty and the marks sit immediately outside it, or (b) the selection begins with the opening mark and ends with the closing mark. Afterwards the unformatted text MUST be selected.

**Headings**

- **FR-010**: Heading N (N from 1 to 6) MUST apply to every line touched by the selection, or to the caret's line when nothing is selected, and MUST keep the edited text in view.
- **FR-011**: For each of those lines, evaluated independently: if the line already starts with N `#` followed by spaces or tabs, the app MUST remove that prefix. Otherwise it MUST replace any existing prefix of one to six `#` (with its following spaces or tabs) with exactly N `#` and one space, or prepend N `#` and one space when there is no such prefix.

**Links and blocks**

- **FR-012**: Link MUST replace a non-empty selection with `[selection]()` and place the caret between the parentheses. With an empty selection it MUST insert `[]()` and place the caret between the brackets.
- **FR-013**: Code Block and Math Block MUST replace the selection with an opening fence line (```` ``` ```` or `$$`), the selected text as the body (possibly empty), and a closing fence line. The app MUST insert a line break before the opening fence when the selection does not start at the beginning of a line. Afterwards the body MUST be selected, or the caret placed on the empty body line. The code fence MUST carry no language name.
- **FR-014**: Link, Code Block and Math Block MUST always insert; they MUST NOT toggle.

**Shortcut coexistence**

- **FR-015**: View > Toggle File Explorer MUST move to Ctrl/Cmd+Alt+E and View > Toggle Outline to Ctrl/Cmd+Alt+O (Cmd+Option on macOS), so that Ctrl/Cmd+Shift+E is free for Code Block. The new shortcuts MUST work in both views. On Windows and Linux the menu MUST display them as "Ctrl+Alt+E" and "Ctrl+Alt+O". The tooltips of the status-bar Files and Outline buttons MUST show the new shortcuts.

**Line numbers**

- **FR-016**: The View menu MUST offer a "Show Line Numbers" check item, with no shortcut, whose check mark reflects the stored preference.
- **FR-017**: When the preference is on, the source editor MUST show a gutter with one number per document line. Toggling MUST take effect immediately in the window where it is toggled, without reloading the document or losing the caret position or undo history.
- **FR-018**: The preference MUST default to off and MUST persist across launches as an app-wide preference. A change made while the rendered view is showing MUST apply the next time source mode is shown.
- **FR-019**: Line numbers MUST be visually muted relative to the document text, and the gutter MUST have no background or divider line of its own, so the active theme's page shows through in both Light and Dark appearance.

**Copy File Path**

- **FR-020**: The File menu MUST offer "Copy File Path" (Ctrl/Cmd+Shift+C) after Save As…. It MUST be enabled only when the focused window's document has been saved to disk, and its availability MUST update when a document is opened, created or saved under a new name.
- **FR-021**: Invoking Copy File Path MUST place the document's full absolute path on the system clipboard as plain text and show the transient confirmation "Path copied to clipboard" in that window. It MUST NOT change the document or its unsaved state.
- **FR-022**: If Copy File Path is invoked for an untitled document, the app MUST copy nothing and MUST show "Save the document first to copy its path".

**Transient notices**

- **FR-023**: Transient notices MUST appear centered near the bottom of the document area. They MUST stay visible for about 1.6 seconds and be gone within 2 seconds, and they MUST NOT take keyboard focus or block mouse clicks. A new notice MUST replace one already on screen and restart its timer, and an over-long message MUST be cut off on a single line.
- **FR-024**: Notices MUST be announced politely to assistive technologies, MUST stay legible in both Light and Dark appearance, and MUST display their message as plain text, never as markup.

### Key Entities *(include if feature involves data)*

- **Format command**: one of fifteen named commands with a shortcut and a behavior class: an inline mark pair (six commands), a heading level (six), a link template, or a fenced block (two). Inline commands and headings toggle; links and blocks only insert.
- **Selection**: the source editor's single caret or text range. It is the input to every Format command and is repositioned by each one.
- **Line-number preference**: an app-wide on/off setting, off by default, remembered between launches and shown as a check mark in the View menu.
- **Document path**: the absolute location on disk of the document shown in a window; untitled documents have none. It is the payload of Copy File Path.
- **Transient notice**: a short plain-text message shown briefly in one window (copy confirmation, untitled hint, "switch to source mode" hint).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 15 Format commands can be invoked both from the Format menu and with a single key chord in source mode.
- **SC-002**: For each of the six inline commands, applying the command twice to the same selection restores the original text exactly, with the same text selected.
- **SC-003**: Changing a plain line or a well-formed `#` heading to any level from 1 to 6, between two levels, or back to plain text takes exactly one command and leaves exactly one heading prefix (or none), never stacked `#` marks.
- **SC-004**: After a link or block is inserted, the caret is already where the user types next (link text, address or block body) in 100% of uses, so no caret movement is needed.
- **SC-005**: Line numbers appear or disappear within a second of toggling the menu item, are off on a fresh install, and the choice survives 100% of relaunches.
- **SC-006**: Copy File Path puts the exact full path of the current document on the clipboard in one action. Its confirmation stays visible for about 1.6 seconds and is gone within 2 seconds.
- **SC-007**: In the rendered view, 0 Format commands change the document, and every Format menu command chosen there shows the "switch to source mode" hint.
- **SC-008**: None of the Format shortcuts triggers another Folio command. For example, Ctrl/Cmd+Shift+E inserts a code block and never toggles the file explorer.

## Assumptions

- Formatting works on the Markdown source text in source mode. The rendered view stays a read-only surface, and formatting in the rendered view (WYSIWYG) is out of scope.
- The marks follow common Markdown conventions: `**`, `*`, `~~`, backticks and `#` headings. Markdown has no underline syntax, so Underline uses inline `<u>…</u>` HTML, as Typora does, and relies on the existing preview showing inline HTML ([001](../001-markdown-viewer-editor/spec.md)).
- Inline Math and Math Block only insert TeX delimiters. Typesetting the formulas in the preview is defined by [009-math-typesetting](../009-math-typesetting/spec.md), delivered in the same change.
- The source editor offers a single selection; multiple simultaneous carets are not supported.
- No formatting command validates content: Link does not check or prefill an address, and Code Block does not ask for a language.
- Copy File Path copies only the path, not the file's contents. Untitled documents (new documents and the built-in Welcome and Markdown Formatting Tour documents, which open untitled per [001](../001-markdown-viewer-editor/spec.md)) have no path to copy.
- "Focused window" and per-window documents follow [007-multiple-windows](../007-multiple-windows/spec.md). The line-number preference is shared app-wide, like the other view preferences.
- Bundled and third-party themes are not expected to style the line-number gutter, so Folio supplies its own muted styling for it.
- Ctrl applies on Windows and Linux and Cmd on macOS; "Alt" is the Option key on macOS.
- Find ([006](../006-find-in-document-and-files/spec.md)), editor theming ([004](../004-three-axis-theming/spec.md)) and math rendering ([009](../009-math-typesetting/spec.md)) are referenced only and are not changed by this feature.
