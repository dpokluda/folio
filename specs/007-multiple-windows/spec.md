# Feature Specification: Multiple Independent Windows

**Feature Branch**: `007-multiple-windows`

**Created**: 2026-07-14

**Status**: Implemented (retroactive)

**Input**: User description: "Let me work on several documents at once. File > New Window opens another window with its own document, folder, navigation history and unsaved state, while app-wide preferences such as the theme stay shared across windows. Opening a path from the terminal or the desktop while Folio is running should open a new window instead of replacing what I am looking at. New windows should cascade so they do not hide the one behind them, and a Window menu should list every open window by document title and let me switch between them, including from the keyboard."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `8062af5` (2026-07-14: per-window document state, File > New Window, one running instance where a second launch opens a new window, menu commands routed to the window in front), `87e9165` (2026-08-06: cascading placement of new windows; README documentation of multiple windows) and `5b4fe2e` (2026-08-10: Window menu with the window list, switching, Minimize, Zoom and Bring All to Front); related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (what each window shows, saving, live reload), [003-command-line-launch](../003-command-line-launch/spec.md) (how launch paths are read and the `folio` command), [004-three-axis-theming](../004-three-axis-theming/spec.md) (the shared theme axes), [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md) (per-window folder and history), [006-find-in-document-and-files](../006-find-in-document-and-files/spec.md), [008-source-editing-tools](../008-source-editing-tools/spec.md) (owner of `Ctrl/Cmd+M`), [011-system-appearance](../011-system-appearance/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work on several documents in separate windows (Priority: P1)

A user reading or editing one document wants a second one beside it without losing their place. They choose File > New Window (`Ctrl/Cmd+Shift+N`); a second window opens on the Welcome document, and they open another file or folder in it. Each window keeps its own document, open folder, back/forward history and unsaved edits. Commands from the menu bar or the keyboard act on the window in front, and closing a window asks only about that window's unsaved edits.

**Why this priority**: This is the capability itself. Every other story either creates windows (second launch), places them (cascade), keeps them consistent (shared preferences) or switches between them (Window menu). On its own it already delivers side-by-side viewing and editing.

**Independent Test**: Launch Folio, press `Ctrl/Cmd+Shift+N`, open a different file in each window, edit one of them, and confirm that the other window's document, title and unsaved state do not change; then close the edited window and confirm that only it asks to save.

**Acceptance Scenarios**:

1. **Given** Folio shows document A, **When** the user chooses File > New Window, **Then** a second window opens showing the Welcome document and the first window still shows A.
2. **Given** two windows showing A and B, **When** the user types in A, **Then** only A's title gains the unsaved marker (`•`) and B's title stays unchanged.
3. **Given** two windows with B in front, **When** the user invokes Open… (`Ctrl/Cmd+O`), Save, Toggle Source Code Mode or Find…, **Then** the command applies to window B only.
4. **Given** window A has an open folder and window B has none, **When** the user brings each window to the front in turn, **Then** File > Close Folder is enabled only while A is in front, and Go > Back, Go > Forward and File > Reload from Disk likewise reflect the window in front.
5. **Given** windows A and B have each followed links between documents, **When** the user chooses Go > Back in B, **Then** B returns to its own previous document and A's document and history are unchanged.
6. **Given** window A has unsaved edits, **When** the user closes A, **Then** A asks Save / Don't Save / Cancel; Cancel keeps A open with its edits, and window B is never prompted or changed.

---

### User Story 2 - Open from the terminal or desktop into a new window (Priority: P2)

While Folio is running, the user launches it again with a path: `folio notes.md`, `folio notes-folder`, or a double-click on an associated Markdown file. Instead of replacing what is on screen, Folio opens the path in a new window and brings that window to the front. Launching Folio again without a path just brings the existing Folio window forward.

**Why this priority**: The request explicitly asks not to have the current document replaced, and the constitution requires a second launch to behave the same on every platform. It reuses the windows from User Story 1.

**Independent Test**: With Folio running and showing a document with unsaved edits, launch Folio again from a terminal with another file path. A new window with that file comes to the front, the original window keeps its document and edits, and no save prompt appears.

**Acceptance Scenarios**:

1. **Given** Folio is running and window A has unsaved edits, **When** the user launches Folio again with a file path, **Then** a new window showing that file opens in front, and A keeps its document and unsaved edits without any prompt.
2. **Given** Folio is running, **When** the user launches it again with a folder path, **Then** a new window opens in folder mode on that folder (explorer and entry document as defined by 005).
3. **Given** Folio is running and its window is minimized, **When** the user launches Folio again without a path (or with a path that does not exist), **Then** no new window opens, and the most recently used Folio window is restored and brought to the front.
4. **Given** Folio is running on macOS, **When** the user opens a Markdown file from Finder, **Then** the file opens in a new window.
5. **Given** Folio is running on macOS with every window closed, **When** the user launches it again without a path, **Then** a new window showing Welcome opens.

---

### User Story 3 - Preferences stay shared across windows (Priority: P3)

The theme is one app-wide choice. When the user changes Style, Appearance or Page width in any window, every open window restyles at once. The recent-files list is common to all windows, and new windows open at the remembered size with the remembered view preferences.

**Why this priority**: Users expect one consistent look and one set of preferences, not settings that differ from window to window. Without this story, other windows keep the old look until they are reopened, which is annoying but does not lose work.

**Independent Test**: Open three windows. From one of them, switch Themes > Style to GitHub and Themes > Appearance to Dark. All three windows restyle immediately, and the Themes menu shows the new check marks whichever window is in front.

**Acceptance Scenarios**:

1. **Given** three open windows, **When** the user picks a different Style or Page width in one of them, **Then** every window restyles immediately.
2. **Given** two open windows, **When** the user picks Themes > Appearance > Dark, **Then** both windows switch to the dark palette at once.
3. **Given** window A has opened file X, **When** the user opens File > Open Recent while window B is in front, **Then** X is listed.
4. **Given** the user resized a window and then closed it, **When** they open a new window, **Then** the new window has the size of the window they closed.
5. **Given** the user turned on source mode, line numbers or a zoom level in one window, **When** they open a new window, **Then** it starts with that preference, and windows that are already open keep their own current view.

---

### User Story 4 - New windows cascade instead of covering each other (Priority: P4)

Each new window appears a short step down and to the right of the window in front, so the window behind stays visible. When the chain of windows reaches the right or bottom edge of the screen, the next window starts again from the top-left of the screen's usable area.

**Why this priority**: Without it, a new window lands exactly on top of the previous one, so opening a second document looks as if the first one had been replaced. This is polish on top of User Stories 1 and 2, and it uses the window size from User Story 3.

**Independent Test**: With one window open, open several windows with `Ctrl/Cmd+Shift+N`. Each one sits 30 points right of and below the previous one. Keep going until the next window would cross the right or bottom edge of the screen, and confirm that it jumps to the top-left corner of the usable area.

**Acceptance Scenarios**:

1. **Given** one window whose top-left corner is at (x, y), **When** the user opens a new window, **Then** it appears with its top-left corner at (x + 30, y + 30) and at the remembered size.
2. **Given** the window in front is so close to the bottom-right of the screen that an offset window would extend past the usable area, **When** a new window opens, **Then** it is placed at the top-left corner of that display's usable area.
3. **Given** the window in front is on a secondary display, **When** a new window opens, **Then** it cascades on that same display.
4. **Given** no Folio window exists yet (first launch), **When** Folio starts, **Then** its window opens at the operating system's default position.
5. **Given** Folio is running, **When** a second launch or a Finder open creates a window, **Then** that window cascades the same way as one created with File > New Window.

---

### User Story 5 - Find and switch windows from the Window menu (Priority: P5)

The Window menu lists every open window by document title and marks the active one. Choosing an entry brings that window forward, restoring it if it was minimized. Select Next Window and Select Previous Window cycle through the windows from the keyboard. The menu also offers Minimize, plus Zoom and Bring All to Front on macOS.

**Why this priority**: Once several windows overlap, there is otherwise no in-app way to reach a window hidden behind another. It is the last layer on top of the windows the earlier stories create.

**Independent Test**: Open three windows on different documents and minimize one of them. Pick each window from the Window menu, cycle with `` Cmd+` `` (macOS) or `Ctrl+Tab` (Windows/Linux), and confirm that the entries follow title changes (unsaved marker, Save As rename) and that a closed window disappears from the list.

**Acceptance Scenarios**:

1. **Given** three windows opened in the order a.md, b.md, Welcome, **When** the user opens the Window menu, **Then** it lists "a.md", "b.md" and "Welcome" in that order, with a mark on the window in front.
2. **Given** window B is minimized, **When** the user chooses B in the Window menu, **Then** B is restored, brought to the front and focused.
3. **Given** three windows, **When** the user repeatedly presses `Ctrl+Tab` (Windows/Linux) or `` Cmd+` `` (macOS), **Then** focus moves to the next window in list order and wraps from the last window to the first; `Ctrl+Shift+Tab` / `` Cmd+Shift+` `` moves backwards.
4. **Given** only one window is open, **When** the user opens the Window menu, **Then** Select Next Window and Select Previous Window are disabled.
5. **Given** window A gains unsaved edits, is saved, or is saved under a new name, **When** the user opens the Window menu, **Then** A's entry shows its current title (with `•` only while unsaved).
6. **Given** a window is closed, **When** the user opens the Window menu, **Then** that window is no longer listed; on macOS with every window closed, the list shows a disabled "(No open windows)" entry.
7. **Given** a window is in front, **When** the user chooses Window > Minimize, **Then** that window is minimized; on macOS, Window > Zoom toggles the front window between its zoomed and normal size, and Window > Bring All to Front raises every Folio window.

---

### Edge Cases

- **Same file in two windows**: nothing locks the file. Each window tracks it separately, so saving in one window is an external change for the other. The other window reloads silently if it has no unsaved edits; otherwise it asks Reload / Keep My Changes (as defined by 001). The last save wins.
- **Identical titles**: two windows showing files with the same name (or two Welcome windows) appear with identical labels in the Window menu. They can be told apart only by their order (oldest first).
- **Last window closed**: on Windows and Linux, Folio quits. On macOS, Folio keeps running with its menu bar, and the Window menu shows "(No open windows)". Clicking the Dock icon opens a new Welcome window. File > Open… or File > Open Folder… opens a new window first and shows the dialog there. View commands such as Toggle Source Code Mode, Zoom In or Find… do nothing until a window exists.
- **Unresponsive window**: if a window does not provide its content within 4 seconds when the user saves, the save fails safely. Nothing is written, no error is shown, the document stays unsaved, and a close that was waiting on that save is cancelled.
- **Quitting with unsaved edits in several windows**: each such window asks separately. Cancel keeps that window open with its edits.
- **Second launch with a path that does not exist**: it is treated like a launch without a path, so the most recently used window comes forward. Path checking itself is defined by 003.
- **Window size**: the size is remembered only when a window closes. A window opened while other windows are still open takes the size of the most recently closed window (1100 × 820 on first use), not the size of the window in front. Positions are never remembered, so the first window of each launch opens at the operating system's default position.
- **View preferences are not synchronized live**: toggling source mode, line numbers or zoom in one window leaves the other open windows as they are. The remembered values are those of the window where a view preference last changed. The View > Show Line Numbers check mark shows that window's choice, so it can disagree with the window in front when windows were toggled separately.
- **Minimize has no shortcut**: `Ctrl/Cmd+M` belongs to Format > Inline Math (see 008), so Window > Minimize is available only from the menu.
- **Prompts belong to their window**: unsaved-changes prompts, file dialogs and messages about a window's document are attached to the window they concern. For example, a background window whose file changed on disk asks on that window, not on the one in front.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to open an additional window at any time with File > New Window (`Ctrl/Cmd+Shift+N`). The new window MUST show the Welcome document.
- **FR-002**: Each window MUST keep its own document state: the open file (or the untitled document's name), the unsaved-changes flag, the open folder, the back/forward history and the watching for external changes. No action in one window may change another window's document state.
- **FR-003**: Each window's title MUST show that window's document name followed by "- Folio". The title MUST start with the unsaved marker (`•`) only while that window has unsaved edits.
- **FR-004**: Menu commands and keyboard shortcuts MUST act on the window in front. When no Folio window is focused (possible on macOS while the menu bar is active), they MUST act on the most recently focused window that is still open.
- **FR-005**: Menu items whose availability depends on the current document MUST reflect the window in front and MUST update whenever another window comes to the front. These items are File > Close Folder, File > Reload from Disk, File > Copy File Path, Go > Back and Go > Forward.
- **FR-006**: Anything a window asks Folio to do on its own behalf MUST be applied to that same window, whichever window is in front. This covers loading its first document, reporting unsaved edits, following a link or an explorer click, and searching its folder.
- **FR-007**: Save, Save As and Export to PDF MUST take their content from the window the command applies to. If that window does not supply its content within 4 seconds, the save MUST be treated as failed: nothing is written and the document stays unsaved.
- **FR-008**: Closing a window that has unsaved edits MUST ask, in that window, Save / Don't Save / Cancel. The window MUST close only after a successful save or Don't Save. Cancel MUST leave it open with its edits. Other windows MUST NOT be prompted or changed.
- **FR-009**: Quitting Folio MUST pass every open window through the same close guard. Windows without unsaved edits close, and each window with unsaved edits asks before it closes.
- **FR-010**: Closing a window MUST stop that window's watching for external changes and release its document state. The remaining windows MUST continue unaffected.
- **FR-011**: When a document command (for example File > Open… or File > Open Folder…) is invoked while no Folio window is open, Folio MUST open a new window and run the command in it. View commands invoked with no window open MUST do nothing.
- **FR-012**: Folio MUST run as a single instance. Launching it again while it is running MUST hand the launch over to the running instance instead of starting an independent copy.
- **FR-013**: When a hand-off carries a file path, the running instance MUST open that file in a new window. When it carries a folder path, a new window MUST open in folder mode on that folder. Existing windows MUST keep their documents and unsaved edits, and no unsaved-changes prompt is shown.
- **FR-014**: When a hand-off carries no usable path, the running instance MUST bring its most recently focused window forward, restoring it if it is minimized. If there is no such window, it MUST open a new window showing Welcome.
- **FR-015**: The window that receives a hand-off, whether new or existing, MUST be restored if minimized, shown and brought to the front, including when the launch came from a terminal.
- **FR-016**: On macOS, a file or folder opened from Finder or another application while Folio is running MUST open in a new window.
- **FR-017**: Style, Appearance and Page width MUST be single app-wide choices. Changing any of them from any window MUST restyle every open window immediately and MUST update the Themes menu check marks.
- **FR-018**: All windows MUST share one recent-files list. A file opened or saved in any window MUST appear under File > Open Recent whichever window is in front.
- **FR-019**: New windows MUST open at the remembered window size, which is the size of the most recently closed window (1100 × 820 by default).
- **FR-020**: Source mode, line numbers and zoom level MUST be remembered app-wide as last used and applied to each newly opened window. Changing them in one window MUST NOT change windows that are already open.
- **FR-021**: When another Folio window exists, a new window MUST be placed 30 points to the right of and 30 points below the window in front. If no Folio window is focused, another open Folio window is used as the reference instead.
- **FR-022**: If that position would make the new window extend past the right or bottom edge of the usable area of the reference window's display, the new window MUST instead be placed at the top-left corner of that usable area.
- **FR-023**: Window positions MUST NOT be remembered between launches. The first window MUST open at the operating system's default position.
- **FR-024**: The menu bar MUST include a Window menu that lists every open Folio window, oldest first. Each entry shows the window's document title: its title without "- Folio", including the `•` marker while unsaved. The window in front MUST carry a mark. When no window is open, the list MUST show a disabled "(No open windows)" entry.
- **FR-025**: Choosing a window in the Window menu MUST bring that window to the front and focus it, restoring it first if it is minimized.
- **FR-026**: Window > Select Next Window and Window > Select Previous Window MUST move focus to the next or previous open window in list order, wrapping around at both ends. Their shortcuts MUST be `` Cmd+` `` and `` Cmd+Shift+` `` on macOS and `Ctrl+Tab` and `Ctrl+Shift+Tab` on Windows and Linux. Both items MUST be disabled when fewer than two windows are open.
- **FR-027**: The Window menu MUST offer Minimize on every platform, with no keyboard shortcut, and MUST offer Zoom and Bring All to Front on macOS only.
- **FR-028**: The Window menu MUST stay current. It MUST update when a window opens, closes or comes to the front, and when a window's title changes: another document, a Save As rename, or the unsaved marker appearing or clearing.
- **FR-029**: On Windows and Linux, closing the last window MUST quit Folio. On macOS, Folio MUST keep running with its menu bar after the last window closes, and clicking its Dock icon while no window is open MUST open a new window showing Welcome.

### Key Entities *(include if feature involves data)*

- **Window**: one open document workspace. It holds its document (a file, or an untitled document's name), the unsaved flag, the open folder, the back/forward history, the watching for external changes and its label in the Window menu. A window is created by File > New Window, by a second launch, by opening a file from Finder, or by a document command issued while no window is open. Its document state is discarded when the window closes and is never saved between launches.
- **App-wide preferences**: shared by all windows and remembered between launches. They are the Style, Appearance and Page width; the recent files (up to 10); the window size; and the last-used view preferences (source mode, line numbers, zoom).
- **Window list**: the ordered set of open windows (oldest first) shown in the Window menu. Each entry has its label and whether it is the window in front.
- **Launch hand-off**: a later launch's request to the running instance, with an optional file or folder path. It results in a new window or in an existing window being brought forward.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With two windows open on different documents, 100% of document actions in one window leave the other window's document, title, folder, history and unsaved edits unchanged across every quickstart scenario. These actions are typing, Save, Open, Open Folder, Back/Forward and closing.
- **SC-002**: 100% of launches with an existing file or folder path while Folio is running open exactly one new window for that path and bring it to the front, with zero unsaved-changes prompts and zero changes to existing windows.
- **SC-003**: A Style, Appearance or Page width change made in one window is visible in every open window immediately (verified with at least three windows). No window has to be reopened.
- **SC-004**: A new window opened while another Folio window is in front is placed exactly 30 points right of and below it. If that position would cross the right or bottom edge of the display's usable area, the new window starts at the area's top-left corner instead. Whenever the remembered window size fits within the usable area, no window in a chain of 20 consecutive new windows extends past its right or bottom edge.
- **SC-005**: Any open window can be brought to the front with at most two menu selections (Window, then its title). With N windows open, it can also be reached with at most N − 1 presses of the next-window shortcut.
- **SC-006**: After every window open, close, focus change, Save As and unsaved-state change in the quickstart, the Window menu lists exactly the open windows with their current titles (zero stale or missing entries).
- **SC-007**: 100% of attempts to close a window with unsaved edits show the save prompt on that window, and choosing Cancel preserves 100% of the edits.
- **SC-008**: On Windows and Linux, closing the last window ends Folio every time. On macOS, after every window has been closed, a single click on the Dock icon opens a new Welcome window.

## Assumptions

- How launch paths are read is defined by [003-command-line-launch](../003-command-line-launch/spec.md): relative paths are resolved against the launching terminal's folder, options are skipped, and files are told apart from folders. 003 also defines the `folio` command and how macOS delivers paths. This feature defines only what the running instance does with a path it is handed.
- What happens inside a window is defined by other specs: rendering, editing, saving, live reload and built-in documents by [001](../001-markdown-viewer-editor/spec.md), folder mode, link navigation and back/forward history by [005](../005-folder-mode-navigation/spec.md), and Find by [006](../006-find-in-document-and-files/spec.md). This feature only requires that each of them stays scoped to its own window.
- The theme axes are defined by [004](../004-three-axis-theming/spec.md), and the System appearance by [011](../011-system-appearance/spec.md). This feature requires only that they stay app-wide and apply to every window.
- Folio puts no limit on the number of open windows. In practice it is bounded by memory, and a user typically has a handful of windows open.
- Bringing a window to the front is a request to the operating system, whose focus rules apply. Folio asks explicitly, and on macOS it also activates itself.
- One person uses one running instance, so all windows share one preferences file.
- Distances are in points (logical screen pixels), as reported by the operating system for the display.
