# Contract: Window Lifecycle and Launch Routing

**Feature**: [../spec.md](../spec.md) | **Sources**: `src/main.js` (`createWindow`, `cascadeOrigin`, `persistWindowBounds`, `updateTitle`, `second-instance`, `open-file`, `activate`, `window-all-closed`)

This contract defines what the single running Folio instance does when a window is requested, created, closed, or when the app is launched again. How a launch's arguments become a path (relative-path resolution, option skipping, files versus folders, the `folio` command) is owned by [003-command-line-launch](../../003-command-line-launch/spec.md).

## Single instance

- At startup the app calls `app.requestSingleInstanceLock()`. A process that does not get the lock calls `app.quit()` immediately.
- Electron passes the second process's `argv` and working directory to the first process's `second-instance` event.

## Events that create or focus windows

| Event | Platform | Condition | Result | Introduced |
|---|---|---|---|---|
| `app.whenReady()` | all | first launch | `createWindow(pendingLaunchTarget)`. The target comes from the launch arguments (003) or from a macOS `open-file` that arrived early. | `8062af5` |
| `second-instance` | all | the arguments contain an existing folder | `createWindow({ folder })` | `8062af5` |
| `second-instance` | all | the arguments contain an existing file | `createWindow({ path })` | `8062af5` |
| `second-instance` | all | no usable path | the window of `focusedSession()` (focused, or most recently focused), or `createWindow()` when there is none | `8062af5` |
| `second-instance` | all | after any of the rows above | the receiving window is restored if minimized, then `show()` and `focus()` | `87e9165` |
| `second-instance` | macOS | after any of the rows above | `app.focus({ steal: true })`, because terminal launches bypass LaunchServices | `61017d1` (003) |
| `open-file` | macOS | app ready | `createWindow(target)` in a **new** window | `8062af5` for files; `61017d1` (003) added folders via `launchTargetFor` |
| `open-file` | macOS | before ready | the target is kept as `pendingLaunchTarget` for the first window | `8062af5` |
| a document menu command | in practice macOS only | no Session exists | `withSession` → `createWindow()`, then the command runs in that window | `8062af5` |
| File > New Window | all | always | `createWindow()` | `8062af5` |
| `activate` (Dock click) | macOS | `BrowserWindow.getAllWindows().length === 0` | `createWindow()` | `bd8f5ef`; unchanged, now Session-backed |

A launch hand-off never replaces an existing window's document, so it never triggers an unsaved-changes prompt.

## Window creation: `createWindow(openTarget = null)`

1. **Size**: `store.get('window')`, falling back to `{ width: 1100, height: 820 }`. The minimum size is `640 × 480`.
2. **Position** (`87e9165`): the spread of `cascadeOrigin(width, height)`.
   - The reference is the focused window, or else the last entry of `BrowserWindow.getAllWindows()`.
   - The window is placed at `(refX + 30, refY + 30)`.
   - If the window would then cross the right or bottom edge of the work area of the display nearest the reference's top-left corner, it is placed at `(workArea.x, workArea.y)` instead.
   - With no reference, or when a `screen` call throws, no position is passed and the OS default applies.
   - Positions are never persisted.
3. **Web preferences**: preload `src/preload.js`, `contextIsolation: true`, `nodeIntegration: false`, `spellcheck: true`. The window-open handler denies every request; `http(s)` URLs go to the system browser. The `will-navigate` guard blocks navigation to anything other than `file://`. Those guards are specified by 001 and 005; this factory applies them to every window.
4. **Session**: a `new Session(win)` is created. `pendingOpenPath` or `pendingOpenFolder` is seeded from `openTarget`. The Session is registered in `sessions` and becomes `lastFocusedSession`.
5. **Handlers**:
   - `focus` sets `lastFocusedSession` and calls `rebuildMenu()`.
   - `close` runs the guard (see below).
   - `closed` calls `stopWatching`, deletes the Session from `sessions`, clears `lastFocusedSession` if it pointed to this Session, and calls `rebuildMenu()` (that call was added in `5b4fe2e`).
6. **Finish**: `rebuildMenu()`, `updateTitle(session)`, `applyAppearance()`, then return the Session.

## Closing a window

| Situation | Behavior |
|---|---|
| The window is clean, or `forceClose` is set | `persistWindowBounds(session)` stores this window's `[width, height]` as the shared `window` size, and the window closes. |
| The window is dirty | The close is prevented. `promptUnsaved(session)` asks on this window, with the message "Do you want to save the changes you made?" and the buttons Save (the default), Don't Save and Cancel. |
| The user chooses Save and the save succeeds | `forceClose = true`, then `win.close()` (the size is persisted on the way). |
| The user chooses Save and the save fails or times out | The window stays open and dirty. A timeout shows no message; a write error shows an error box. |
| The user chooses Don't Save | `forceClose = true`, then `win.close()`. |
| The user chooses Cancel | Nothing changes. |

**Quitting** (`role: 'quit'`) sends `close` to every window. Clean windows close, and every dirty window asks on its own. A window whose prompt is cancelled stays open.

## When the last window closes

| Platform | Behavior |
|---|---|
| Windows, Linux | `window-all-closed` → `app.quit()`. |
| macOS | The app keeps running with its menu bar. The Window menu shows `(No open windows)`. A Dock click (`activate`) or a document command opens a new window. View commands do nothing. |

> README.md says that closing the last window quits the app "on every platform". The macOS row above is the shipped behavior; see [research.md, finding 1](../research.md#retroactive-findings).

## Title

Each window's title is `[• ]<name> - Folio`. `<name>` is the basename of the open file, or the untitled name (`Welcome`, `Untitled`, `Markdown Formatting Tour`). The Window menu shows the same text without ` - Folio`. The menu is rebuilt only when that text changes.

## Platform summary

| Behavior | macOS | Windows | Linux |
|---|---|---|---|
| Second launch with a path | a new window, through the `folio` wrapper (003) or `open-file` from Finder | a new window | a new window |
| Second launch without a path | the most recently focused window is restored and focused, or a new Welcome window opens | same | same |
| Window brought forward on hand-off | restore + show + focus + `app.focus({ steal: true })` | restore + show + focus | restore + show + focus |
| Last window closed | the app keeps running; a Dock click opens Welcome | the app quits | the app quits |
| Close one window | File > Close Window (`Cmd+W`) or the close button | the close button or `Alt+F4` | the close button or the window manager's shortcut |
