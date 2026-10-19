# Contract: Menu Commands, Shortcuts & Status-Bar Controls

**Feature**: [001 spec](../spec.md) | **Source**: `src/menu.js` (`buildMenu`), `src/main.js` (`actions`), `src/renderer/renderer.js` (`handleCommand`, key handlers), `src/renderer/index.html` (status bar)

This contract lists only the commands this feature introduced or changed. Other menu items belong to
other specs: Open Folder, Close Folder and the Go menu (005); New Window and the Window menu (007);
Copy File Path, the Format menu and Show Line Numbers (008); Find… and Find in Files… (006);
Install 'folio' Command in PATH… (003); and the Themes axes (004).

`CmdOrCtrl` means Cmd on macOS and Ctrl on Windows and Linux. "Guarded" means the action runs
`confirmDiscardIfDirty()` first (see [dialogs-and-title.md](./dialogs-and-title.md)).

## Application menu (macOS only), `bd8f5ef`

`Folio` ▸ About Folio (`role: about`, the native panel) · Services · Hide Folio · Hide Others ·
Show All · Quit Folio (`role: quit`). Quitting closes every window, and each dirty window prompts
(guarded through its `close` handler).

## File menu

| Item | macOS | Windows / Linux | Enabled when | Action | Introduced |
|---|---|---|---|---|---|
| New | `Cmd+N` | `Ctrl+N` | always | `doNew()`, guarded: empty untitled "Untitled" document | `bd8f5ef` |
| Open… | `Cmd+O` | `Ctrl+O` | always | `doOpen()`, guarded: open dialog, then `loadFile()` | `bd8f5ef` |
| Open Recent ▸ *file name* (sublabel: full path) | n/a | n/a | always | `loadFile(path)`. **Not guarded** (known gap, research.md finding 4) | `bd8f5ef` |
| Open Recent ▸ Clear Recent | n/a | n/a | shown only when the list is not empty | `store.clearRecent()`, then rebuild the menu | `bd8f5ef` |
| Open Recent ▸ (No recent files) | n/a | n/a | never (disabled placeholder shown when the list is empty) | none | `bd8f5ef` |
| Reload from Disk | `Cmd+R` | `Ctrl+R` | document has a file (`hasFile`) | `doReload()`, guarded: `reloadCurrentFile()` with `preserveScroll` | `8062af5` |
| Save | `Cmd+S` | `Ctrl+S` | always | `doSave()`, which falls back to `doSaveAs()` when untitled | `bd8f5ef` |
| Save As… | `Cmd+Shift+S` | `Ctrl+Shift+S` | always | `doSaveAs()` | `bd8f5ef` |
| Export to PDF… | none | none | always | `doExportPDF()` | `bd8f5ef` |
| Close (macOS, `role: close`) / Quit (Windows/Linux, `role: quit`) | role default | role default | always | closes the window or quits; dirty windows prompt | `bd8f5ef` |

## Edit menu, `bd8f5ef`

Undo, Redo, Cut, Copy, Paste and Select All are native roles that act on the focused editor or text
field. Find… was added in the same commit but is specified by 006.

## View menu

| Item | macOS | Windows / Linux | Action | History |
|---|---|---|---|---|
| Toggle Source Code Mode | `Cmd+/` | `Ctrl+/` | sends `command { name: 'toggle-source' }`, then `setSourceMode(!sourceMode)` | `bd8f5ef` |
| Toggle Outline | `Cmd+Alt+O` (native) | label hint `Ctrl+Alt+O`; the keystroke is handled by the page (`keydown`: Ctrl+Alt, no Shift or Meta, `KeyO`) | `command { name: 'toggle-outline' }`, then `setOutlineVisible(!outlineVisible)` | `CmdOrCtrl+Shift+O` (`bd8f5ef`) → `CmdOrCtrl+Shift+K` (`356cf20`) → `Ctrl/Cmd+Alt+O` with the Windows/Linux label hint (`68e67be`) |
| Zoom In | `Cmd+Plus` (native) | label hint `Ctrl++`; keys handled by the page | `command { name: 'zoom-in' }`, then `zoom(+1)` | `bd8f5ef`; Windows/Linux handling in `664668d` |
| Zoom Out | `Cmd+-` (native) | label hint `Ctrl+-`; keys handled by the page | `command { name: 'zoom-out' }`, then `zoom(-1)` | `bd8f5ef`; `664668d` |
| Reset Zoom | `Cmd+0` (native) | label hint `Ctrl+0`; keys handled by the page | `command { name: 'zoom-reset' }`, then `zoom(0)` | `bd8f5ef`; `664668d` |
| Toggle Full Screen | role default | role default | native `togglefullscreen` | `bd8f5ef` |
| Toggle Developer Tools | role default | role default | native `toggleDevTools` | `bd8f5ef` |

**Page-level zoom keys (Windows/Linux only, `664668d`)**: a capture-phase `keydown` listener, so the
source editor cannot swallow the keys, requires `Ctrl` and neither `Alt` nor `Meta`, and maps:

| Keys (`e.key` or `e.code`) | Command |
|---|---|
| `+`, `=`, `Equal`, `NumpadAdd` (with or without Shift) | zoom in |
| `-`, `_`, `Minus`, `NumpadSubtract` | zoom out |
| `0`, `Digit0`, `Numpad0` | reset |

The listener is installed only when `navigator.platform` (or the user agent) does not match `/Mac/i`.

## Themes menu (as shipped at 001, superseded by 004)

A radio list of the top-level `*.css` files in `themes/` (`listThemes()`, non-recursive, sorted),
labelled by `titleCaseTheme()` (`fluent-a4.css` → "Fluent A4", keeping `A4`, `US` and `PDF`
uppercase), with the active file checked. Choosing one stored `theme` and sent `set-theme`, or showed
"(No themes found)" when the list was empty. Since `1f452ec` the menu holds 004's Style, Appearance and
Page Width radio groups instead.

## Help menu

| Item | Action | Introduced |
|---|---|---|
| Welcome | `openBuiltinDoc('welcome')`, guarded, opens untitled | `9c3abe5` |
| Markdown Formatting Tour | `openBuiltinDoc('formatting-tour')`, guarded, opens untitled | `9c3abe5` |
| About Folio | `showAbout()` (see [dialogs-and-title.md](./dialogs-and-title.md)) | `bd8f5ef` |
| ~~Folio on GitHub~~ | opened the repository URL | `bd8f5ef`, removed in `8062af5` |

## Status-bar controls (`578e52e`)

| Control | Element | Behavior | State shown |
|---|---|---|---|
| Outline | `#btn-outline` (icon ☰ + "Outline") | `setOutlineVisible(!outlineVisible)` | `.active` while the outline is visible; tooltip "Toggle Outline (Ctrl/Cmd+Alt+O)" |
| Source / Exit Source | `#btn-source` (icon `</>` + `#btn-source-label`) | `setSourceMode(!sourceMode)` | `.active` and label "Exit Source" in source mode, "Source" otherwise; tooltip "Exit Source Code Mode (Ctrl/Cmd+/)" or "Toggle Source Code Mode (Ctrl/Cmd+/)" |
| Statistics | `#folio-stats` (`aria-live="polite"`) | read-only | `N words · N chars · N lines · ~N min read` |

The status bar's Files button (`#btn-files`) belongs to 005.
