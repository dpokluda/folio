# Contract: Menu Commands & Keyboard

**Feature**: [spec.md](../spec.md) | **Scope**: the commands and keys that this feature introduced or
changed. Folder commands (Open Folder, Close Folder, Toggle File Explorer) and Back/Forward belong
to 005.

## Menu commands

| Menu path | Accelerator (`src/menu.js`) | macOS | Windows / Linux | Enabled | Main-process action (`src/main.js`) | Renderer command |
|---|---|---|---|---|---|---|
| Edit ▸ Find… | `CmdOrCtrl+F` | Cmd+F | Ctrl+F | always | `actions.find` → `sendFocused('command', { name: 'find' })` | `find` |
| Edit ▸ Find in Files… | `CmdOrCtrl+Shift+F` | Cmd+Shift+F | Ctrl+Shift+F | always | `actions.findInFiles` (see below) | `find-in-files` |

**Provenance**:

- **Edit ▸ Find…** has existed since `bd8f5ef` (001). Back then it forced source mode and opened the
  editor panel; `2a26dea` gave it a separate behaviour for each mode. `8062af5` routed it to the
  focused window (007).
- **Edit ▸ Find in Files…** was added in `e126f54` and made per-window in `8062af5`.

Both items sit at the end of the Edit menu, after a separator, on every platform.

### `actions.findInFiles`, current behaviour

1. `session = focusedSession()`. If there is no session, do nothing.
2. If `session.currentFolder` is `null`, show
   `dialog.showMessageBox(session.win, { type: 'info', title: 'Find in Files', message: 'Find in Files searches an open folder.', detail: 'Open a folder first (File ▸ Open Folder) to search across its Markdown files.' })`
   and stop.
3. Otherwise call `send(session, 'command', { name: 'find-in-files' })`.

The menu item is never disabled. The guard is the dialog, unlike Close Folder (005), which is
disabled when no folder is open.

## Renderer handling (`handleCommand()` in `src/renderer/renderer.js`)

| Command | Rendered view | Source mode |
|---|---|---|
| `find` | `openFindBar()` shows `#folio-find`, focuses and selects the field, and runs `runFind(field value)`. | On the next animation frame, `openSearchPanel(editor)` opens CodeMirror's panel at the top (`search({ top: true })`). The view does not switch. |
| `find-in-files` | `openFileSearch()` calls `setFilesVisible(true)`, which persists `filesVisible`, then un-hides `#folio-files-search`, focuses it and selects its text. | Same as in the rendered view. |

When the source editor itself has focus, its `searchKeymap` binding `Mod-f` also opens the editor's
panel, so the result is the same.

## Keys inside the search surfaces

| Surface | Key / control | Effect |
|---|---|---|
| Find field (`#folio-find-input`) | typing (`input` event) | `runFind()` with no delay; the first match becomes current. |
| | Enter | `findStep(+1)`: next match, wrapping from last to first. |
| | Shift+Enter | `findStep(-1)`: previous match, wrapping from first to last. |
| | Esc | `closeFindBar()`: hides the bar and clears all highlights. The field keeps its text. Esc does nothing when focus is outside the field. |
| Find bar buttons | ↑ `#folio-find-prev` / ↓ `#folio-find-next` | Previous / next match, after which focus returns to the field. |
| | ✕ `#folio-find-close` | `closeFindBar()`. |
| Mode switch | `Ctrl/Cmd+/` or the status-bar Source button into source mode | `setSourceMode(true)` closes the find bar. |
| Find-in-Files box (`#folio-files-search`) | typing | `scheduleFileSearch()`: one search 180 ms after the last keystroke. |
| | Enter | Clears the timer and calls `runFileSearch()` immediately. |
| | Esc | `hideFileSearch()`: clears the box, hides it and restores the tree. In the rendered view it then tries `$preview.focus?.()`. |
| Result rows | click on a `.files-result-file` heading or a `.files-result-match` row | `openSearchResult(file.path, query)`: see [ipc-search-files.md](./ipc-search-files.md) and data-model §3. |

## Platform notes (Principle V)

- Every accelerator uses `CmdOrCtrl` semantics, and there is no platform-specific code path.
- Neither command needs the renderer-side keyboard fallback that some View-menu items use on Windows
  and Linux (the `Ctrl+Alt` explorer and outline toggles, and Zoom). Those fallbacks exist because of
  how Electron labels `Ctrl+Alt` accelerators and how it maps `Plus`. Neither problem affects these
  plain letter accelerators, which Electron registers natively on all three platforms.
- README.md ▸ How to use documents both commands.
