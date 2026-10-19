# Feature Specification: Folder Mode, Link Navigation & Back/Forward History

**Feature Branch**: `005-folder-mode-navigation`

**Created**: 2026-07-14

**Status**: Implemented (retroactive)

**Input**: User description: "Add a folder mode: File > Open Folder shows a file-explorer pane listing the Markdown files in a directory tree. Clicking a file renders it, and clicking a link between documents follows it in place; a link to a folder opens that folder's _index.md (or README.md). Keep the explorer selection in sync with what is shown, guard unsaved edits before navigating, remember the last folder, and let me close the folder. Show where a link points when I hover over it, and give me browser-style Back/Forward through the documents I have visited. Web links open in my browser, and links to other local files must never silently launch a program."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `e2e2877` (2026-07-14) folder mode, file explorer and in-place link navigation with GitHub-style heading anchors; `356cf20` (2026-07-14) collapsed explorer and the Open Folder shortcut remap; `4a9cc98` (2026-07-14) Close Folder; `8062af5` (2026-07-14) guarded opening of non-Markdown link targets and case-insensitive folder index lookup; `f8f17fa` (2026-07-15) link-target hover hint; `4ebcdb2` (2026-07-20) Back/Forward history. Related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (rendered preview, unsaved-changes prompt, status bar, outline), [003-command-line-launch](../003-command-line-launch/spec.md) (folder launch argument and the startup view), [004-three-axis-theming](../004-three-axis-theming/spec.md) (Appearance drives the explorer's light and dark look), [006-find-in-document-and-files](../006-find-in-document-and-files/spec.md) (Find in Files searches the open folder), [007-multiple-windows](../007-multiple-windows/spec.md) (each window has its own folder and history), [008-source-editing-tools](../008-source-editing-tools/spec.md) (moved Toggle File Explorer to `Ctrl/Cmd+Alt+E`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse a folder of Markdown files (Priority: P1)

A user keeps notes or documentation as a folder of Markdown files. They choose File > Open Folder…, pick the folder, and a file-explorer pane appears down the left side of the window listing the folder's Markdown files as a tree. The folder's main page opens automatically. Clicking any file in the tree shows it in place, and the tree always highlights the document currently on screen. The pane can be hidden and shown again at any time.

**Why this priority**: This is the core of folder mode and the minimum useful slice: without it there is no way to see or reach the other documents in a folder. Link navigation, history and Close Folder all build on it.

**Independent Test**: Open a folder that contains a `README.md`, a few Markdown files in nested subfolders, a hidden folder, a `node_modules` folder and some non-Markdown files. Verify the listed tree, the document that opens first, clicking files, the highlight, and hiding and showing the pane.

**Acceptance Scenarios**:

1. **Given** any document is open, **When** the user chooses File > Open Folder… (`Ctrl/Cmd+Shift+O`) and picks a folder, **Then** a file-explorer pane titled with the folder's name appears at the left edge and lists the folder's Markdown files as a tree, with subfolders before files and each group sorted by name in natural order that ignores letter case (`a2.md` before `a10.md`).
2. **Given** the picked folder has a top-level `_index.md`, `README.md` or `index.md` (in any letter case), **When** it opens, **Then** that file is displayed, preferring `_index.md`, then `README.md`, then `index.md`; **and given** it has none of them, **Then** the first top-level Markdown file in sorted order is displayed, or, when the top level has no Markdown files, the first one found by searching the subfolders in order (each folder's own files before its subfolders).
3. **Given** the folder contains hidden items (names starting with `.`), `node_modules`, `.git`, `.obsidian`, `.vscode` or `.idea` folders, subfolders without any Markdown files, and non-Markdown files, **When** the explorer lists it, **Then** none of these appear.
4. **Given** the explorer has just been filled, **When** the user looks at it, **Then** every folder is collapsed except the folders leading to the displayed document; **and when** the user clicks a folder row, **Then** it expands or collapses.
5. **Given** a Markdown file is listed, **When** the user clicks it, **Then** it is displayed in place, becomes the highlighted entry, its parent folders are expanded, and the entry is scrolled into view; hovering any file entry shows its full path.
6. **Given** the current document has unsaved edits, **When** the user clicks another file or chooses File > Open Folder…, **Then** the user is asked to Save, Don't Save or Cancel before anything changes, and Cancel keeps the current document and its edits.
7. **Given** the explorer is visible, **When** the user chooses View > Toggle File Explorer (`Cmd+Alt+E` on macOS, `Ctrl+Alt+E` on Windows and Linux) or clicks the **Files** button in the status bar, **Then** the pane hides, and the same action shows it again; the **Files** button appears highlighted while the pane is visible.
8. **Given** the user opens a folder, **Then** the app's saved preferences record it as the last opened folder, and closing the folder clears that record; the next launch still starts from the launch argument rather than from this record (see 003).
9. **Given** the explorer is visible, **When** the Appearance is switched between Light and Dark or another Style is chosen, **Then** the pane follows the Appearance and keeps Folio's own look regardless of the Style.

---

### User Story 2 - Follow links between documents in place (Priority: P2)

While reading a document, the user clicks a link to another Markdown file and that file opens in the same window, scrolled to the linked heading if the link names one. A link to a folder opens that folder's index page. Links to headings in the same document scroll within it. This works for any saved document, whether or not a folder is open.

**Why this priority**: Linked documents are how a folder of Markdown becomes a navigable knowledge base. It is the second most valuable capability, and it works on its own for single files opened with File > Open….

**Independent Test**: Open a saved document whose links point to another Markdown file (with and without a `#heading` fragment), to a heading in the same document, to a folder that has an `_index.md`, to a folder without an index page, and to a file that does not exist. Click each link.

**Acceptance Scenarios**:

1. **Given** a saved document contains a relative link to `other.md`, **When** the user clicks it, **Then** `other.md` replaces the current document in the same window.
2. **Given** a link `guide/chapter%202.md#second-section`, **When** the user clicks it, **Then** `guide/chapter 2.md` opens and its preview scrolls to the heading "Second Section".
3. **Given** a link `#install` that names a heading of the current document, **When** the user clicks it, **Then** the preview scrolls smoothly to that heading without reloading the document.
4. **Given** a link points to a folder that contains `_index.md`, `README.md` or `index.md`, **When** the user clicks it, **Then** that index document opens (preferring `_index.md`, then `README.md`, then `index.md`).
5. **Given** a link points to a folder with none of those index files, **When** the user clicks it, **Then** an informational message "Nothing to display for this folder." names the folder and suggests adding an `_index.md` (or `README.md`), and the current document stays on screen.
6. **Given** a link points to a file or folder that does not exist, **When** the user clicks it, **Then** a "Cannot find the linked item." warning shows the resolved path and the current document stays on screen.
7. **Given** the current document has unsaved edits, **When** the user clicks a link to another Markdown file, **Then** the Save / Don't Save / Cancel prompt appears first, and Cancel leaves everything as it was.
8. **Given** an untitled document (the Welcome document or a new document that was never saved), **When** the user clicks a relative link, **Then** nothing happens; **and when** the user clicks a link to a Markdown file written as an absolute path beginning with `/`, **Then** that file opens.

---

### User Story 3 - Open web links and other files safely (Priority: P3)

Documents are untrusted. Web links open in the user's default browser, never inside Folio. Links to other kinds of local files (PDFs, images, spreadsheets) ask for confirmation and show exactly which file would be opened. Links to programs, scripts and network locations are refused outright, so clicking a link can never silently launch anything.

**Why this priority**: Once links are followable, a malicious or careless link must not be able to run a program. This makes link navigation safe to use on documents from anywhere.

**Independent Test**: In a saved document, click links to an `https://` address, to an existing local `.sh` script, to an existing local `.csv` file, to a `mailto:` address and, on Windows, to a `//server/share/...` file.

**Acceptance Scenarios**:

1. **Given** a link to `https://example.com`, **When** the user clicks it, **Then** the address opens in the default browser and the Folio window keeps showing the document.
2. **Given** a link to an existing local file of an executable or script type (such as `.exe`, `.bat`, `.ps1`, `.sh`, `.py`, `.js`, `.jar` or `.command`), **When** the user clicks it, **Then** a warning "Blocked opening an executable or script." names the file and nothing is launched.
3. **Given** a link to an existing non-Markdown file whose path begins with `\\` or `//` (a network location), **When** the user clicks it, **Then** a warning "Blocked opening a network location." names it and nothing is opened.
4. **Given** a link to an existing local non-Markdown file of any other type (for example `data.csv`), **When** the user clicks it, **Then** the user is asked "Open this file with its default application?" with the file's full absolute path shown and Cancel preselected; only choosing Open hands the file to the operating system.
5. **Given** a `mailto:` link, **When** the user clicks it, **Then** nothing is opened.

---

### User Story 4 - Go back and forward through visited documents (Priority: P4)

After following several links, the user steps back to earlier documents and forward again, the way a web browser works. Each window keeps its own history.

**Why this priority**: History makes link-heavy reading comfortable, but links and the explorer already deliver the core value without it.

**Independent Test**: Open a saved document, follow links to two more documents, then use Go > Back twice and Go > Forward once, checking which document is shown and which Go menu items are available at each step.

**Acceptance Scenarios**:

1. **Given** the user opened document A and followed links to B and then C, **When** they choose Go > Back twice, **Then** B and then A are displayed; **and when** they choose Go > Forward, **Then** B is displayed again.
2. **Given** the user went back from C to B, **When** they follow a link from B to D, **Then** Go > Forward becomes unavailable because C was dropped from the forward history.
3. **Given** the displayed document is the first entry of the window's history, **Then** Go > Back is disabled; **and given** it is the last entry, **Then** Go > Forward is disabled.
4. **Given** a document was reached through a link with a `#fragment`, **When** the user returns to it with Back or Forward, **Then** the preview scrolls to that fragment again.
5. **Given** the current document has unsaved edits, **When** the user chooses Back or Forward, **Then** the Save / Don't Save / Cancel prompt appears first, and Cancel keeps the document and the history position.
6. **Given** the file of the previous history entry has been deleted, **When** the user chooses Back, **Then** "That document is no longer available." is shown with its path and the window stays where it is.
7. **Given** the user opens Help > Welcome, Help > Markdown Formatting Tour or File > New, or closes the folder, **Then** both Back and Forward are disabled.
8. **Given** a folder is open, **When** Back or Forward displays another document of that folder, **Then** the explorer highlight moves to it.
9. **Given** Windows or Linux, **Then** Back and Forward are `Alt+Left` and `Alt+Right`; **given** macOS, **Then** they are `Cmd+[` and `Cmd+]`.
10. **Given** two windows showing different documents, **When** the user moves through the history of one window, **Then** the other window's history is unaffected, and the Go menu always reflects the focused window.

---

### User Story 5 - Close the folder (Priority: P5)

When finished with a folder, the user closes it and the window returns to the Welcome document with the explorer gone.

**Why this priority**: Useful housekeeping that completes the folder life cycle, but less important than reading and navigating.

**Independent Test**: Open a folder, choose File > Close Folder, and check the window, the explorer and the menu.

**Acceptance Scenarios**:

1. **Given** a folder is open, **When** the user chooses File > Close Folder (`Ctrl/Cmd+Shift+W`), **Then** the explorer is cleared and hidden and the Welcome document is shown.
2. **Given** the focused window has no folder open, **Then** File > Close Folder is disabled.
3. **Given** the current document has unsaved edits, **When** the user chooses Close Folder, **Then** the Save / Don't Save / Cancel prompt appears first, and Cancel keeps the folder and the document open.
4. **Given** the folder was closed, **Then** Back and Forward are disabled and the Welcome document is untitled, so saving it asks for a new location.

---

### User Story 6 - See where a link points before clicking (Priority: P6)

When the pointer rests on a link in the rendered document, a small hint in the bottom-left corner of the document area shows where the link goes, like a web browser's status bar.

**Why this priority**: A convenience that also helps users judge a link before triggering an external-open prompt; everything else works without it.

**Independent Test**: In a saved document, hover over a relative link, a web link and an in-page `#heading` link, then move the pointer away and switch to source mode.

**Acceptance Scenarios**:

1. **Given** a saved document with a relative link `guide/chapter%202.md`, **When** the user hovers over it, **Then** the hint shows the decoded absolute path of the target (for example `/Users/me/notes/guide/chapter 2.md`).
2. **Given** a web link, **When** the user hovers over it, **Then** the hint shows the web address.
3. **Given** an in-page link `#install`, **When** the user hovers over it, **Then** the hint shows `#install`.
4. **Given** the hint is shown, **When** the pointer leaves the link or the document area, the document is re-rendered, or the user switches to source mode, **Then** the hint disappears.
5. **Given** a very long target, **When** the hint shows it, **Then** it is shortened with an ellipsis, and the hint never intercepts clicks.
6. **Given** the Dark appearance, **When** the hint is shown, **Then** it uses dark colors that match the rest of Folio's chrome.

---

### Edge Cases

- **Folder without Markdown files**: the explorer shows "No markdown files", the current document stays on screen, and the window's Back/Forward history starts empty.
- **Folder picker cancelled**: the unsaved-changes prompt comes before the picker; cancelling either one leaves the window unchanged.
- **Deep or unusual trees**: folders nested more than 16 levels below the opened folder are not listed; symbolic links to files or folders are not listed; subfolders that cannot be read are silently left out.
- **Files changed on disk after opening**: the explorer is a snapshot taken when the folder opens. Files created, renamed or deleted later (including a file saved into the folder with Save As) appear only after the folder is opened again; clicking an entry whose file was deleted shows "Cannot find the linked item.".
- **Clicking the document already shown**: it is re-read from disk (after the unsaved-changes prompt) and does not add a history entry.
- **Links leaving the folder**: a link to a Markdown file outside the open folder displays it; the explorer keeps showing the open folder with no entry highlighted.
- **Folder link versus Open Folder**: a folder link only accepts the three index file names; a folder that has other Markdown files but no index page still shows "Nothing to display for this folder." (only Open Folder falls back to the first Markdown file).
- **Fragments**: a fragment that matches no heading leaves the document at the top; fragments are applied only in the rendered preview, so a document opened while source mode is active ignores its fragment.
- **Links the safety filtering drops**: links written as `file://` addresses, and Windows paths with a drive letter (`C:/…`), are not turned into clickable links by the document safety filtering (see 001), so they cannot be followed. Relative links work everywhere; on Windows a link beginning with `/` is looked up on the current drive.
- **Application bundles**: a link to a macOS `.app` bundle points at a folder, so it shows "Nothing to display for this folder." and nothing is launched.
- **Duplicate headings**: the second and later headings with the same text are addressed as `#name-1`, `#name-2`, and so on, as on GitHub.
- **Index names in any case**: `README.md`, `readme.md` and `Readme.MD` are all recognized, on every operating system.
- **Other link schemes**: `mailto:` links do nothing; any other scheme that survives the document's safety filtering (for example `tel:`) is treated as a local path and ends in "Cannot find the linked item.".
- **History and in-page jumps**: in-page `#fragment` jumps and reloading the current file are not history entries, so Back returns to the previous document rather than to an earlier scroll position.
- **Missing history entry**: Back or Forward onto an entry whose file was deleted warns and stays put; entries beyond it in that direction cannot be reached until new navigation replaces them.
- **Explorer toggled with no folder**: the pane opens empty with the message "No folder open".
- **Several windows**: each window has its own folder, explorer and history; File > Close Folder and the Go menu reflect the focused window (see 007).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to open a folder with File > Open Folder… (`Ctrl/Cmd+Shift+O`), which lets them pick a directory; opening a folder MUST replace any folder already open in that window.
- **FR-002**: Before the folder picker appears, the system MUST run the unsaved-changes prompt (Save / Don't Save / Cancel); choosing Cancel, or cancelling the picker, MUST leave the window's document, folder and history unchanged.
- **FR-003**: Opening a folder MUST show the file-explorer pane at the left edge of the window, titled with the folder's name, listing the folder as a tree.
- **FR-004**: The explorer MUST list only Markdown files, recognized by the extensions `.md`, `.markdown`, `.mdown`, `.mkd`, `.markdn`, `.mdtext` and `.mdtxt` in any letter case.
- **FR-005**: The explorer MUST omit entries whose names start with `.` and the folders `node_modules`, `.git`, `.obsidian`, `.vscode` and `.idea`, and MUST show a subfolder only if it contains at least one listed Markdown file at some depth.
- **FR-006**: At every level the explorer MUST list subfolders before files, each group sorted by name in natural order that ignores letter case.
- **FR-007**: The folder scan MUST be bounded: folders more than 16 levels below the opened folder MUST NOT be scanned, and unreadable folders MUST be skipped without an error.
- **FR-008**: When a folder opens, the system MUST display its entry document: the top-level file named `_index.md`, `README.md` or `index.md` (in that order of preference, matched in any letter case); otherwise the first Markdown file in explorer order, taking the files of a level before descending into its subfolders. If the folder contains no Markdown files, the current document MUST stay on screen and the explorer MUST show "No markdown files".
- **FR-009**: Clicking a file in the explorer MUST display it in place after the unsaved-changes prompt; hovering an entry MUST show its full path.
- **FR-010**: Whenever the displayed document changes (explorer, link, Back/Forward, File > Open…, startup), the explorer MUST highlight the entry of the displayed document when it belongs to the open folder, expand the folders leading to it, and scroll it into view.
- **FR-011**: When the explorer is filled, every folder MUST start collapsed except those leading to the displayed document; clicking a folder row MUST toggle it open or closed, and folders the user opened MUST stay open while navigating within the same folder.
- **FR-012**: Users MUST be able to hide and show the explorer with View > Toggle File Explorer (`Cmd+Alt+E` on macOS, `Ctrl+Alt+E` on Windows and Linux) and with the **Files** button in the status bar, which MUST appear highlighted while the pane is visible; opening a folder MUST make the pane visible, and with no folder open the pane MUST read "No folder open".
- **FR-013**: The system MUST record the most recently opened folder and the explorer's visibility in the saved preferences (set when a folder opens, updated on every toggle, cleared when the folder is closed). The window's initial view at launch MUST NOT be restored from these values; it is determined by the launch argument as specified in 003.
- **FR-014**: Clicking a link in the rendered preview whose target is a Markdown file MUST display that file in the same window after the unsaved-changes prompt, whether or not a folder is open.
- **FR-015**: Link targets MUST be resolved on the local file system as follows: percent-encoded characters (such as `%20`) decoded first; relative paths against the folder that contains the current document; paths beginning with `/` as absolute paths; forward slashes accepted on every operating system.
- **FR-016**: A link with a fragment (`doc.md#section`) MUST scroll the destination's preview to the matching heading after it opens; a fragment-only link (`#section`) MUST scroll smoothly within the current document without reloading it.
- **FR-017**: Rendered headings MUST receive GitHub-style identifiers (lower-cased, punctuation removed, spaces replaced by hyphens, repeated headings suffixed `-1`, `-2`, …, and `section` when no usable text remains; an identifier already present on a heading is kept), shared with the document outline. A fragment MUST match a heading when the fragment, as written or normalized the same way, equals the heading's identifier or its normalized text.
- **FR-018**: A link to a folder MUST display that folder's index document (`_index.md`, then `README.md`, then `index.md`, any letter case); if there is none, the system MUST show the informational message "Nothing to display for this folder." with the folder's path and the hint to add an `_index.md` (or `README.md`), and keep the current document.
- **FR-019**: A link to a target that does not exist MUST show the warning "Cannot find the linked item." with the resolved path and keep the current document.
- **FR-020**: In an untitled document, relative links MUST do nothing; links beginning with `/` MUST still be followed.
- **FR-021**: `http` and `https` links MUST open in the operating system's default browser; they and all other document content MUST NOT navigate the Folio window away from the document view or open new windows. `mailto:` links MUST NOT open anything.
- **FR-022**: A link to an existing non-Markdown local file MUST be refused with "Blocked opening a network location." when its path begins with `\\` or `//`.
- **FR-023**: A link to an existing non-Markdown local file MUST be refused with "Blocked opening an executable or script." when its extension (any letter case) is one of `.exe`, `.bat`, `.cmd`, `.com`, `.msi`, `.scr`, `.pif`, `.cpl`, `.ps1`, `.psm1`, `.vbs`, `.vbe`, `.js`, `.jse`, `.wsf`, `.wsh`, `.hta`, `.jar`, `.reg`, `.lnk`, `.sh`, `.bash`, `.zsh`, `.py`, `.rb`, `.pl`, `.app` or `.command`.
- **FR-024**: Any other non-Markdown local file MUST be opened only after the user confirms "Open this file with its default application?" in a prompt that shows the file's resolved absolute path and preselects Cancel; on Open the file MUST be handed to the operating system's default application.
- **FR-025**: Each window MUST keep its own browser-style history of the saved Markdown files displayed in it, remembering the fragment used to reach each one.
- **FR-026**: Displaying a file through a link, an explorer click, File > Open… or File > Open Recent MUST add it to the history after the current position, discarding any Forward entries; displaying the file that is already the current entry MUST only update its fragment.
- **FR-027**: Go > Back and Go > Forward (`Alt+Left` / `Alt+Right` on Windows and Linux; `Cmd+[` / `Cmd+]` on macOS) MUST move one step through the history and restore the entry's fragment without adding entries; each item MUST be enabled only when a step in its direction exists for the focused window.
- **FR-028**: Back and Forward MUST run the unsaved-changes prompt before leaving the current document; Cancel MUST keep the document and the history position.
- **FR-029**: If the file of the target history entry no longer exists, Back and Forward MUST show "That document is no longer available." with its path and keep the current document and position.
- **FR-030**: The history MUST be cleared when an untitled document is shown (File > New, Help > Welcome, Help > Markdown Formatting Tour, Close Folder), restart from the entry document when a folder opens, and start from the initial document (empty for the Welcome document) when a window starts. In-page fragment jumps and reloading the displayed file MUST NOT change it.
- **FR-031**: File > Close Folder (`Ctrl/Cmd+Shift+W`) MUST be enabled only while the focused window has a folder open.
- **FR-032**: Closing a folder MUST run the unsaved-changes prompt; on proceeding it MUST clear and hide the explorer, forget the folder (including the remembered last folder), clear the history and show the Welcome document as an untitled document. Cancel MUST leave everything unchanged.
- **FR-033**: While the pointer is over a link in the rendered preview, the system MUST show the link's target in a hint pinned to the bottom-left of the document area, and MUST hide it when the pointer leaves the link or the document area, when the preview re-renders, and when source mode is entered.
- **FR-034**: The hint MUST show fragment-only links as written. A link without a scheme (other than one starting with `//`) MUST be resolved against the displayed document's location and shown as a decoded absolute path when the document has a location; in every other case the link MUST be shown as written, decoded. Long targets MUST be shortened with an ellipsis, and the hint MUST NOT intercept clicks.
- **FR-035**: The explorer pane and the hover hint MUST provide both a light and a dark appearance that follow the app's Appearance setting, and MUST keep Folio's own look under every document Style.
- **FR-036**: The open folder, the explorer contents and the navigation history MUST belong to a single window; menu availability (Close Folder, Back, Forward) MUST reflect the focused window.

### Key Entities *(include if feature involves data)*

- **Open folder**: the directory a window is browsing. Has a location, a display name (the folder's name) and a listing captured when it was opened. A window has at most one.
- **Explorer entry**: a subfolder or Markdown file in the listing, with its name, location and kind; subfolders contain further entries.
- **Index document**: the file that represents a folder: `_index.md`, `README.md` or `index.md` (any letter case, in that preference). Opening a folder additionally falls back to its first Markdown file; following a folder link does not.
- **Link target**: what a clicked link resolves to: a Markdown document (with an optional heading fragment), a folder without an index document, another local file, a web address, or something that does not exist.
- **Navigation history**: an ordered list of visited saved Markdown files, each with the fragment used to reach it, plus the current position. One per window.
- **Remembered folder preferences**: the last opened folder and whether the explorer was visible, kept with the app's other saved preferences.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any document, a user reaches a folder's entry document with two actions (File > Open Folder…, pick the folder), and the explorer lists every Markdown file up to 16 folder levels below it that is not hidden, not a symbolic link and not inside `node_modules`, `.git`, `.obsidian`, `.vscode` or `.idea`, and no other files.
- **SC-002**: 100% of links between existing Markdown files (relative, or absolute paths beginning with `/`, with or without percent-encoded characters) open in the same window with a single click, and every link whose fragment names a heading lands on that heading.
- **SC-003**: None of the 28 blocked executable and script file types and no non-Markdown network-location target can be opened from a document link, and 100% of other non-Markdown targets require an explicit Open confirmation that displays the full absolute path.
- **SC-004**: After following N links between files, choosing Back N times returns to the starting document and Forward N times returns to the last one; Back and Forward are unavailable exactly when no step exists in their direction.
- **SC-005**: Zero navigation actions (explorer click, link, Back, Forward, Open Folder, Close Folder) discard unsaved edits without an explicit Save or Don't Save choice, and Cancel leaves the window exactly as it was.
- **SC-006**: After 100% of navigations within an open folder, the explorer highlights the displayed document with its parent folders expanded.
- **SC-007**: The hover hint appears as soon as the pointer enters a link, with no hover delay, and disappears as soon as the pointer leaves the link or the document area.
- **SC-008**: Closing a folder returns the window to the Welcome document with the explorer hidden in one action, and Close Folder is unavailable in every state where the focused window has no folder open.

## Assumptions

- Out of scope and specified elsewhere: Find in Files ([006](../006-find-in-document-and-files/spec.md)) searches the folder opened here; opening a folder from the command line and the startup view ([003](../003-command-line-launch/spec.md)); multiple windows ([007](../007-multiple-windows/spec.md)), which makes folder, explorer and history per window.
- Relies on [001](../001-markdown-viewer-editor/spec.md) for rendering and safety-filtering documents (which decides which links exist in the preview at all), the unsaved-changes prompt (Save / Don't Save / Cancel), the status bar that hosts the **Files** button, the outline, source mode and the untitled Welcome document; the dark appearance follows the Appearance setting of [004](../004-three-axis-theming/spec.md).
- "Web links" means `http` and `https` addresses only; `mailto:` links are intentionally not handed to the operating system.
- Markdown files are always displayed inside Folio, including Markdown files on network shares; the network-location and executable blocks apply only when a non-Markdown file would be handed to the operating system.
- The explorer does not watch the folder for changes; reopening the folder refreshes it.
- The keyboard shortcuts are the ones shipped today. Open Folder first used `Ctrl/Cmd+Shift+K` (until `356cf20`) and Toggle File Explorer first used `Ctrl/Cmd+Shift+E` (until 008 reassigned it); the history is recorded in [research.md](./research.md).
- The user can read the folder they open; unreadable parts are omitted rather than reported.
