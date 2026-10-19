# Feature Specification: Open From the Command Line & the `folio` Command

**Feature Branch**: `003-command-line-launch`

**Created**: 2026-07-09

**Status**: Implemented (retroactive)

**Input**: User description: "Let me open Folio from a terminal: 'folio notes.md' opens the document and 'folio notes-folder' opens the folder in the file explorer, with relative paths resolved from where I ran the command. If Folio is already running, the path should open in the running app instead of starting a second copy. Launching with no path shows the Welcome document rather than whatever I had open last time. Add a File menu command that installs a 'folio' command on my PATH on macOS, Windows and Linux, without me editing PATH by hand and without administrator rights where that can be avoided."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `f96fc39` (2026-07-09, open a file named at launch, hand a later launch to the running copy, macOS desktop hand-offs), `5c48052` (2026-07-14, folder paths; startup driven by the launch path instead of the last session), `8563975` (2026-07-14, macOS `folio` command), `5c59ebc` (2026-07-21, Linux AppImage `folio` command), `61017d1` (2026-08-04, terminal-launch fixes: background launcher, working-directory resolution, folders from the macOS desktop) and `ac1ff4a` (2026-09-16, Windows `folio` command); related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (Welcome document), [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md) (installers, file associations), [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md) (folder mode), [007-multiple-windows](../007-multiple-windows/spec.md) (a handed-over path opens in a new window).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a file or folder named at launch (Priority: P1)

A user working in a terminal starts Folio with a path. A file path opens that document; a folder path opens the folder in folder mode, with the file explorer showing and the folder's entry document displayed, which is the same result as File > Open… or File > Open Folder…. Relative paths are resolved from the directory the user ran the command in.

**Why this priority**: This is the heart of the request and the MVP. Once a path given at launch opens correctly, Folio can be started from scripts, shortcuts, a file dropped onto `Folio.exe` on Windows and, later, the installed `folio` command. Every other story builds on these rules.

**Independent Test**: Start Folio directly (a development run or the packaged program, without the installed command) from a directory other than Folio's own, first with a relative file path and then with a folder path, and confirm the right document or folder opens.

**Acceptance Scenarios**:

1. **Given** Folio is not running and the current directory contains `notes.md`, **When** the user starts Folio with the argument `notes.md`, **Then** Folio opens with `notes.md` displayed, its name in the title bar, the file explorer and outline hidden, and `notes.md` added to File > Open Recent.
2. **Given** Folio is not running and `notes-folder` contains `_index.md`, **When** the user starts Folio with `notes-folder`, **Then** Folio opens in folder mode with the file explorer listing the folder's Markdown files and `_index.md` displayed.
3. **Given** a relative path such as `../drafts/guide.md`, **When** Folio is started with it, **Then** the path is resolved against the directory the command was run from, not against Folio's install location.
4. **Given** the arguments `--some-option missing.md notes.md`, where `missing.md` does not exist, **When** Folio starts, **Then** the option and the missing path are skipped and `notes.md` opens.
5. **Given** the path names an existing file that cannot be read, **When** Folio starts, **Then** an error message names the file and the reason, and Folio then shows the Welcome document.
6. **Given** a Mac with a terminal window in front, **When** Folio is started from that terminal with a path, **Then** Folio's window appears in front of the terminal.

---

### User Story 2 - Send a path to the Folio that is already running (Priority: P2)

With Folio already open, the user runs the launch again with another path. No second copy of Folio starts. The running Folio opens the path (in a new window, as specified by [007-multiple-windows](../007-multiple-windows/spec.md)) and comes to the front, even though the request came from a terminal.

**Why this priority**: Folio allows only one running copy, so without a hand-off a second launch would simply vanish. The hand-off makes the command useful all day, not just for the first launch.

**Independent Test**: With Folio open and minimized, run the launch again from a different directory with a relative path. Verify that the system still shows a single running Folio, that the path was resolved against the second command's directory, and that Folio came to the foreground.

**Acceptance Scenarios**:

