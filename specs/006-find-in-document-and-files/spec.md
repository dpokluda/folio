# Feature Specification: Find in Document & Find in Files

**Feature Branch**: `006-find-in-document-and-files`

**Created**: 2026-07-14

**Status**: Implemented (retroactive)

**Input**: User description: "Add search. Ctrl/Cmd+F finds text in the current document: in the rendered view show a find bar that highlights every match, with next/previous and a match count; in source mode use the editor's own search. Ctrl/Cmd+Shift+F, when a folder is open, searches every Markdown file in it from a box at the top of the file explorer, groups the results by file, and opens a result with the term highlighted. Esc dismisses the search and returns to the file tree. It must stay responsive on large folders."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `2a26dea` (2026-07-14) find bar for the rendered view (the same commit also switched the window-title separator to a plain hyphen, an incidental change outside this feature), `e126f54` (2026-07-14) Find in Files, `4a9cc98` (2026-07-14) dismissable Find-in-Files box only (its Close Folder command belongs to 005), and `8062af5` (2026-07-14) search caching and per-window search scoping only; related specs: [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md) (Find in Files requires its open folder and reuses its explorer, navigation and history), [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (rendered view, source editor, unsaved-changes guard), [007-multiple-windows](../007-multiple-windows/spec.md) (per-window state).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find text in the open document (Priority: P1)

A reader looking at a rendered document presses Ctrl/Cmd+F. A small find bar appears over the top-right corner of the page. As they type, every occurrence of the term is highlighted in the page, the current occurrence is emphasized and scrolled into view, and a counter such as "2/4" shows where they are. Enter and Shift+Enter (or the arrow buttons) step forward and back through the occurrences; Esc or the close button removes the bar and the highlights. In source mode the same shortcut opens the source editor's own search panel instead, so nobody is pulled out of the view they are working in.

**Why this priority**: Finding a word in the document on screen is the most common search need and works for every document, with or without an open folder. Before this feature, Find forced a switch into source mode, which took readers out of the rendered page they were reading.

**Independent Test**: Open the bundled Markdown Formatting Tour (Help menu), press Ctrl/Cmd+F and type "typora": four occurrences are highlighted and the counter reads "1/4"; Enter moves to "2/4", Shift+Enter returns to "1/4", Esc removes the bar and every highlight. Switch to source mode and press Ctrl/Cmd+F: the editor's search panel opens.

**Acceptance Scenarios**:

1. **Given** a document in the rendered view, **When** the user presses Ctrl/Cmd+F (Edit ▸ Find…), **Then** a find bar appears at the top-right of the document area with its text field focused, and the document stays in the rendered view.
2. **Given** the find bar is open, **When** the user types a term, **Then** every occurrence of it in the rendered page is highlighted while they type, regardless of letter case, the first occurrence is emphasized as the current match and brought into view, and the counter shows "1/N".
3. **Given** N matches with match k current, **When** the user presses Enter (or the down-arrow button), **Then** match k+1 becomes current and is brought into view, wrapping from the last match to the first; **When** the user presses Shift+Enter (or the up-arrow button), **Then** the previous match becomes current, wrapping from the first to the last.
4. **Given** the find bar is open, **When** the typed term occurs nowhere in the page, **Then** nothing is highlighted and the counter reads "0/0"; **When** the field is emptied, **Then** the counter is blank.
5. **Given** highlights are showing, **When** the user presses Esc in the field or clicks the close button, **Then** the bar disappears and every highlight is removed; **When** the user presses Ctrl/Cmd+F again, **Then** the bar reopens with the previous term selected and highlighted again.
6. **Given** the find bar is open, **When** the page is redrawn (another document is shown, the file is reloaded after an outside change, or it is saved under a new name), **Then** the bar stays open and the term is applied to the new content, with the first match current.
7. **Given** the find bar is open, **When** the user switches to source mode, **Then** the bar closes and its highlights are removed, and it stays closed when the user returns to the rendered view.
8. **Given** the document is in source mode, **When** the user presses Ctrl/Cmd+F, **Then** the source editor's own search panel opens at the top of the editor and the view stays in source mode.
9. **Given** highlights are showing, **When** the user changes the Style, Page width or Appearance, **Then** the highlights remain and stay legible.

---

### User Story 2 - Search every Markdown file in the open folder (Priority: P2)

With a folder open, the user presses Ctrl/Cmd+Shift+F. The file explorer appears (if it was hidden) with a search box at its top. As soon as they pause typing, the file tree is replaced by a list of results: a summary such as "5 matches in 2 files", then one group per file, headed by the file's path inside the folder and its match count, listing each matching line's number and text with the term emphasized. Esc clears and hides the box and brings the file tree back.

**Why this priority**: Folder mode turns Folio into a notes browser, and "which note mentions this?" is the next most common question after finding text on the current page. It only makes sense with an open folder, so it ranks after in-document find.

**Independent Test**: Open the repository's `samples` folder (File ▸ Open Folder…), press Ctrl/Cmd+Shift+F and type "typora": the summary reads "5 matches in 2 files", with `formatting-tour.md` (4) listed before `welcome.md` (1). Press Esc: the box disappears and the file tree returns. Close the folder and press Ctrl/Cmd+Shift+F: a message explains that Find in Files needs an open folder.

**Acceptance Scenarios**:

1. **Given** a folder is open, **When** the user chooses Edit ▸ Find in Files… (Ctrl/Cmd+Shift+F), **Then** the file explorer becomes visible if it was hidden, and a search box appears at its top with keyboard focus and any previous text selected.
2. **Given** no folder is open in the window, **When** the user chooses Find in Files, **Then** no search box appears and an informational message explains that Find in Files searches an open folder and that one can be opened with File ▸ Open Folder.
3. **Given** the search box has focus, **When** the user types a term and pauses, **Then** the file tree is replaced by a summary ("N matches in M files") and one group per file that contains the term, in the same order as the file explorer; each group shows the file's path relative to the folder and its number of matches, and lists each matching line's number and text with every occurrence of the term emphasized.
4. **Given** the user has typed a term, **When** they press Enter, **Then** the search runs immediately without waiting for the pause.
5. **Given** the term occurs in no file, **When** the search runs, **Then** the pane shows "No matches".
6. **Given** results are showing, **When** the user presses Esc in the search box, **Then** the box is cleared and hidden and the file tree is shown again; **When** instead the user deletes all text in the box, **Then** the file tree is shown again and the empty box stays available.
7. **Given** results are showing, **When** the user opens a different folder or closes the folder, **Then** the search box is cleared and hidden and the results are discarded; a newly opened folder shows its file tree, and closing the folder hides the explorer as defined in 005.
8. **Given** two windows with different folders open, **When** the user searches in each window, **Then** each window lists only files from its own folder.

---

### User Story 3 - Open a search result with the term highlighted (Priority: P3)

From the result list, the user clicks a file's heading or any of its matching lines. The document opens (after the usual unsaved-changes prompt, if needed) and, in the rendered view, the find bar opens already filled in with the search term, highlighting every occurrence with the first one current, so the reader immediately sees why the file matched and can press Enter to step through the occurrences. The result list stays in the explorer so the next result is one click away.

**Why this priority**: It turns a list of hits into navigation. It builds on the find bar (User Story 1) and the result list (User Story 2) and adds the "take me there" payoff.

**Independent Test**: With the `samples` folder open and "typora" results showing, click the `welcome.md` match: `welcome.md` opens in the rendered view with the find bar showing "typora" and "1/1", and the result list is still visible. Switch to source mode, type a character so the document has unsaved changes, then click a `formatting-tour.md` result: the save/discard/cancel prompt appears, and Cancel keeps the edited document.

**Acceptance Scenarios**:

1. **Given** search results and a current document without unsaved changes, **When** the user clicks a match line or a file heading, **Then** that document opens in the rendered view, the find bar opens with the search term filled in, every occurrence is highlighted, and the first occurrence is current and in view.
2. **Given** a document just opened from a result, **When** the user presses Enter, **Then** the next occurrence becomes current, because keyboard focus is in the find bar.
3. **Given** the current document has unsaved changes, **When** the user clicks a result, **Then** the unsaved-changes prompt (save, discard or cancel) appears first; **When** the user chooses Cancel, **Then** nothing opens and the current document keeps its edits.
4. **Given** a result has been opened, **When** the user looks at the explorer, **Then** the result list is still displayed and other results can be opened without searching again.
5. **Given** the window is in source mode, **When** the user clicks a result, **Then** the document opens in the source editor without highlighting.
6. **Given** a result has been opened, **When** the user goes Back, **Then** the previously viewed document returns, because opening a result is recorded in the window's Back/Forward history like any explorer click.

---

### User Story 4 - Stay responsive on large folders (Priority: P4)

A user whose notes folder holds thousands of Markdown files searches for a common word. Folio does not freeze: the list is capped at a reviewable size and says "(truncated)" when the overall cap is reached, typing a word does not start a search on every keystroke, and repeated searches do not re-read files that have not changed, while still reflecting files that were saved, added or removed in the meantime.

**Why this priority**: Folder sizes vary widely and an unbounded search could hang the window. Typical folders are small and User Story 2 already works for them, so this hardening ranks last.

**Independent Test**: Create a scratch folder with 30 Markdown files of 60 lines that each contain "needle", open it and search for "needle": the summary reads "1000 matches in 20 files (truncated)" and every file group lists 50 lines. Add a unique word to one file from another editor, save, and search for it: it is found. Create a new file containing another unique word, wait five seconds, and search for it: it is found.

**Acceptance Scenarios**:

1. **Given** a file with more than 50 matching lines, **When** the search runs, **Then** its group lists only its first 50 matching lines and its count shows 50.
2. **Given** more than 1,000 matching lines across the folder, **When** the search runs, **Then** the search stops at 1,000 matches and the summary ends with "(truncated)".
3. **Given** more than 500 files contain the term, **When** the search runs, **Then** at most 500 file groups are listed.
4. **Given** a matching line longer than 240 characters (after surrounding whitespace is removed), **When** it is listed, **Then** its row shows only the first 240 characters.
5. **Given** the user types a multi-letter term quickly, **When** they pause, **Then** one search runs for the whole term rather than one per keystroke.
6. **Given** a file in the folder was changed and saved (in Folio or another app) since the last search, **When** the user searches again, **Then** the results reflect the saved content.
7. **Given** a Markdown file was added to the folder, **When** the user searches more than 4 seconds later, **Then** the new file is included; a deleted file never appears in later results.
8. **Given** the user opens a different folder, **When** they search, **Then** nothing remembered from the previous folder is reused.

---

### Edge Cases

- **No folder open**: Ctrl/Cmd+Shift+F shows an informational message (Find in Files searches an open folder; open one with File ▸ Open Folder) and no search box appears. Ctrl/Cmd+F still finds text in the current document.
- **No matches or empty input**: the find bar shows "0/0" and highlights nothing; Find in Files shows "No matches". An empty find field shows no count; an empty or spaces-only Find-in-Files box shows the file tree.
- **Rendered text versus Markdown source**: the find bar searches the text as displayed, while Find in Files searches each file's Markdown source. A term that exists only in Markdown syntax (a link address, emphasis markers) or that typographic replacement changed in the rendered page (straight quotes shown as curly quotes) can be listed by Find in Files and still show "0/0" in the opened document.
- **Phrases across formatting or lines**: a phrase that is only partly emphasized, or that runs into a link, is not found in the rendered view; Find in Files matches within one line, so a phrase broken across lines is not found.
- **Limits**: a file with more than 50 matching lines lists only the first 50; when the total reaches 1,000 the search stops and "(truncated)" is shown; when more than 500 files match, only the first 500 are listed. A matching line longer than 240 characters is shortened, so the term may not be visible in that row.
- **Clicked line versus highlighted occurrence**: clicking a particular match line opens the document with the first occurrence current, not necessarily the clicked line; Enter moves through the rest.
- **Unsaved edits**: Find in Files searches files as saved; unsaved edits in the open document are not searched. Clicking a result while the current document has unsaved edits triggers the save/discard/cancel prompt, and Cancel keeps everything as it was.
- **Result in the document already open**: the file is opened again from disk (after the prompt, if it has unsaved edits) and the term is highlighted.
- **Source mode**: Ctrl/Cmd+F opens the editor's own search panel; switching to source mode closes the find bar; a clicked result opens in the editor without highlighting.
- **Keyboard focus**: Esc closes the find bar only while its field has focus; otherwise the close button closes it. Pressing Ctrl/Cmd+F while the bar is open refocuses the field and selects its text. Likewise, Esc dismisses the Find-in-Files box only while the box has focus; Ctrl/Cmd+Shift+F puts focus back in it.
- **Content redrawn while the bar is open** (reload after an outside change, another document, Save As): the bar stays open, its matches are recomputed and the first one becomes current.
- **Folder changes**: opening, switching or closing a folder hides and clears the search box; nothing remembered from the previous folder's searches is reused.
- **Files added after the folder was opened**: Find in Files can list a new Markdown file within about 4 seconds even though the file explorer lists only the files that existed when the folder was opened (see 005); a deleted file disappears from results immediately.
- **Unreadable files** (no permission, removed during a search) are skipped silently.
- **Hiding the explorer** while results are showing keeps them; they reappear when the explorer is shown again.
- **Multiple windows**: each window searches only its own folder, and each window has its own find bar.

## Requirements *(mandatory)*

### Functional Requirements

*Find in the current document*

- **FR-001**: Edit ▸ Find… (Ctrl/Cmd+F) MUST search the document currently displayed, in whichever view is active, without switching between the rendered view and source mode.
- **FR-002**: In the rendered view, Find MUST show a find bar over the top-right of the document area with a text field, a match counter, previous and next buttons, and a close button. Opening it MUST focus the field and select any text already in it, including when the bar is already open.
- **FR-003**: The find bar MUST search the text of the rendered page only (not the Markdown source, the file explorer, the outline or the status bar), case-insensitively, updating the results as each character is typed, and MUST highlight every occurrence.
- **FR-004**: Highlighting MUST NOT change the page's text, structure, layout or line wrapping, so that unmodified Typora themes render the page identically with or without highlights.
- **FR-005**: Whenever there are matches, exactly one MUST be the current match, shown with a stronger emphasis than the other highlights and brought into view. When the term changes or the page is redrawn, the first match MUST become current.
- **FR-006**: The counter MUST read "current/total" (for example "2/4") when there are matches, "0/0" when a non-empty term has no matches, and be blank when the field is empty; it MUST be announced to assistive technologies when it changes.
- **FR-007**: Enter or the next button MUST make the next match current and Shift+Enter or the previous button MUST make the previous match current, wrapping around at both ends; after a button is used, keyboard focus MUST return to the field.
- **FR-008**: Esc (while the field has focus) or the close button MUST hide the find bar and remove every highlight. The term MUST stay in the field for the next time the bar is opened in that window.
- **FR-009**: While the find bar is open, whenever the rendered page is redrawn (for example when another document is shown, the document is reloaded, or it is saved under a new name), the bar MUST stay open and re-apply its term to the new content.
- **FR-010**: Switching to source mode MUST close the find bar and remove its highlights; switching back to the rendered view MUST NOT reopen it.
- **FR-011**: In source mode, Find MUST open the source editor's own search panel at the top of the editor.
- **FR-012**: The find bar, the highlights and the current-match emphasis MUST be legible in both Light and Dark appearance, and highlights MUST survive changes of Style, Page width and Appearance.

*Find in Files*

- **FR-013**: Edit ▸ Find in Files… (Ctrl/Cmd+Shift+F) MUST always be available in the menu. When the window has no open folder it MUST show an informational message explaining that Find in Files searches an open folder and how to open one (File ▸ Open Folder), and do nothing else.
- **FR-014**: When a folder is open, Find in Files MUST reveal the file explorer if it is hidden and show a search box at the top of the explorer, focused, with any existing text selected. The search box MUST stay hidden until Find in Files is invoked.
- **FR-015**: A search MUST start automatically once typing pauses for about 180 ms, and immediately when Enter is pressed. Leading and trailing spaces in the term MUST be ignored, and an empty or spaces-only box MUST show the file tree instead of results.
- **FR-016**: A search MUST cover every Markdown file the file explorer lists for the open folder (the same file types, skipped hidden entries and tool folders, and depth limit, as defined in 005) and MUST match the term as a case-insensitive substring of each line of each file's saved Markdown source.
- **FR-017**: Results MUST replace the file tree in the explorer pane and begin with a summary of the form "N matches in M files" (singular forms for one); when nothing matches, the pane MUST show "No matches".
- **FR-018**: Results MUST be grouped by file in the same order as the file explorer. Each group MUST be headed by the file's path relative to the open folder (the full path available on hover) and its number of listed matches, and the group for the document displayed when the results are shown MUST be marked.
- **FR-019**: Each match row MUST show the 1-based line number and that line's text with leading and trailing whitespace removed and limited to its first 240 characters, with every occurrence of the term emphasized. File text MUST be displayed as plain text, never interpreted as markup.
- **FR-020**: Esc in the search box MUST clear and hide the box and restore the file tree; deleting all text in the box MUST restore the file tree while leaving the box open.
- **FR-021**: Opening a folder, switching to another folder, or closing the folder MUST clear and hide the search box and discard any displayed results.
- **FR-022**: Each window MUST search only the folder open in that window. The folder searched MUST be determined by Folio from the window's own state, never from anything a displayed document can influence.
- **FR-023**: Files that cannot be read MUST be skipped silently, and a search that fails MUST show "No matches" rather than an error.

*Opening a result*

- **FR-024**: Clicking a file heading or a match row MUST open that file the same way a click in the file explorer does, including the unsaved-changes guard (save, discard or cancel) and recording in the window's Back/Forward history (005). Cancel MUST leave the current document and its edits unchanged.
- **FR-025**: When the opened document is shown in the rendered view, the find bar MUST open with the search term filled in, highlighting every occurrence, with the first occurrence current and keyboard focus in the find bar. In source mode the document MUST open without highlights.
- **FR-026**: The result list MUST stay displayed after a result is opened, so further results can be opened without searching again.

*Bounds and responsiveness*

- **FR-027**: A search MUST list at most 50 matching lines per file, at most 1,000 matches in total and at most 500 files. Reaching the 1,000-match limit MUST end the search and append "(truncated)" to the summary.
- **FR-028**: To stay responsive while the user types, repeated searches in the same open folder MUST NOT re-list the folder's files more often than every 4 seconds and MUST NOT re-read a file whose last-modified time is unchanged since it was last read. Saved changes to a file MUST be reflected in the next search, deleted files MUST disappear from the next search, and added files MUST appear within about 4 seconds.
- **FR-029**: Everything remembered between searches MUST be discarded when a folder is opened or closed, and file text MUST NOT be reused across different folders.
- **FR-030**: Both searches MUST be read-only: they MUST NOT modify any document or file.

### Key Entities *(include if feature involves data)*

- **Find session**: per window; the term in the find bar, the occurrences of that term in the rendered page, which occurrence is current, and whether the bar is open. The term survives closing the bar; the occurrences are recomputed whenever the term or the page changes.
- **Folder search**: a term plus the folder open in the window where the search was started; produces a search result.
- **Search result**: the term, an ordered list of file groups, and a truncation flag that is set when the 1,000-match limit is reached.
- **File group**: one Markdown file (path relative to the folder, and full path) with up to 50 matches.
- **Match**: a 1-based line number and an excerpt of that line (whitespace-trimmed, at most 240 characters).
- **Pending highlight term**: the term carried from a clicked result to the next document shown in that window, where it seeds the find bar.
- **Remembered search data**: the open folder's list of Markdown files (reused for up to 4 seconds) and each file's text (reused until its last-modified time changes); discarded when a folder is opened or closed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Using only the keyboard (Ctrl/Cmd+F, typing, Enter/Shift+Enter, Esc), a reader can open the find bar, visit every occurrence of a term in the rendered document in order, wrapping at the end, and close the bar, with zero switches to source mode.
- **SC-002**: Highlights and the counter reflect the typed term within half a second of each keystroke on documents the size of the bundled Markdown Formatting Tour.
- **SC-003**: Opening the find bar, highlighting matches and closing it changes no text, line breaks or layout of the rendered page, in every Style family, Page width and both appearances.
- **SC-004**: In folders of a few hundred Markdown files, Find in Files results appear within 1 second after the user stops typing or presses Enter.
- **SC-005**: No single search displays more than 1,000 matches, more than 50 matches for one file, or more than 500 files, whatever the folder size, and every search that reaches the 1,000-match limit says "(truncated)".
- **SC-006**: Results reflect a file's saved changes on the very next search, never list a file deleted before the search, and include a newly added Markdown file within 5 seconds of its creation.
- **SC-007**: From a result list, a user reaches the matching document with the term highlighted in 1 click when there are no unsaved changes, and in 2 interactions (click, then Save or Don't Save) when there are.
- **SC-008**: With the search box focused, a single Esc press returns the file explorer from any Find-in-Files results or input to the plain file tree.
- **SC-009**: In 100% of attempts to open a result while the current document has unsaved edits, the user is prompted first, and choosing Cancel preserves every edit.

## Assumptions

- Find in Files depends on the open folder, file explorer, explorer navigation, Back/Forward history and per-folder file scope defined in [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md); which files count as Markdown and which folders are skipped are defined there, not here.
- The rendered view, the source editor (including its own search panel and whatever options that panel offers) and the unsaved-changes prompt come from [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md); this feature does not change the source editor's search panel.
- Per-window independence of documents, folders and history is defined by [007-multiple-windows](../007-multiple-windows/spec.md); this feature only guarantees that each window's searches use that window's folder.
- The find bar and Find in Files are plain, case-insensitive text searches. Regular expressions, whole-word or case-sensitive matching, and replace are out of scope for both; Folio is a viewer with light editing, so there is no replace across files.
- Find in Files reads the files as saved on disk, as UTF-8 text; unsaved edits in the open document are not searched.
- Opening a result highlights the occurrences of the term in the document; jumping to the specific clicked line is out of scope.
- Everything runs locally and offline; no search data leaves the machine or is persisted between launches.
- The window-title separator change that shipped in the same delivery (`name - Folio` instead of an em dash) is title presentation owned by 001 and is not a requirement of this feature.
