# Data Model: Open From the Command Line & the `folio` Command

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature adds no persisted setting. Its "data" is short-lived launch state in the main process, the values `get-init` hands to a new window, the way existing settings are (no longer) used at startup, and one launcher file per OS outside Folio's `userData`.

## 1. Launch argument scan

The result of reading one command line. Lives in `pathArgFrom(argv, cwd)` in `src/main.js`.

| Field | Type | Notes |
|---|---|---|
| input `argv` | `string[]` | `process.argv` at startup, or the *other* process's argv in `second-instance`. `argv[0]` (the executable) is always skipped. |
| input `cwd` | `string \| undefined` | `workingDirectory` from `second-instance`; defaults to `process.cwd()`. |
| output | `{ path: string, isDir: boolean } \| null` | `path` is absolute. `null` when no argument qualifies. |

**Validation rules** (applied in order to `argv.slice(1)`; the first qualifying argument wins):

1. Skip empty arguments and arguments that start with `-`.
2. Resolve with `path.resolve(cwd || process.cwd(), arg)`.
3. Skip the argument when it equals `path.resolve(app.getAppPath())` of the *receiving* process (the `.` or project-folder argument of a development run of the same checkout).
4. Skip when `fs.existsSync` is false.
5. `statSync().isFile()` → `{ path, isDir: false }`; `isDirectory()` → `{ path, isDir: true }`; anything else is skipped.
6. Any exception skips the argument and scanning continues.

History: `fileArgFrom` (files only, offset `app.isPackaged ? 1 : 2`) in `f96fc39`; renamed `pathArgFrom` with directories in `5c48052`; `cwd` parameter and identity-based app-path skip in `61017d1`.

## 2. Launch target

What a new window should open. It is the `openTarget` parameter of `createWindow(openTarget)` in `src/main.js`; the parameter shape was introduced by 007 (`8062af5`).

| Variant | Shape | Produced by |
|---|---|---|
| Document | `{ path: string }` | a file from `pathArgFrom`; `launchTargetFor(p)` for a non-directory |
| Folder | `{ folder: string }` | a directory from `pathArgFrom`; `launchTargetFor(p)` for a directory |
| Nothing | `null` | no qualifying argument; `launchTargetFor` when `statSync` throws (the item vanished) |

`launchTargetFor(target)` (`61017d1`) resolves the path and stats it; directories become `{ folder }`, everything else `{ path }`, and errors give `null` (the hand-off is ignored).

**Startup holder** (`pendingLaunchTarget`, a local of the app-lifecycle block in `src/main.js`):

```text
null ──(module load: pathArgFrom(process.argv) found a path)──▶ { path } | { folder }
  │                                                                  │
  └──(macOS open-file before ready: launchTargetFor(p) ≠ null)──▶ target (last one wins)
                                                                     │
app.whenReady ─▶ createWindow(pendingLaunchTarget) ─▶ [macOS & target ≠ null: app.focus({ steal: true })] ─▶ null
```

After `ready`, targets are not held: `second-instance` and `open-file` call `createWindow(target)` directly (a new window, 007).

## 3. Per-window pending open (`Session`)

Two one-shot fields on the `Session` of the window being created (`src/main.js`):

| Field | Type | Default | Set by | Consumed by |
|---|---|---|---|---|
| `pendingOpenPath` | `string \| null` | `null` | `createWindow({ path })` | `get-init` (set back to `null` before use) |
| `pendingOpenFolder` | `string \| null` | `null` | `createWindow({ folder })` | `get-init` (set back to `null` before use) |

These began as module-level globals in this feature (`pendingOpenPath` in `f96fc39`, `pendingOpenFolder` in `5c48052`) and moved onto the per-window `Session` with 007 (`8062af5`), as Principle IV requires.

## 4. Startup view (values returned by `get-init`)

Only the fields this feature drives; the full contract is in [contracts/startup-view.md](./contracts/startup-view.md).

