# Research: Multiple Independent Windows

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Retroactive Record**: Reconstructed 2026-10-18 from commits `8062af5` (2026-07-14), `87e9165` (2026-08-06) and `5b4fe2e` (2026-08-10), from their code comments and from README.md. Each entry records a decision that was actually shipped. The Technical Context had no open questions, because every value is taken from the code.

### Per-window `Session` objects keyed by `webContents.id`

- **Decision**: Replace the module-level single-window globals in `src/main.js` with a `Session` class bound to one `BrowserWindow`. The globals were `mainWindow`, `currentPath`, `currentName`, `isDirty`, `forceClose`, `currentFolder`, `pendingOpenPath` and `pendingOpenFolder`. Sessions are stored in `sessions: Map<number, Session>`, keyed by `win.webContents.id`. The id is captured in the constructor "while webContents is alive", so the `closed` handler can still remove the entry. Later features add their per-window fields to the same object: `history`/`historyIndex` (005, `4ebcdb2`) and `windowLabel` (this feature, `5b4fe2e`).
- **Rationale**: The code comment says: "Folio supports multiple windows, each viewing its own document/folder. All per-document state lives on a Session bound to one BrowserWindow; IPC handlers resolve the sender's Session via sessionFor(), and menu actions act on the focused window's Session." With one object per window, a save, folder or file watcher cannot leak into another window. The Map's insertion order also gives a stable oldest-first order, which the Window menu reuses.
- **Alternatives considered**:
  - Keep the globals and track an "active window". Every asynchronous step would then race with focus changes, including dialogs, file-watcher callbacks and link navigation from a background window.
  - Keep per-document state only in each page. The main process needs the path, dirty flag and folder for dialogs, watchers, titles and menu state, and Principle III forbids relying on renderer-supplied state.
  - Run one OS process per window (see the next entry).

### One running instance; a second launch opens a new window

- **Decision**: Keep `app.requestSingleInstanceLock()`. In `second-instance`, a folder argument calls `createWindow({ folder })`, a file argument calls `createWindow({ path })`, and no argument brings the most recently focused window forward (or creates one). On macOS, `open-file` also creates a new window once the app is ready. Launch targets that arrive before the app is ready are kept in `pendingLaunchTarget` for the first window.
- **Rationale**: The code comment says: "A second launch (e.g. `folio some.md` while already running) opens the given path in a NEW window rather than stealing the current one." Before `8062af5`, the handler focused the only window and replaced its document after the unsaved-changes prompt (`openExternalPath`/`openExternalFolder` → `confirmDiscardIfDirty`). A new window needs no prompt and leaves the current work untouched. A single process also keeps one owner for `folio-settings.json` and one application menu that can list every window.
- **Alternatives considered**:
  - Allow multiple instances. Each process would hold its own copy of the settings and overwrite the other's writes, and no instance could list or switch to another instance's windows.
  - Keep replacing the current document after the guard, as before `8062af5`. That interrupts the user and contradicts the request.

### Routing: the event sender for IPC, the focused window for menus

- **Decision**: IPC handlers that act on a document use `sessionFor(event.sender)`: `get-init`, `dirty-changed`, `navigate` and `search-files`. Menu actions use `focusedSession()`, which returns the focused window's Session, else `lastFocusedSession` if that window is not destroyed, else `null`. Document commands go through `withSession(fn)`, which creates a window when there is no Session. View commands go through `sendFocused()`, which drops them when there is no Session. `rebuildMenu()` computes enable states (`hasFolder` and `hasFile`, later `canGoBack`/`canGoForward` from 005) from the focused Session and runs whenever a window gains focus.
- **Rationale**: The code comments say: "menu actions can fire on macOS with no window focused" and "creating a new window when none is focused (e.g. New/Open triggered on macOS with all windows closed)". There is a single application menu: macOS has one global menu bar, and `Menu.setApplicationMenu` gives Windows and Linux the same menu in every window. Rebuilding it on focus keeps one code path for all three platforms.
- **Alternatives considered**:
  - Per-window menus through `win.setMenu()` on Windows and Linux. macOS would still need the global menu, so there would be two mechanisms to keep in step.
  - Threading the `browserWindow` argument that menu `click` handlers receive through every action. Every builder in `src/menu.js` would have to forward it, and the argument does not exist in the macOS case with no window anyway.

### Main → renderer request/response instead of `executeJavaScript`

- **Decision**: `ask(session, kind, { timeoutMs = 4000, fallback })` sends `folio-request { id, kind }` to that window only. The preload's `onRequest` runs the page's `handleMainRequest(kind)` and replies with `folio-response { id, value }`. The main process resolves the pending promise by `id`, or resolves the fallback after 4 s: `content` falls back to `null`, which aborts the save, and `prepare-export` falls back to `true`, which lets the export continue. `doSave` now returns `true` only after a successful write, and `promptUnsaved` returns that result, so a window closes only when its content is really on disk.
- **Rationale**: The code comment says: "Rather than reach into the page with executeJavaScript() (which would run in the main world and bypass context isolation), we send a tokened request over `folio-request` and await the reply on `folio-response`." It continues: "Resolves to a fallback after a short timeout so a wedged renderer can't hang a save forever." `promptUnsaved` now reads: "Save — only proceed if the write actually succeeded." With several windows, every save must also read from the window that owns the document, which `send(session, …)` guarantees.
- **Alternatives considered**:
  - Keep `webContents.executeJavaScript('window.folio.getContent()')`. This was the old code: it needs a global in the page's main world and bypasses isolation.
  - Have each page push its text on every change. This is wasteful for large documents and can race with a save.
  - Use `ipcRenderer.invoke`. It is initiated by the page, so it cannot carry a question that the main process asks.

