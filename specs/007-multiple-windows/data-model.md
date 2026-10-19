# Data Model: Multiple Independent Windows

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature adds no files and no new settings keys. It splits state that used to be one global copy into **one Session per window**, which lives in memory in the main process. App-wide **shared preferences** stay in the existing settings store. The sections below describe that split, the registry that maps windows to Sessions, and the transient structures used to create, place, list and query windows.

## 1. Session (per-window document state)

Defined by `class Session` in `src/main.js`. It was introduced in `8062af5`, replacing the module-level globals `mainWindow`, `currentPath`, `currentName`, `isDirty`, `forceClose`, `currentFolder`, `pendingOpenPath` and `pendingOpenFolder`.

| Field | Type | Default | Written by | Meaning / rules |
|---|---|---|---|---|
| `win` | `BrowserWindow` | constructor argument | `createWindow` | The owning window. Every dialog about this document is parented to it. |
| `id` | number | `win.webContents.id` | constructor | Key in `sessions` and the id of the Window-menu item. Captured while `webContents` is alive so cleanup still works in `closed`. |
| `currentPath` | string \| null | `null` | `loadFile`, `doSaveAs`, `get-init`; `doNew`/`loadBuiltinDoc` reset it to `null` | Absolute path of the open file. `null` means untitled (New, Welcome, Formatting Tour). |
| `currentName` | string | `'Welcome'` | same as `currentPath` | Display name when untitled: `'Untitled'` after New, or the built-in document's name. |
| `isDirty` | boolean | `false` | `setDirty` (from `dirty-changed`, loads, saves) | Drives the `•` title marker, the close guard and the live-reload prompt. |
| `forceClose` | boolean | `false` | `close` handler after `promptUnsaved` resolves `true` | Lets the re-issued `close` skip the guard. |
| `currentFolder` | string \| null | `null` | `openFolder`, `doCloseFolder`, `get-init` | Root of this window's file explorer (folder mode is defined by 005). Drives `hasFolder`. |
| `pendingOpenPath` | string \| null | `null` | `createWindow({ path })` | File to open when the page boots. `get-init` consumes it once. |
| `pendingOpenFolder` | string \| null | `null` | `createWindow({ folder })` | Folder to open in explorer mode. `get-init` consumes it once, and it wins over `pendingOpenPath`. |
| `watchedPath` | string \| null | `null` | `watchCurrentFile` / `stopWatching` | File polled every 1 s for external changes (live reload is defined by 001). Polling stops in `closed`. |
| `watchListener` | function \| null | unset until first watch | `watchCurrentFile` | This window's poll listener. Removing it never affects another window that watches the same file. |
| `lastMtimeMs` | number | `0` | watcher, `doSave`, `reloadCurrentFile` | Last-seen modification time, used to ignore this window's own writes. |
| `history` | `{ path, anchor }[]` | `[]` | 005 (`4ebcdb2`) | Back/forward stack, one per window. |
| `historyIndex` | number | `-1` | 005 (`4ebcdb2`) | Position in `history`. |
| `windowLabel` | string \| null | `null` | `updateTitle` (`5b4fe2e`) | Last label shown in the Window menu. The menu is rebuilt only when this value changes. |

**Validation rules**

- A Session exists exactly while its window is open. `createWindow` creates it and the window's `closed` event deletes it.
- Only the main process mutates a Session. A window's page can influence only its own Session, through `dirty-changed` (coerced with `!!value`) and the request handlers that resolve `sessionFor(event.sender)`.
- Per-document fields are never written to the settings store, and Sessions are not restored on the next launch.

## 2. Session registry

| Name | Type | Rules |
|---|---|---|
| `sessions` | `Map<number, Session>` | Insertion order is creation order, which is also the Window-menu order and the order used by Select Next/Previous Window. |
| `lastFocusedSession` | `Session \| null` | Set when a window is created and on every `focus`. Cleared when that window closes. |

**Lookups**