1. **Given** Folio is running, **When** the user runs the launch again with `notes.md` from another directory, **Then** the running Folio opens that directory's `notes.md` in a new window, and the second launch ends without opening anything itself.
2. **Given** Folio is running with unsaved edits in its window, **When** a new path is sent, **Then** the edited document stays untouched in its window, still marked as unsaved, and the new path opens in its own window.
3. **Given** Folio is running but minimized or behind other windows, **When** a launch with or without a path arrives, **Then** the affected Folio window is restored and brought to the foreground on macOS, Windows and Linux.
4. **Given** Folio is running, **When** the user launches it again with no path (or only paths that do not exist), **Then** no new window opens and the most recently used Folio window comes to the front; if no window is open (possible on macOS), a new window with the Welcome document opens.
5. **Given** Folio was started from a development checkout, **When** a later launch passes that checkout's folder followed by `notes.md`, or a packaged launch passes just `notes.md`, **Then** the running Folio opens `notes.md` and never opens its own checkout folder.

---

### User Story 3 - Start clean with the Welcome document when no path is given (Priority: P3)

Starting Folio without a path always shows the bundled Welcome document, never the document or folder that was open last time. The outline starts hidden, and the file explorer appears only when a folder was named.

**Why this priority**: A predictable start is what makes the launch path meaningful. Exactly what the user asked for (or the Welcome document) appears, with no restored session competing with it.

**Independent Test**: Open a folder and show the outline, quit Folio, start it with no path, and confirm the Welcome document is shown with the explorer and outline hidden.

**Acceptance Scenarios**:

1. **Given** the previous session had a folder open with the explorer and outline visible, **When** Folio is started without a path, **Then** it shows the Welcome document with the file explorer and the outline hidden.
2. **Given** Folio is started with a file path, **When** the window appears, **Then** only that document is shown, with no explorer and no outline, whatever the previous session showed.
3. **Given** the Welcome document is shown at startup, **When** the user saves, **Then** Folio asks for a new location instead of overwriting the bundled copy (as specified by [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md)).
4. **Given** the user prefers source mode, a zoom level, line numbers or a particular theme, **When** Folio starts with or without a path, **Then** those app-wide preferences still apply.

---

### User Story 4 - Install the `folio` command from the File menu (Priority: P4)

The user chooses File > Install 'folio' Command in PATH… once. Folio places a small `folio` launcher in a folder that is already on the user's PATH and tells the user what to type next. The user never edits PATH, and administrator rights are needed only on a Mac whose shared command folder belongs to the administrator. When Folio cannot write the launcher, it hands the user a ready-to-paste command instead.

**Why this priority**: After a normal install, Folio cannot be reached from a terminal on any platform: on macOS it is an app bundle, the Windows installer deliberately leaves PATH alone, and a Linux AppImage is a loose file. The menu command turns stories 1 to 3 into the one-word `folio notes.md` the user asked for.

**Independent Test**: On each platform's packaged build, choose the menu command, open a new terminal, run `folio notes.md` and `folio notes-folder` from a directory that contains them, and confirm Folio opens them.

**Acceptance Scenarios**:

1. **Given** packaged Folio on macOS and a writable `/usr/local/bin`, **When** the user chooses the menu command, **Then** `/usr/local/bin/folio` is created, and a confirmation shows example `folio` usage for a file and a folder and advises opening a new terminal.
2. **Given** a Mac where `/usr/local/bin` cannot be written, **When** the user chooses the menu command, **Then** a warning explains that Folio could not write `/usr/local/bin/folio` and shows a one-line administrator (`sudo`) terminal command that installs the same launcher, with **Copy Command** and **Cancel** buttons.
3. **Given** the command is installed on macOS, **When** the user runs `folio notes.md` or `folio notes-folder`, **Then** Folio opens it whether or not Folio was already running, the terminal prompt returns at once, and closing the terminal leaves Folio running.
4. **Given** packaged Folio on Windows where `%LOCALAPPDATA%\Microsoft\WindowsApps` is on the user's PATH, **When** the user chooses the menu command, **Then** `folio.cmd` is written there without administrator rights and the confirmation tells the user to open a new terminal. `folio` then works from PowerShell and Command Prompt and returns to the prompt immediately.
5. **Given** a Windows setup where that folder is not on PATH, **When** the user chooses the menu command, **Then** `folio.cmd` is written to `%LOCALAPPDATA%\Folio\bin` and a message explains how to add that folder to PATH, offering **Copy Folder Path**.
6. **Given** Folio is running from an AppImage on Linux, **When** the user chooses the menu command, **Then** `~/.local/bin/folio` becomes a link to that AppImage file, without administrator rights and replacing any earlier link.
7. **Given** Folio on Linux is not running from an AppImage (for example a `.deb` install, which already provides `folio`), **When** the user opens the File menu, **Then** the install command is not shown.

