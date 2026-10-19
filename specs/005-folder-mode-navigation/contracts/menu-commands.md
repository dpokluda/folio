# Contract: Menu Commands & Status-Bar Toggle

**Feature**: [../spec.md](../spec.md) | **Source**: `src/menu.js` (`buildMenu()`), `src/main.js` (`actions`, `rebuildMenu()`), `src/renderer/index.html`, `src/renderer/renderer.js`

The native menu is rebuilt from `buildMenu({ …, hasFolder, canGoBack, canGoForward, … })` on every `rebuildMenu()`. All inputs come from the focused window's `Session` (`focusedSession()`), so enablement always reflects the focused window. Actions run through `withSession(fn)`, which targets the focused window or creates one when none exists.

## Items introduced or changed by this feature

| Menu path | macOS | Windows / Linux | Enabled when | Action | History |
|-----------|-------|-----------------|--------------|--------|---------|
| File > Open Folder… | `Cmd+Shift+O` | `Ctrl+Shift+O` | Always | `actions.openFolder` → `doOpenFolder(session)`: unsaved-changes guard, then `dialog.showOpenDialog({ properties: ['openDirectory'] })`, then `openFolder(session, dir, { openEntry: true })` | `e2e2877` as `CmdOrCtrl+Shift+K`; `356cf20` changed it to `CmdOrCtrl+Shift+O` |
| File > Close Folder | `Cmd+Shift+W` | `Ctrl+Shift+W` | `hasFolder` (focused window has `currentFolder`) | `actions.closeFolder` → `doCloseFolder(session)` | `4a9cc98` |
| View > Toggle File Explorer | `Cmd+Alt+E` (native accelerator) | Label `Toggle File Explorer\tCtrl+Alt+E`; no registered accelerator, the renderer handles the keystroke | Always | `actions.toggleFiles` → `command { name: 'toggle-files' }` → `setFilesVisible(!state.filesVisible)` | `e2e2877` as `CmdOrCtrl+Shift+E`; `68e67be` (008) changed it to `ctrlAltItem('Toggle File Explorer', 'E', …)` |
| Go > Back | `Cmd+[` | `Alt+Left` | `canGoBack(session)`: `historyIndex > 0` | `actions.back` → `navigateHistory(session, -1)` | `4ebcdb2` |
| Go > Forward | `Cmd+]` | `Alt+Right` | `canGoForward(session)`: `0 ≤ historyIndex < history.length - 1` | `actions.forward` → `navigateHistory(session, +1)` | `4ebcdb2` |

Menu order (today): [Folio (macOS only)], File, Edit, **Go**, Format, View, Themes, Window, Help. The Go menu was inserted after Edit by `4ebcdb2`.

File menu order around these items: New, New Window, Open…, **Open Folder…**, **Close Folder**, Open Recent, …

## Windows/Linux keystroke handling for Toggle File Explorer

Since `68e67be` (008), non-macOS builds show `Ctrl+Alt+E` in the label (Chromium's Windows menu renderer would print "Alt+Ctrl+E"), and `boot()` in `src/renderer/renderer.js` installs a `keydown` listener when `navigator.platform` is not Mac: `Ctrl` + `Alt` (no `Shift`, no `Meta`) + `KeyE` → `setFilesVisible(!state.filesVisible)`, with `preventDefault()`.

## Status-bar button

| Element | Label / tooltip | Behavior |
|---------|-----------------|----------|
| `button#btn-files.folio-status-btn` (first button of `#folio-statusbar .folio-status-group`) | 📁 **Files**; `title="Toggle File Explorer (Ctrl/Cmd+Alt+E)"` (was `Ctrl/Cmd+Shift+E` until `68e67be`) | Click → `setFilesVisible(!state.filesVisible)`; carries the `active` class while the explorer is visible (`updateStatusButtons()`) |

## Enablement refresh points

`rebuildMenu()` runs after `loadFile()`, `openFolder()`, `doCloseFolder()`, `loadBuiltinDoc()`, `doNew()`, on every window `focus`, and whenever the title label changes, so Close Folder, Back and Forward always describe the focused window. Disabled items ignore their accelerators; `navigateHistory()` also bounds-checks the target index.

## Unsaved-changes guard per command

| Command | Guard position | Cancel result |
|---------|----------------|---------------|
| Open Folder… | Before the folder picker | Picker never opens; nothing changes |
| Close Folder | Before clearing the folder | Folder, explorer, document and history unchanged |
| Back / Forward | After the target-file existence check, before moving `historyIndex` | Document and position unchanged |
| Toggle File Explorer | None (does not replace the document) | Not applicable |