- `sessionFor(webContents)` returns `sessions.get(webContents.id) ?? null`. IPC handlers use it.
- `focusedSession()` returns the focused window's Session, else `lastFocusedSession` if its window is not destroyed, else `null`. Menu actions use it.
- `withSession(fn)` runs `fn` with `focusedSession()`, or with `createWindow()` when that returns `null`. Document commands use it.

## 3. Window lifecycle (state transitions)

| From | Event | Condition | To | Effects |
|---|---|---|---|---|
| — | `createWindow(openTarget)` | — | Loading | The Session is created and registered and becomes `lastFocusedSession`. Size comes from the store and position from the cascade (section 7). The menu is rebuilt and the title set. |
| Loading | the page calls `get-init` | — | Open | The pending folder (preferred) or file is consumed; with neither, the window shows Welcome. History is seeded. |
| Open | `focus` | — | Open (in front) | `lastFocusedSession` points to this Session. The menu is rebuilt with the enable states and the Window-menu mark of this window. |
| Open | `close` | `!isDirty \|\| forceClose` | Closed | `persistWindowBounds` writes the shared `window` size. |
| Open | `close` | `isDirty && !forceClose` | Prompting | The close is prevented and `promptUnsaved(session)` shows Save / Don't Save / Cancel on this window. |
| Prompting | Save succeeded, or Don't Save | — | Closed | `forceClose = true`, then `win.close()` re-enters `close`, which persists the size. |
| Prompting | Cancel, or the save failed or timed out | — | Open | Nothing changes. Edits and the dirty flag are kept. |
| Closed | `closed` | — | removed | `stopWatching`, `sessions.delete`, `lastFocusedSession` cleared if it pointed here, menu rebuilt (the rebuild was added in `5b4fe2e`). |

When the user quits, the app sends `close` to every window, and each one follows the rows above on its own. When the last window closes, Windows and Linux quit and macOS keeps running (see [contracts/window-lifecycle.md](./contracts/window-lifecycle.md)).

**Dirty flag (per window)**

- Clean becomes dirty when the window's own page reports `dirty-changed(true)`.
- Dirty becomes clean after a successful Save or Save As, or when another document is loaded or reloaded in that window after the guard.
- Choosing Don't Save while closing discards the Session together with its flag.
- Each window's title and Window-menu label follow its own flag.

## 4. Window title and Window-menu label

- `base` is `basename(currentPath)` when there is a path, otherwise `currentName || 'Untitled'`.
- `label` is `(isDirty ? '• ' : '') + base`, and the window title is `label + ' - Folio'`.
- The menu entry uses `windowLabel || win.getTitle() || 'Untitled'`. Labels are not unique: two windows on `notes.md` both show `notes.md`.

## 5. Window list entry (menu model)

`listWindows(focused)` returns one `{ id: number, label: string, focused: boolean }` per Session whose window is not destroyed, in `sessions` order. `focused` is true for the Session returned by `focusedSession()`. An empty list makes the Window menu show a disabled `(No open windows)` entry. `src/menu.js` receives the list as the `windows` input of `buildMenu`. Next/Previous are enabled only when `windows.length > 1`.

## 6. Open target

The argument of `createWindow(openTarget)` is one of:

| Value | Opens | Produced by |
|---|---|---|
| `null` | Welcome | File > New Window, the `withSession` fallback, macOS `activate`, a second launch without a usable path when no window exists |
| `{ path: string }` | that file | the first launch, a second launch with a file, macOS `open-file` on a file |
| `{ folder: string }` | folder mode on that folder | the first launch, a second launch with a folder, macOS `open-file` on a folder |

Turning launch arguments into targets is owned by [003](../003-command-line-launch/spec.md). It includes resolving relative paths against the launching process's working directory, skipping options and the app path, and dropping paths that do not exist (`pathArgFrom`, `launchTargetFor`).

## 7. Cascade placement

`cascadeOrigin(width, height)` was added in `87e9165`.