### What is shared and what is per window

- **Decision**:
  - **Per window**: document path and name, dirty flag, open folder, back/forward history, file watcher and window label (all on the Session), plus each window's live view state (source mode, outline, explorer, zoom, line numbers).
  - **Shared** in `src/store.js`: Style, Appearance and Page width, recent files, window size, and the last-used view values that seed each new window through `get-init`.
  - **Broadcast**: Style and Page width changes go to every window through `pushThemeAll()`. Appearance is app-wide by nature (`nativeTheme.themeSource`). View toggles are not broadcast.
- **Rationale**: The code comment says: "App-wide preferences (theme, appearance, page width, recent files, window size) stay in the shared `store`." README adds: "app-wide preferences such as the theme are shared." Constitution Principle IV now codifies the same split.
- **Alternatives considered**:
  - Per-window themes. This would be a per-document look that nobody asked for, and the Themes menu could not show a single check mark.
  - Broadcasting view toggles to every window. A source-mode toggle in one window would then flip another window the user is editing.

### Cascade placement for new windows

- **Decision**: `cascadeOrigin(width, height)` uses the focused window as the reference, or else the last entry of `BrowserWindow.getAllWindows()`. The new position is the reference's position plus `CASCADE_STEP = 30` on both axes. If the new window's right or bottom edge would pass the work area of the display nearest the reference's top-left corner, it is placed at that work area's origin instead. With no reference, or if a `screen` call throws, the function returns `{}` and the OS default position applies. Only the size is persisted. Every window goes through `createWindow()`, so New Window, a second launch and a Finder open all cascade the same way whenever another Folio window exists. A window created when none exist, at first launch or by a Dock click, gets the OS default position.
- **Rationale**: The code comment says: "Only the *size* is persisted, so without this every window would be created at the platform's default spot — landing pixel-perfectly on top of the window already there, which makes opening a second document look like the first one was replaced. Cascade each new window down-right from the frontmost one (the convention every multi-document app uses), wrapping back to the top-left of the display's work area when the offset would push the window off-screen."
- **Alternatives considered**:
  - Persist and reuse the last window position. Every new window would land on the same spot.
  - Keep the OS default placement. New windows stack exactly on top of each other, which is the problem being fixed.
  - Center every new window. It overlaps in the same way.

### Reliably bringing a window to the front

- **Decision**: `focusSessionWindow()` (Window menu, `5b4fe2e`) and the `second-instance` handler (`87e9165`) both restore a minimized window, then call `show()` and `focus()`. For terminal launches on macOS, the app also calls `app.focus({ steal: true })`, which 003 added in `61017d1`.
- **Rationale**: The code comments say: "a minimized window ignores focus() on Windows/Linux and just bounces in the Dock on macOS" and "Windows/Linux won't hand the foreground to a process the user didn't just interact with, so an existing or freshly created window can end up behind whatever is in front. Ask for it explicitly."
- **Alternatives considered**: The `8062af5` behavior: restore and `focus()` only in the no-path branch, while newly created windows were never explicitly brought forward. It left windows behind the terminal on Windows and Linux.

### Window menu design and shortcuts

- **Decision**: Build a custom `Window` menu rather than using Electron's `windowMenu` role. It contains:
  - Minimize, with no accelerator.
  - The `zoom` role (macOS only).
  - Select Next Window and Select Previous Window: `` Cmd+` `` / `` Cmd+Shift+` `` on macOS, `Ctrl+Tab` / `Ctrl+Shift+Tab` elsewhere, enabled only when more than one window is open.
  - The `front` role (macOS only).
  - One radio item per window, oldest first and checked on the focused window, or a disabled "(No open windows)" entry.

  Cycling follows the `sessions` order and wraps around. If the current window cannot be found, cycling starts at the first window.
