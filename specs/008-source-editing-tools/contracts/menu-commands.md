# Contract: Menu Commands & Keyboard Shortcuts

**Feature**: [spec.md](../spec.md) | **Source**: `src/menu.js` (`buildMenu`), `src/main.js` (`actions`, `rebuildMenu`), `src/renderer/renderer.js` (`formattingKeymap`, `boot()` keydown handler) | **Introduced in**: `68e67be`

This contract covers the native menu items this feature adds or changes and how their shortcuts reach the code. "CmdOrCtrl" means Cmd on macOS and Ctrl on Windows and Linux. "Alt" is the Option key on macOS.

## Menu bar order

- **At `68e67be`**: (macOS app menu) · File · Edit · **Format** · View · Themes · Help.
- **Today**: (macOS app menu) · File · Edit · Go · **Format** · View · Themes · Window · Help. Go was added by `4ebcdb2` and Window by `5b4fe2e` (both 007).

## File menu

The new item is placed after Save As…, with a separator above and below it, and before Export to PDF….

| Item | Accelerator | Registered | Enabled when | Action |
|---|---|---|---|---|
| Copy File Path | `CmdOrCtrl+Shift+C` | yes (normal menu accelerator) | `hasFile`: the focused window's Session has a `currentPath` | `actions.copyPath()` → `copyDocumentPath()` |

**Postconditions**:

- When the item is enabled, the system clipboard holds `Session.currentPath` as plain text, and that window shows the toast "Path copied to clipboard".
- When the action runs without a path, nothing is copied and the toast reads "Save the document first to copy its path".
- When there is no window at all, nothing happens.

The item works in both the rendered view and source mode. `rebuildMenu()` refreshes the enabled state on window focus, open, New, built-in documents and Save As.

## Format menu (new)

Each item is built by `fmt(label, accel, kind)` with `registerAccelerator: false` and `click: () => actions.format(kind)`. No item has an `enabled` flag, so every item is always enabled.

| # | Item | Displayed accelerator | `kind` | Editor binding |
|---|---|---|---|---|
| 1 | Bold | `CmdOrCtrl+B` | `bold` | `Mod-b` |
| 2 | Italic | `CmdOrCtrl+I` | `italic` | `Mod-i` |
| 3 | Underline | `CmdOrCtrl+U` | `underline` | `Mod-u` |
| 4 | Strikethrough | `CmdOrCtrl+Shift+X` | `strikethrough` | `Mod-Shift-x` |
| 5 | Inline Code | `CmdOrCtrl+E` | `code` | `Mod-e` |
| 6 | Code Block | `CmdOrCtrl+Shift+E` | `codeblock` | `Mod-Shift-e` |
| 7 | Link | `CmdOrCtrl+K` | `link` | `Mod-k` |
| — | *separator* | | | |
| 8 | Inline Math | `CmdOrCtrl+M` | `math` | `Mod-m` |
| 9 | Math Block | `CmdOrCtrl+Shift+M` | `mathblock` | `Mod-Shift-m` |
| — | *separator* | | | |
| 10–15 | Heading 1 … Heading 6 | `CmdOrCtrl+1` … `CmdOrCtrl+6` | `h1` … `h6` | `Mod-1` … `Mod-6` |

**Routing**:

- **Keyboard**: `formattingKeymap` is installed with `Prec.highest` in the source editor and handles the keystroke in place. Each binding returns `true`, so CodeMirror calls `preventDefault`. It outranks CodeMirror's `defaultKeymap` and `historyKeymap` (for example `Mod-i` selectParentSyntax and `Mod-u` undoSelection) and the browser's native Ctrl+B/I/U.
- **Mouse**: `click` → `actions.format(kind)` → `sendFocused('command', { name: 'format', format: kind })` → `handleCommand` → `applyFormat(kind)`.
- **Display-only accelerators**: `registerAccelerator: false` is honored on Windows and Linux only. On macOS, Electron always registers menu key equivalents, so a keystroke may reach the command through the menu path instead of the editor keymap. Both paths run the same transform once; see research.md, finding 6.

**Behavior by context**:

| Context | Keyboard shortcut | Menu click |
|---|---|---|
| Source mode, editor has focus | Command applied once by the editor keymap | Command applied, then `editor.focus()` |
| Source mode, focus in the editor's find panel or the Find in Files box | Not handled by the editor's keymap | Command applied to the editor's selection, then `editor.focus()` |
| Rendered view | Document unchanged. On Windows and Linux the keystroke is ignored; on macOS it may reach the menu item (see research.md, finding 6) | Document unchanged; toast "Switch to Source mode (Ctrl/Cmd+/) to format text" |

The text each command produces is specified in [formatting-commands.md](./formatting-commands.md).

## View menu (changed)

| Item | macOS | Windows / Linux | Change |
|---|---|---|---|
| Toggle Source Code Mode | `Cmd+/` | `Ctrl+/` | Unchanged (001) |
| Toggle File Explorer | Native accelerator `Cmd+Alt+E` | Label `Toggle File Explorer\tCtrl+Alt+E`, no accelerator; the keystroke is handled by the renderer | Was `CmdOrCtrl+Shift+E` (005, `e2e2877`) |
| Toggle Outline | Native accelerator `Cmd+Alt+O` | Label `Toggle Outline\tCtrl+Alt+O`, no accelerator; handled by the renderer | Was `CmdOrCtrl+Shift+K` (`356cf20`) |
| Show Line Numbers | Checkbox, no accelerator | Same | **New.** `checked: !!lineNumbers` (stored value); `click: () => actions.toggleLineNumbers()` |

Both pane toggles are built by `ctrlAltItem(label, letter, onClick)`. On Windows and Linux the label text keeps the conventional "Ctrl+Alt+…" order, because Chromium's Windows menu renderer would print a native accelerator as "Alt+Ctrl+…".

**Renderer keydown contract (non-macOS only)**: In `boot()`, a `window` `keydown` listener handles the two pane toggles. It is registered only when `navigator.platform` (falling back to `navigator.userAgent`) does not match `/Mac/i`, and it runs in the bubbling phase.

| Condition | Action |
|---|---|
| `ctrlKey && altKey && !shiftKey && !metaKey` and `e.code === 'KeyE'` | `preventDefault()`, then `setFilesVisible(!state.filesVisible)` |
| Same modifiers and `e.code === 'KeyO'` | `preventDefault()`, then `setOutlineVisible(!state.outlineVisible)` |

## Status bar tooltips (changed)

| Button | Tooltip |
|---|---|
| `#btn-files` | "Toggle File Explorer (Ctrl/Cmd+Alt+E)" |
| `#btn-outline` | "Toggle Outline (Ctrl/Cmd+Alt+O)" |

## Reserved-shortcut notes for other features

- `CmdOrCtrl+Shift+E` belongs to Format ▸ Code Block, so no other command may register it.
- `Cmd+M` / `Ctrl+M` belongs to Format ▸ Inline Math. Window ▸ Minimize (007, `5b4fe2e`) therefore has no accelerator.
- `CmdOrCtrl+Shift+C` belongs to File ▸ Copy File Path. Typora uses the same chord for "Copy as Markdown".
