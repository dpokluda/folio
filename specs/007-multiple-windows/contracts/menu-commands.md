# Contract: Menu Commands for Multiple Windows

**Feature**: [../spec.md](../spec.md) | **Sources**: `src/menu.js` (`buildMenu`), `src/main.js` (`actions`, `rebuildMenu`, `listWindows`)

This contract covers the menu items this feature added (File > New Window and the Window menu) and the rule it introduced for every other menu command: commands act on the window in front. Commands owned by other features appear only to show how they are routed.

## File > New Window (`8062af5`)

| Property | Value |
|---|---|
| Label | `New Window` |
| Position | File menu, directly after `New` |
| Accelerator | `CmdOrCtrl+Shift+N` on all platforms |
| Enabled | Always, including on macOS with no window open |
| Action | `actions.newWindow()` calls `createWindow()` with no target. The new window shows Welcome, is placed by the cascade rule (see [window-lifecycle.md](./window-lifecycle.md)) and has its own Session. |

## Window menu (`5b4fe2e`)

The Window menu sits between **Themes** and **Help** and is a plain `label: 'Window'` submenu. It deliberately does not use `role: 'windowMenu'`, so macOS neither adds its own window list nor a `Cmd+M` Minimize. Items, in order:

| # | Item | Platforms | Accelerator | Enabled | Action |
|---|---|---|---|---|---|
| 1 | `Minimize` | all | none | always | `actions.minimizeWindow()` minimizes the focused Session's window. It does nothing when no window is open. |
| 2 | `Zoom` | macOS only | none | as the role decides | `role: 'zoom'`: toggles the front window between its zoomed and normal size |
| 3 | separator | all | | | |
| 4 | `Select Next Window` | all | macOS `` Cmd+` ``; Windows/Linux `Ctrl+Tab` | `windows.length > 1` | `actions.cycleWindow(1)` |
| 5 | `Select Previous Window` | all | macOS `` Cmd+Shift+` ``; Windows/Linux `Ctrl+Shift+Tab` | `windows.length > 1` | `actions.cycleWindow(-1)` |
| 6 | separator, then `Bring All to Front` | macOS only | none | as the role decides | `role: 'front'` |
| 7 | separator | all | | | |
| 8… | one radio item per open window | all | none | yes | `actions.focusWindow(id)` |
| 8 (alternative) | `(No open windows)` | all | none | disabled | shown only when no window is open |

**Window list items**: `label` is the window's label, which is the title without ` - Folio`, for example `• notes.md` (see [data-model.md §4](../data-model.md#4-window-title-and-window-menu-label)). `checked` is `true` only for the Session returned by `focusedSession()`. Items are ordered oldest first, in `sessions` insertion order.

**Minimize has no accelerator** because `CmdOrCtrl+M` is Format ▸ Inline Math (008). That item has a display-only accelerator, and the editor handles the key itself. A registered role accelerator would swallow the keystroke.

**Action semantics**

- `focusWindow(id)` calls `focusSessionWindow(sessions.get(id))`. Nothing happens if the Session is gone or its window is destroyed. Otherwise the window is restored if minimized, then shown and focused.
- `cycleWindow(delta)`:
  - `live` is the list of Sessions in creation order whose window is not destroyed. If it has fewer than 2 entries, nothing happens.
  - `index` is `live.indexOf(focusedSession())`.
  - The next Session is `live[0]` when `index === -1`, otherwise `live[(index + delta + n) % n]`, which wraps around at both ends.
  - That Session's window goes through `focusSessionWindow`.
- `minimizeWindow()` calls `focusedSession().win.minimize()` when a Session exists and its window is not destroyed.

## Focused-window routing for all menu actions (`8062af5`)

| Routing | Actions (menu item) | Applies to | With no Folio window open |
|---|---|---|---|
| `withSession(fn)` | `newFile` (New), `open` (Open…), `openFolder` (Open Folder…), `closeFolder` (Close Folder), `openRecent`, `save`, `saveAs`, `reload` (Reload from Disk), `exportPDF`, `openWelcome` / `openFormattingTour` (Help); later also `back` / `forward` (005) | the focused Session, or the most recently focused one | `createWindow()` first, then the command runs in it (see [research.md, finding 5](../research.md#retroactive-findings) for commands without a dialog) |
| `sendFocused('command', …)` | `toggleSource`, `toggleOutline`, `toggleFiles`, `zoomIn`, `zoomOut`, `zoomReset`, `find`; later also `toggleLineNumbers` and `format` (008) | the page of the focused Session | the command is dropped |
| `focusedSession()` directly | `findInFiles` (sends `find-in-files`, or shows the "open a folder first" hint on that window), `about`, `minimizeWindow`; later also `copyPath` (008) and `installShellCommand` (003) | the focused Session | no effect; About opens without a parent window |
| app-wide | `newWindow`, `focusWindow`, `cycleWindow`, `setStyleFamily`, `setAppearance`, `setPageWidth`, `clearRecent` | every window, or the registry | still works. A theme choice is stored and also applies to windows opened later. |

## Enable states and inputs computed per rebuild

`rebuildMenu()` takes `focusedSession()` once and passes these inputs to `buildMenu`:

| Input | Scope | Items it controls |
|---|---|---|
| `hasFolder` | focused Session (`currentFolder`) | File > Close Folder |
| `hasFile` (added in `8062af5`) | focused Session (`currentPath`) | File > Reload from Disk; later also File > Copy File Path (008) |
| `canGoBack`, `canGoForward` | focused Session (added by 005) | Go > Back, Go > Forward |
| `windows` (added in `5b4fe2e`) | all Sessions (`listWindows`) | the Window list and the Next/Previous enabled state |
| `styleFamily`, `appearance`, `pageWidth`, `recentFiles`, `lineNumbers` | shared store | Themes check marks, File > Open Recent, View > Show Line Numbers. The last one is the stored value, so it can differ from the window in front. |

**Rebuild triggers that belong to this feature**:

- window created (`createWindow`)
- window `focus`
- window `closed`, added in `5b4fe2e`
- a window's label changes (`updateTitle` compares it with `windowLabel`, added in `5b4fe2e`)

Other features also rebuild the menu, for example after a load, a save, opening or closing a folder, a theme change or Clear Recent.

## Existing commands that act per window (unchanged)

- **macOS File > Close Window** (`role: 'close'`, `Cmd+W`) closes the focused window through its own unsaved-changes guard.
- **Quit** (`role: 'quit'`) is File > Quit on Windows/Linux and Folio > Quit Folio on macOS. It sends `close` to every window, and each window passes its own guard.

## Platform matrix

| Item | macOS | Windows | Linux |
|---|---|---|---|
| File > New Window | `Cmd+Shift+N` | `Ctrl+Shift+N` | `Ctrl+Shift+N` |
| Window > Minimize | menu only | menu only | menu only |
| Window > Zoom | yes | hidden | hidden |
| Select Next / Previous Window | `` Cmd+` `` / `` Cmd+Shift+` `` | `Ctrl+Tab` / `Ctrl+Shift+Tab` | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Window > Bring All to Front | yes | hidden | hidden |
| Window list | yes | yes | yes |

README.md documents these differences in "Switch windows". Its macOS shortcut text is mis-escaped (see [research.md, finding 3](../research.md#retroactive-findings)).
