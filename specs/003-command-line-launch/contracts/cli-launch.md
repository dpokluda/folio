# Contract: Command-Line Launch and Hand-Off

**Feature**: [../spec.md](../spec.md) | **Implements**: FR-001 to FR-012, FR-025 to FR-027

**Code**: `pathArgFrom`, `launchTargetFor` and the app-lifecycle block (`requestSingleInstanceLock`, `second-instance`, `open-file`, `whenReady`) in `src/main.js`; `build.mac.extendInfo` in `package.json`.

**Introduced/changed by**: `f96fc39`, `5c48052`, `61017d1` (this feature); `8062af5` and `87e9165` (007: a new window per hand-off; explicit restore, show and focus of the target window).

## Invocation forms

| Platform | Development checkout | Packaged program | Installed `folio` command |
|---|---|---|---|
| any | `npm start -- <path>` (run from the repository root, see note) | — | — |
| macOS | — | `/Applications/Folio.app/Contents/MacOS/Folio <path>`; `open -a Folio <path>` (desktop hand-off, see below) | `folio <path>` runs the bundle binary in the background |
| Windows | — | `<install folder>\Folio.exe <path>`; a file dropped onto `Folio.exe` | `folio <path>` runs `start "" "<Folio.exe>" <path>` |
| Linux | — | `./Folio-<version>.AppImage <path>`; a `.deb` install provides `folio <path>` | `folio <path>` is a symlink to the AppImage |

Note: npm runs the `start` script from the package root, so with `npm start -- <path>` a relative path resolves against the repository root. Every other form resolves against the caller's directory.

## Synopsis

```text
folio [argument …]
```

- Folio defines **no options**. Every argument that starts with `-` is ignored, which also covers runtime switches added by the OS or the framework. There is no `--` end-of-options marker; pass `./-name.md` for a file whose name starts with `-`.
- **At most one path is used**: the first argument that, after resolution, names an existing file or directory. Later arguments are ignored.
- **Resolution**: `path.resolve(<working directory of this launch>, argument)`. The development app-path argument (`.` or the project folder) is skipped by identity, never by position: it is compared with `path.resolve(app.getAppPath())` of the process that *receives* the arguments.
- **File types**: any existing file is accepted (no extension filter). Directories select folder mode.
- Arguments that do not exist, or that cannot be stat'ed, are skipped silently.

## First launch (no running instance)

| Selected argument | First window shows | File explorer | Outline | Brought forward |
|---|---|---|---|---|
| none | Welcome document (untitled) | hidden | hidden | OS default (Folio does not steal focus) |
| readable file | that file (title = file name, added to Open Recent, watched for changes) | hidden | hidden | macOS: `app.focus({ steal: true })` |
| unreadable file | error box `Folio — cannot open file` (`<path>\n\n<reason>`), then the Welcome document | hidden | hidden | macOS: steal |
| folder | folder mode, entry document per 005 (Welcome document when the folder has no Markdown) | shown | hidden | macOS: steal |
| folder gone before the window is ready | Welcome document | hidden | hidden | macOS: steal |

App-wide preferences (theme axes, zoom, source mode, line numbers, window size) apply in every row. The startup values are listed in [startup-view.md](./startup-view.md).

## Hand-off to a running instance

```text
second launch                         running instance (primary)
─────────────                         ──────────────────────────
requestSingleInstanceLock() → false
app.quit()  ── argv, workingDirectory ──▶ second-instance(event, argv, workingDirectory)
                                         arg = pathArgFrom(argv, workingDirectory)
                                         folder → createWindow({ folder })      (new window, 007)
                                         file   → createWindow({ path })        (new window, 007)
                                         none   → focusedSession() ?? createWindow()
                                         restore() if minimized; show(); focus() (87e9165, 007)
                                         macOS: app.focus({ steal: true })       (61017d1)
```

Guarantees:

- The second process never opens a window and exits right after the lock check. There is no exit-code or stdout contract.
- No existing window's document, folder or unsaved edits are touched (Principle IV).
- Relative paths use the **second launch's** working directory.
- The running copy skips only its *own* app folder and never assumes a fixed number of leading arguments, so a packaged launch handed to a development run is read correctly (`61017d1`). The reverse is not handled: a development launch handed to a running packaged Folio still carries its checkout folder as the first path, and the packaged copy opens that folder in folder mode (see [../research.md](../research.md#retroactive-findings)).

## macOS desktop hand-off (`open-file`)

| Step | Behavior |
|---|---|
| Event | `app.on('open-file', (e, filePath) => …)`, always `e.preventDefault()` |
| Mapping | `launchTargetFor(filePath)`: directory → `{ folder }`, other → `{ path }`, stat error → `null` (ignored) |
| Before `ready` | stored in `pendingLaunchTarget` (a later hand-off replaces an earlier one; only the last opens) and opened by the first window; focus is stolen on macOS |
| After `ready` | `createWindow(target)`, a new window (007) |

### Declared document types (Info.plist via `build.mac.extendInfo.CFBundleDocumentTypes`)

| `CFBundleTypeName` | `CFBundleTypeRole` | `LSHandlerRank` | `LSItemContentTypes` | Added |
|---|---|---|---|---|
| Markdown Document | Editor | Alternate | `net.daringfireball.markdown`, `public.plain-text` | `61017d1` (`CFBundleTypeIconFile: document.icns` added later by 002 in `59f97be`) |
| Folder | Viewer | None | `public.folder` | `61017d1` |

`Alternate` lets Finder offer Folio for Markdown and plain text without making it the default app. `None` lets the Dock icon and `open -a` accept folders while Folio never becomes a folder handler.