---

### User Story 5 - Open items handed over by the macOS desktop (Priority: P5)

On macOS, files and folders reach Folio from the desktop as well as from a terminal: through Finder's Open With, by dropping them on Folio's Dock icon, or with `open -a Folio <path>`. These items follow the same rules as a command-line path, including when the hand-off is what starts Folio.

**Why this priority**: It completes "open this path in Folio" on macOS, where the desktop delivers items differently from a command line. It ranks lowest because the terminal route (stories 1 to 4) already covers the request.

**Independent Test**: On a packaged macOS build, quit Folio and run `open -a Folio notes.md`; then, with Folio running, drop a folder on the Dock icon. Confirm that the document opens and that the folder opens in folder mode.

**Acceptance Scenarios**:

1. **Given** Folio is not running, **When** a Markdown file is opened with Folio from Finder or with `open -a Folio notes.md`, **Then** Folio starts and shows that document in its first window.
2. **Given** Folio is running, **When** the desktop hands over a file or a folder, **Then** it opens in a new window (as specified by 007): a file as a document, a folder in folder mode.
3. **Given** a Markdown or plain-text file in Finder, **When** the user looks at its Open With choices, **Then** Folio is offered without becoming the default app for that type; and a folder dropped on Folio's Dock icon is accepted without Folio ever becoming the default app for folders.
4. **Given** a handed-over item was deleted before Folio processed it, **When** the hand-off is processed, **Then** it is ignored without an error.

---

### Edge Cases

- **The path does not exist**: it is skipped silently. With no other usable path, a first launch shows the Welcome document and a later launch only brings Folio to the front. Folio never creates a file from a launch path.
- **Several paths**: only the first argument that names an existing file or folder opens; the rest are ignored. Further paths need further launches, and each one opens its own window.
- **An argument that starts with `-`**: it is treated as an option and ignored, so a file named `-draft.md` has to be passed as `./-draft.md`.
- **A file that is not Markdown**: any existing file is accepted and shown as a document (for example a `.txt` file); there is no extension filter.
- **The file exists but cannot be read** (permissions, or removed during startup): an error message names the file and the reason, and the Welcome document is shown instead.
- **A folder without Markdown files**: folder mode opens with an empty explorer and the Welcome document. A folder that disappears before the window is ready falls back to the Welcome document without the explorer.
- **Development runs**: the application-folder argument of a development run (for example `.`) is skipped because it names the running copy's own folder. Known limitation: a development run that hands over to an already-running *packaged* Folio is not recognized as such, so the packaged copy opens the checkout folder in folder mode instead of the requested file.
- **Several desktop hand-offs while Folio is starting (macOS)**: if several items arrive before Folio has finished starting, only the last one opens. Once Folio is running, each hand-off opens its own window.
- **The terminal was already open when the command was installed**: that terminal does not see the new command, so every success message tells the user to open a new terminal.
- **A `folio` entry already exists at the target**: running the menu command again replaces it without asking. This also repairs the command after Folio or its AppImage was moved or updated, because the launcher records Folio's location at install time.
- **PowerShell started as a login shell on macOS**: `/usr/local/bin` may be missing from its PATH; the user guide gives the one line to add to the PowerShell profile.
- **Any other install failure** (for example a read-only disk): an error message gives the reason and Folio keeps running.

## Requirements *(mandatory)*

### Functional Requirements

**Launch path (User Story 1)**