| Field | Rule | Since |
|---|---|---|
| `folder` | `{ root, name, tree }` only when `pendingOpenFolder` names a directory that still exists; otherwise `null` | `5c48052` |
| `document` | precedence: the folder's entry document (`entryDocFor(tree)`) → the launched file → the Welcome document (`{ path: null, name: 'Welcome' }`, read from `samples/welcome.md`, built-in fallback text if unreadable) | `f96fc39`, `5c48052` |
| `settings.filesVisible` | `true` only when a folder launch succeeded | `5c48052` |
| `settings.outlineVisible` | always `false` | `5c48052` |
| `settings.sourceMode`, `lineNumbers`, `zoom` | still read from the store (unchanged by this feature) | — |

**Side effects** when a document comes from a launch: `session.currentPath`/`currentName` set, `store.addRecent(path)` (deduplicated, newest first, capped at `MAX_RECENT` = 10), dirty flag cleared, file watcher started, menu and title rebuilt. A folder launch also sets `session.currentFolder` and writes `store.set('folder', dir)`. An unreadable launched file triggers `dialog.showErrorBox('Folio — cannot open file', …)` and falls through to the Welcome document.

## 5. Settings keys affected (`DEFAULTS` in `src/store.js`)

| Key | Default | Before `5c48052` | Since `5c48052` |
|---|---|---|---|
| `folder` | `null` | restored at startup (stored folder + entry document) | still written (Open Folder, folder launch, Close Folder → `null`) but never read |
| `filesVisible` | `false` | restored at startup | still written; startup derives it from the launch target |
| `outlineVisible` | `false` | restored at startup | still written; startup always sends `false` |
| `recentFiles` | `[]` | — | a launched file is added like any opened file |

No key was added, renamed or reshaped, so no migration is needed (Principle IV).

## 6. `folio` launcher (install command)

Nothing is stored in settings. The launcher file is the only state, and every run overwrites it.

**Availability** (`canInstallShellCommand()`, re-evaluated by every `rebuildMenu()`):

| `process.platform` | Offered | Since |
|---|---|---|
| `darwin` | always | `8563975` (as `isMac`), `5c59ebc` |
| `win32` | always | `ac1ff4a` |
| `linux` | only when `process.env.APPIMAGE` is set | `5c59ebc` |
| anything else | never | `5c59ebc` |

**Per-platform launcher** (exact templates in [contracts/install-command.md](./contracts/install-command.md)):

| Platform | Target | Kind | Points at | Overwrite |
|---|---|---|---|---|
| macOS | `/usr/local/bin/folio` | `/bin/sh` script, mode `0755` | `process.execPath` (the bundle binary) | `writeFileSync` + `chmodSync` |
| Windows | `%LOCALAPPDATA%\Microsoft\WindowsApps\folio.cmd` when on PATH, else `%LOCALAPPDATA%\Folio\bin\folio.cmd` | batch file | `process.execPath` (`Folio.exe`) | `writeFileSync` |
| Linux | `~/.local/bin/folio` | symlink | `$APPIMAGE` | `unlinkSync` (`ENOENT` ignored) + `symlinkSync` |

**Install outcome state machine** (`installShellCommand()`):

```text
Idle ──menu click──▶ Writing
Writing ──ok──────────────────────────▶ Installed            (info dialog: what was created + usage)
Writing ──ok, Windows fallback folder──▶ InstalledNotOnPath   (info: add folder to PATH; [Copy Folder Path] → clipboard)
Writing ──EACCES / EPERM──────────────▶ PermissionFallback   (warning: manual command; [Copy Command] → clipboard)
Writing ──any other error─────────────▶ Failed               (error dialog with err.message; never rethrown)
Idle ──Linux without APPIMAGE─────────▶ NotAppImage          (info; unreachable from the menu, which hides the item)
Idle ──unsupported platform───────────▶ Unsupported          (info; unreachable from the menu)
(every outcome) ──dialog closed──▶ Idle
```

## 7. Process roles (single instance)

| Role | How it is decided | Behavior |
|---|---|---|
| Primary | `app.requestSingleInstanceLock()` returns `true` (lock from `bd8f5ef`) | Owns all windows; receives `second-instance(event, argv, workingDirectory)` |
| Secondary | the lock is not acquired | `app.quit()` immediately; Electron forwards its argv and working directory to the primary |