- **Inputs**: the reference window, which is `BrowserWindow.getFocusedWindow()` or else the last entry of `BrowserWindow.getAllWindows()`; its position `[x, y]`; the work area of `screen.getDisplayNearestPoint({ x, y })`; and the new window's size from the store.
- **Output**: `{ x, y }`, or `{}` to let the OS choose the position.
- **Rules**:
  - With no reference window, or a destroyed one, the result is `{}`.
  - If a `screen` call throws, the result is `{}`.
  - Otherwise `x = refX + 30` and `y = refY + 30` (`CASCADE_STEP`).
  - If `x + width > area.x + area.width` or `y + height > area.y + area.height`, the result is `{ x: area.x, y: area.y }` instead.
- **Constraints carried by every window**: default size `1100 × 820`, minimum `640 × 480`, and the hardened `webPreferences` (see the plan's Constitution Check).

## 8. Pending main → renderer request

The request/response pair was added in `8062af5` and replaced `executeJavaScript`.

| Name | Type | Rules |
|---|---|---|
| `nextRequestId` | number | Starts at 1 and is incremented for every request, process-wide. |
| `pendingRequests` | `Map<number, { resolve, timer }>` | Holds one entry per save or export that is waiting for its window. |
| request | `{ id: number, kind: 'content' \| 'prepare-export' }` | Sent on `folio-request` to `session.win` only. |
| timeout | 4000 ms (`ask` default) | On expiry the entry is deleted and the promise resolves to the fallback. A late reply is then ignored. |
| fallback | `content` → `null`; `prepare-export` → `true` | `null` aborts the save (`doSave`/`doSaveAs` return `false`). `true` lets the export continue. |

The reply is matched by `id` only and the sender is not checked (see [research.md, finding 4](./research.md#retroactive-findings)). Payload details are in [contracts/ipc-channels.md](./contracts/ipc-channels.md).

## 9. Shared preferences

These keys are part of `DEFAULTS` in `src/store.js` (`folio-settings.json` in `userData`) and are unchanged by this feature. The table describes how each key behaves when several windows are open.

| Key | Type and default | Behavior across windows |
|---|---|---|
| `styleFamily` | `'fluent' \| 'github' \| 'word'`, default `'fluent'` | Set from any window. `pushThemeAll()` sends the new layer stack to every window and the menu is rebuilt (axes defined by 004). |
| `pageWidth` | `'dynamic' \| 'a4' \| 'letter'`, default `'dynamic'` | Same as `styleFamily`. It also sets the PDF page size for every window. |
| `appearance` | `'light' \| 'dark' \| 'system'`, default `'light'` | Applied through the process-wide `nativeTheme.themeSource`, so every window changes at once (004 and 011). |
| `recentFiles` | `string[]`, at most 10, default `[]` | Updated by opens and saves in any window. The menu rebuild makes every window show the same list. |
| `window` | `{ width, height }`, default `{ width: 1100, height: 820 }` | Written by `persistWindowBounds(session)` when a window closes and read by every `createWindow`. The position is never stored. |
| `sourceMode`, `zoom`, `lineNumbers` | boolean (`false`), integer step (`0`), boolean (`false`; added by 008) | Any view change in a window writes that window's full snapshot (`state-changed`), so the last writer wins. `get-init` seeds new windows from these values, and open windows are not updated. |
| `outlineVisible`, `filesVisible`, `folder` | boolean, boolean, string or null | Written from any window but never used to seed a new window. The outline starts hidden, and the explorer opens only for a folder launch (see 003 and 005). |

## 10. Per-window view state

Each window's page (`src/renderer/renderer.js`) keeps its own `state` object, seeded once from `get-init` and never synchronized with other windows. It holds source mode, outline, explorer visibility, line numbers, zoom, the document text, the folder tree and find state. Because of this, toggling source mode or zoom in one window never changes another open window.

## Relationships

- A **Session** belongs to exactly one window and its page, and each window has exactly one Session.
- All Sessions share the single **settings store**, which has one writer: the single running instance.
- **Window list entries** are derived one-to-one from live Sessions every time the menu is rebuilt.
- A **pending request** targets one Session's window. The target is not re-checked when the reply arrives.