- **FR-001**: When started with an argument that names an existing file, Folio MUST open that file as the document of its first window, exactly as File > Open… would: the title bar shows the file's name and the file is added to Open Recent.
- **FR-002**: When started with an argument that names an existing folder, Folio MUST open its first window in folder mode, with the file explorer visible and the folder's entry document displayed, as File > Open Folder… does (entry-document rules as specified by [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md)).
- **FR-003**: Folio MUST resolve relative path arguments against the working directory of the launch that supplied them.
- **FR-004**: Folio MUST skip empty arguments, arguments that start with `-`, arguments that do not name an existing file or folder, and the application-folder argument of a development run. It MUST use the first remaining argument and ignore any later ones.
- **FR-005**: Folio MUST accept any existing file, whatever its extension.
- **FR-006**: If the selected file cannot be read, Folio MUST show an error that names the file and the reason, and then show the Welcome document.
- **FR-007**: On macOS, when Folio starts with a path (including from a terminal, where the system does not bring it forward by itself), Folio MUST bring its window to the foreground.

**Running copy (User Story 2)**

- **FR-008**: Only one copy of Folio MUST run per user. A later launch MUST hand its arguments and its working directory to the running copy and then end without showing a window of its own.
- **FR-009**: The running copy MUST apply FR-001 to FR-005 to the handed-over arguments, resolving relative paths against the later launch's working directory, and MUST open the result in a new window (as specified by [007-multiple-windows](../007-multiple-windows/spec.md)) without replacing or discarding the content of any existing window.
- **FR-010**: When a handed-over launch has no usable path, the running copy MUST bring its most recently focused window forward, or open a new window with the Welcome document when no window is open.
- **FR-011**: After any handed-over launch, Folio MUST restore the affected window if it is minimized and bring it to the foreground on every platform, including on macOS when the launch came from a terminal.
- **FR-012**: Folio MUST never open its own application folder (the folder a development run passes as an argument) as a folder, and MUST NOT assume that a handed-over launch has the same number of leading arguments as the running copy, because the two may be packaged differently.

**Startup (User Story 3)**

- **FR-013**: When started without a usable path, Folio MUST show the bundled Welcome document as an untitled document.
- **FR-014**: Startup MUST NOT restore the previous session's document, folder, explorer visibility or outline visibility. The outline MUST start hidden, and the file explorer MUST start hidden unless a folder was named.
- **FR-015**: App-wide preferences (Style, Appearance, Page width, zoom, source mode, line numbers and window size) MUST still apply at startup.

**Installing the `folio` command (User Story 4)**

- **FR-016**: The File menu MUST offer "Install 'folio' Command in PATH…" on macOS and Windows, and on Linux only when Folio is running from an AppImage. Everywhere else the item MUST NOT appear.
- **FR-017**: On macOS the command MUST create or replace `/usr/local/bin/folio`, creating the folder if needed, as an executable launcher that starts this Folio installation with the user's arguments in the background and detached from the terminal, keeps the user's working directory, and works for files and folders whether or not Folio is already running.
- **FR-018**: On Windows the command MUST write `folio.cmd` to `%LOCALAPPDATA%\Microsoft\WindowsApps` when that folder is on the user's PATH, and to `%LOCALAPPDATA%\Folio\bin` otherwise. The launcher MUST start Folio with the user's arguments and return to the prompt immediately, from both PowerShell and Command Prompt.
- **FR-019**: In the Windows fallback case, Folio MUST tell the user that the launcher's folder is not yet on PATH, explain how to add it, and offer to copy the folder path.
- **FR-020**: On Linux the command MUST make `~/.local/bin/folio` a link to the AppImage file Folio is running from, creating the folder if needed and replacing any existing entry.
- **FR-021**: Installing MUST NOT edit PATH or any other system setting, and Folio MUST NOT request administrator rights itself on any platform.
- **FR-022**: On success, Folio MUST confirm what it created, show example usage for a file and for a folder, and remind the user to open a new terminal (and, on macOS and Linux, to make sure the folder is on PATH).
- **FR-023**: When the target cannot be written for lack of permission, Folio MUST show an equivalent copy-paste command the user can run by hand (macOS: a `sudo` one-liner; Linux: a create-folder-and-link one-liner; Windows: a PowerShell one-liner), with **Copy Command** and **Cancel** buttons, and copy the command to the clipboard on request.
- **FR-024**: Folio MUST report any other install failure together with its reason, and no install failure may crash or close Folio.