- **Rationale**: The code comment says: "Each open window is listed by its document title with a radio mark on the focused one — without this there is no in-app way to reach a window hidden behind another. Minimize deliberately carries no accelerator: the conventional Cmd+M belongs to Format ▸ Inline Math here, and a registered role accelerator would swallow it." `` Cmd+` `` is the standard macOS shortcut for cycling an app's windows, and `Ctrl+Tab` is the usual document-switching shortcut on Windows and Linux.
- **Alternatives considered**:
  - Electron's `windowMenu` role. Its `minimize` item carries `Cmd+M` (Format ▸ Inline Math belongs to 008), and it does not list windows on Windows or Linux.
  - Relying on the OS window switchers only. Windows and Linux have no in-app list of Folio windows.

### Keeping the Window menu current without slowing typing

- **Decision**: Rebuild the application menu when a window is created, on every window `focus`, on `closed` (added in `5b4fe2e`), and when a window's label changes. The label is `•` plus the document name, cached in `Session.windowLabel` by `updateTitle`.
- **Rationale**: The code comment says: "The Window menu lists open windows by document title, so it has to follow renames and the dirty marker. Rebuild only when the text actually changes — setDirty fires on every keystroke and rebuilding the menu each time is slow."
- **Alternatives considered**:
  - Rebuild on every `updateTitle` call. That means a rebuild per keystroke while typing.
  - Debounce rebuilds with a timer. It adds latency and more state, and the label cache already removes the redundant rebuilds.

### What happens when the last window closes

- **Decision**: Keep the lifecycle that dates from `bd8f5ef`:
  - `window-all-closed` quits only on Windows and Linux (`process.platform !== 'darwin'`).
  - On macOS the app keeps running. `activate` (a click on the Dock icon) creates a window when none exist, the Window menu shows "(No open windows)", and document commands create a window through `withSession`.
- **Rationale**: Mac apps conventionally stay running without windows. The `withSession` comment in `8062af5` explicitly covers "macOS with all windows closed".
- **Alternatives considered**:
  - Quit on every platform, which is what README claims. It breaks the macOS convention and was never implemented.
  - Keep a hidden window alive. It wastes a renderer and complicates the window list.

## Retroactive findings

1. **README ↔ code drift (last window).** README's How to use says: "Folio runs as a single process on every platform, so closing the last window quits the app." `src/main.js` calls `app.quit()` from `window-all-closed` only when `process.platform !== 'darwin'`. On macOS Folio keeps running, `activate` re-creates a window, and menu document commands open one through `withSession`. The spec follows the code (FR-029). README should say that on macOS Folio stays in the Dock until you quit and that clicking the Dock icon opens a new window.
2. **Documentation lag when the feature shipped.** `8062af5` (2026-07-14) shipped File > New Window, per-window state and "second launch opens a new window" without changing README.md. Until `61017d1` (2026-08-04), README still said that a launch with a path "focuses the running window and opens it". New Window and multiple windows were first documented in `87e9165` (2026-08-06), and the Window menu in `5b4fe2e` (2026-08-10). For three weeks this missed today's Documentation gate. It has since been resolved, apart from finding 1.
3. **README Markdown defect.** The "Switch windows" item writes the macOS shortcuts as ``` `Cmd+\`` ``` and ``` `Cmd+Shift+\`` ```. Markdown does not honor backslash escapes inside code spans, so those shortcuts render garbled. A double-backtick span such as ``` `` Cmd+` `` ``` renders correctly.
4. **Request/response hardening gap (comment ↔ code).** The comment above `ask()` says that each request "is keyed to the owning window's webContents so replies can't cross wires between windows". In fact `pendingRequests` is keyed only by a global sequential `id`, and the `folio-response` listener does not compare `event.sender` with the window that was asked. It also does not type-check `value` before `doSave` writes it, although a non-`null` non-string would fail or be written as text. In practice the risk is low: pages run only Folio's bundle under `script-src 'self'`, and documents are sanitized (001). It is still short of Principle III's "resolve the calling window's session from the event sender". Follow-up: store the target `webContents.id` with each pending request, ignore replies from any other sender, and require a string for `content`.
5. **Possible race when a document command creates the window (found by reading the code, not reproduced).** On macOS with every window closed, `withSession` calls `createWindow()` and then runs the action synchronously. Commands that need no dialog send `load-document` before the new page has loaded, but the page registers `onLoadDocument` only after `getInit()` resolves, so the message is most likely lost and `get-init` shows Welcome instead.
   - **File > Open Recent**: the Session already records the recent file. The title shows that file's name while the page shows Welcome, and a later Save would write the Welcome text over the file. This risks Principle IV.
   - **File > New and Help > Markdown Formatting Tour**: only the title is wrong.
   - **File > Export to PDF**: it waits for the 4 s `ask()` timeout first.
   - **File > Open… and File > Open Folder…**: not affected, because the dialog gives the page time to load.

   Follow-up: pass the target through `createWindow({ path })`, as `second-instance` does, or queue sends until `get-init` has run.
6. **Undocumented behaviors** (correct by design, but not in README):
   - The window size is saved only when a window closes, so a new window takes the size of the most recently *closed* window. Positions are never saved.
   - Two windows with the same document name get identical Window-menu labels.
   - The renderer persists all view toggles as one snapshot (`persistState()`). The values that seed new windows therefore come from whichever window last changed any view toggle, and View > Show Line Numbers can disagree with the window in front.
   - A save whose content request times out fails silently: there is no error dialog, and the document stays unsaved.
   - When no Folio window is focused, the cascade reference is the last entry of the app's window list, not necessarily the frontmost window.
7. **Cosmetic.** `5b4fe2e` accidentally joined the first two lines of `withSession` (`function withSession(fn) {  let session = focusedSession();`). It has no effect on behavior.