**macOS desktop hand-offs (User Story 5)**

- **FR-025**: On macOS, a file or folder handed over by the desktop (Finder, the Dock icon, `open -a`) MUST open by the same rules as a launch path: a file as a document, a folder in folder mode.
- **FR-026**: A hand-off that arrives while Folio is still starting MUST open in the first window. One that arrives while Folio is running MUST open in a new window (as specified by 007). A handed-over item that no longer exists MUST be ignored.
- **FR-027**: Folio MUST tell macOS that it can open Markdown and plain-text documents as an alternative (not default) app, and that it accepts folders without ever becoming the default app for folders.

**User guidance**

- **FR-028**: The user guide MUST document launching with a file or folder path (including relative-path resolution and what happens when Folio is already running), the install command on each platform with its manual fallback, the limits of `open -a` on macOS, and the PATH line that PowerShell login shells on macOS need.

### Key Entities *(include if feature involves data)*

- **Launch request**: the arguments and working directory of one launch (the first one or a handed-over one), or one item handed over by the macOS desktop. Each request yields at most one launch target.
- **Launch target**: an absolute path to a document or to a folder, or nothing. It decides what a new window shows: the document, folder mode, or the Welcome document.
- **`folio` launcher**: a small per-platform entry in a folder on PATH: a background-launch script on macOS, a command-prompt launcher on Windows, and a link to the AppImage on Linux. It records where Folio was installed at the time the command was run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the command installed, a single `folio <path>` line opens an existing file or folder, given as a relative or absolute path, with zero further clicks or dialogs on macOS, Windows and Linux (AppImage), in 100% of attempts, whether or not Folio is already running.
- **SC-002**: However many launches the user makes, the system shows exactly one running Folio, with one new window for each launch that named a usable path.
- **SC-003**: Starting Folio without a path shows the Welcome document, with the explorer and outline hidden, in 100% of launches, regardless of the previous session.
- **SC-004**: Installing the command takes one menu choice and at most one dialog. It needs zero manual PATH edits and zero administrator prompts on Windows (when `WindowsApps` is on PATH, the default) and on Linux (AppImage). On macOS, administrator rights are needed only when `/usr/local/bin` is not writable, and the complete manual command is then one click away.
- **SC-005**: On macOS and Windows, running `folio <path>` gives the terminal prompt back immediately, and closing that terminal leaves Folio running.
- **SC-006**: A handed-over path never costs the user unsaved work: after 100% of hand-offs, every existing window still holds its document and its unsaved edits.
- **SC-007**: Every install attempt ends in a visible result (confirmation, manual command or error reason) with zero crashes. After a permission failure, the manual command is on the clipboard after one click.
- **SC-008**: For 100% of launches, both first and handed-over, relative paths resolve from the directory in which the user typed the command.

## Assumptions

- The install command is meant for packaged builds. The launcher records the location of the Folio that installed it, so moving Folio (or installing the command from a development checkout) requires running the command again from the packaged app; see [research.md](./research.md).
- Installers, file associations and document icons are specified by [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md). A Linux `.deb` install already provides a `folio` command, which is why the menu item only appears for AppImages.
- Folder mode, the file explorer and the folder entry document (`_index.md`, then `README.md`, then `index.md`, otherwise the first Markdown file) are specified by [005-folder-mode-navigation](../005-folder-mode-navigation/spec.md).
- Opening a handed-over path in a new window, window cascading and the Window menu are specified by [007-multiple-windows](../007-multiple-windows/spec.md). This spec only requires that the path reaches the running copy and that Folio comes forward.
- The Welcome document and its "save as a new file" behavior are specified by [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md).
- On Windows 10 version 1709 and later, `%LOCALAPPDATA%\Microsoft\WindowsApps` is on the user's PATH by default. `~/.local/bin` is on PATH by default on most current Linux distributions, and `/usr/local/bin` is on the default macOS PATH (PowerShell login shells excepted).
- Because a handed-over path always opens a new window, the unsaved-changes prompt is never needed for it. At startup there is no earlier document to lose.
- A file dropped onto `Folio.exe` on Windows arrives as a launch path (User Story 1). Dropping a file onto an already open Folio window is not part of this feature.
