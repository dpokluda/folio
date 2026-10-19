# Research: Open From the Command Line & the `folio` Command

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Retroactive Phase 0. The Technical Context had no open questions, because the shipped code answers them. Each entry records a decision as it was built, mined from the commit messages of `f96fc39`, `5c48052`, `8563975`, `5c59ebc`, `61017d1` and `ac1ff4a` and from the explanatory comments in `src/main.js` and `src/menu.js`.

### 1. Finding the launch path among the arguments

- **Decision**: Scan the arguments after the executable and take the first one that names an existing file or directory. Skip empty arguments, anything that starts with `-`, and paths that do not exist. Accept any file type. This started as `fileArgFrom` (files only, `f96fc39`) and became `pathArgFrom`, which returns `{ path, isDir }` (`5c48052`).
- **Rationale**: The `f96fc39` message says "Path resolution is permissive (any existing file, not just .md)". Chromium/Electron switches and the development app-path argument can appear in argv, so a positional rule ("argv[1] is the file") is fragile. Requiring the path to exist and skipping `-` arguments keeps the scan robust without an options parser. Directory support (`5c48052`) lets `folio notes-folder` reuse folder mode.
- **Alternatives considered**: The initial build's `second-instance` matcher, `argv.find((a) => /\.(md|markdown|mdown|mkd|txt)$/i.test(a))` (`bd8f5ef`), was replaced: it refused other text files, never looked at the first launch's own argv, and did not resolve relative paths. A real option parser was not needed, because Folio defines no command-line options.

### 2. Recognizing the app-path argument and the sender's working directory

- **Decision**: Resolve every argument against `cwd`, which is the `workingDirectory` of `second-instance` or else `process.cwd()`. Skip the argument whose resolved path equals `path.resolve(app.getAppPath())`, instead of dropping a fixed number of leading arguments (`61017d1`).
- **Rationale**: From the code comment: "`second-instance` hands us the *other* process's argv — its packaging may differ from ours, so this process's `app.isPackaged` can't tell us how many leading arguments to drop." A relative path typed in a second terminal has to be resolved against that terminal's directory, not the running instance's.
- **Alternatives considered**: `argv.slice(app.isPackaged ? 1 : 2)` (`f96fc39` to `5c59ebc`) misread argv whenever the two processes were packaged differently. Resolving against the running instance's `process.cwd()` used the wrong directory for every hand-off.

### 3. Startup follows the launch path, not the last session

- **Decision**: Since `5c48052`: no path shows the Welcome document with no explorer and no outline; a file shows only that file; a folder opens folder mode with its entry document and no outline. `get-init` returns `outlineVisible: false` and sets `filesVisible` only for a folder launch. The stored `folder`, `filesVisible` and `outlineVisible` values are no longer consulted.
- **Rationale**: From the commit message: "Folio no longer restores the previously opened folder/pane state on launch. Startup now depends solely on the launch argument." Before this change, `get-init` restored the stored folder (`e2e2877`) and then opened the CLI file inside it, so a terminal launch could show an unrelated explorer and outline.
- **Alternatives considered**: Restoring the last folder and opening its entry document when no file was given (the `e2e2877` behavior, removed). Restoring pane visibility from settings (removed: "The outline is never shown automatically").

### 4. One running copy that comes to the front

- **Decision**: Keep the single-instance lock from the initial build (`bd8f5ef`) and make `second-instance` path-aware with the shared parser (`f96fc39`, folders in `5c48052`). The window is restored and focused, and on macOS `app.focus({ steal: true })` is called as well (`61017d1`). Since 007 (`8062af5`) the path opens in a new window, and `87e9165` (007) made the handler explicitly `restore()`, `show()` and `focus()` the target window, because "Windows/Linux won't hand the foreground to a process the user didn't just interact with". At first launch on macOS, focus is stolen only when a launch target exists (`61017d1`).
- **Rationale**: From the code comments: "The relaunched process was started from a terminal rather than LaunchServices, so macOS won't bring us forward on its own", and "On macOS the `folio` command execs the bundle binary directly instead of going through LaunchServices, so nothing brings the window to the front." A single instance keeps every window, and the one settings file they share, in one process.
- **Alternatives considered**: Letting each launch run as its own process with its own window, which the existing lock rules out. Opening the path in place behind the unsaved-changes guard (`openExternalPath`/`openExternalFolder`, `f96fc39`/`5c48052`), later replaced by 007's "opens the given path in a NEW window rather than stealing the current one".

### 5. macOS desktop hand-offs and document types

- **Decision**: Handle `app.on('open-file')`: call `preventDefault()`, then before `ready` hold the target for the first window, and after `ready` open it (since 007, in a new window) (`f96fc39`). Since `61017d1`, map the path through `launchTargetFor`, so a directory becomes `{ folder }` and a vanished path is ignored. Declare `CFBundleDocumentTypes` in `package.json`: "Markdown Document" (role Editor, `LSHandlerRank` Alternate, `net.daringfireball.markdown` and `public.plain-text`) and "Folder" (role Viewer, `LSHandlerRank` None, `public.folder`).
- **Rationale**: From the code comment: the event "can fire before the app is ready". `launchTargetFor` exists "so a directory always lands in file-explorer mode (same as File > Open Folder) no matter which route it arrived by: CLI argv, macOS `open-file`, or Finder." The Alternate and None ranks make Folio available for these items without taking over Markdown files or folders as their default handler.
- **Alternatives considered**: Treating every `open-file` path as a document (`f96fc39` to `5c59ebc`), which could not open folders. A `Default` or `Owner` handler rank, which would make Folio the default app for Markdown files or even for folders; the shipped ranks avoid that, in keeping with Principle II. File-association icons and Windows associations are owned by 002 (`59f97be`).

### 6. Offering the install as a File-menu command with per-OS availability

- **Decision**: One File-menu item, "Install 'folio' Command in PATH…", after Export to PDF… and behind a separator, with no accelerator. It was macOS-only (`8563975`, `isMac`), then gated by `canInstallShellCommand()`: macOS always, Linux only when `process.env.APPIMAGE` is set (`5c59ebc`), and Windows always (`ac1ff4a`). When unavailable, the item is left out of the menu rather than disabled.
- **Rationale**: From the comment in `src/menu.js`: "Mirrors VS Code's "Install 'code' command"." Hiding the item where it cannot work makes the platform difference explicit in the UI (Principle V). A `.deb` install already puts `folio` on PATH.
- **Alternatives considered**: Having the installers set up PATH. For Windows this was rejected explicitly (see entry 10). For macOS a DMG has no install step that could do it.

### 7. macOS launcher: run the bundle binary in the background instead of `open -a`

- **Decision**: Write `/usr/local/bin/folio` as `#!/bin/sh` followed by `nohup "<process.execPath>" "$@" >/dev/null 2>&1 &`, with `"`, `$`, backtick and `\` in the path backslash-escaped (`61017d1`). The first version (`8563975`) was `exec open -a "Folio" "$@"`.
- **Rationale**: From the code comment: "`open` hands arguments to LaunchServices, which delivers them as `open-file` events instead of on `process.argv`, and drops them entirely for an app that's already running. Executing the bundle binary keeps `folio <file>` and `folio <folder>` working in both cases — a second launch forwards its argv through the `second-instance` event." It is "the same approach VS Code's `code` command uses". Running the binary directly keeps the user's working directory for relative paths. The trailing `&` gives the prompt back, `nohup` keeps Folio alive when the terminal closes, and the redirections keep runtime logging out of the terminal.
- **Alternatives considered**: `exec open -a "Folio" "$@"` (`8563975`, replaced: no folders, lost arguments when Folio was running). Running the binary in the foreground (no `&`), which would tie up the terminal until Folio quits.

### 8. macOS location and the permission fallback

- **Decision**: Target `/usr/local/bin`, creating it with `mkdir -p` semantics and setting mode `0755` with an explicit `chmod` for files that already exist. On `EACCES`/`EPERM`, show a warning with a `sudo mkdir -p … && printf '…' | sudo tee /usr/local/bin/folio >/dev/null && sudo chmod 0755 /usr/local/bin/folio` one-liner and **Copy Command** / **Cancel** buttons (`8563975`). `5c59ebc` reworded the shared dialog to "needs different permissions" so that it also fits the user-folder cases.
- **Rationale**: From the code comment: "/usr/local/bin is on PATH by default on macOS." Folio never elevates itself. The user stays in control of `sudo`, and one click puts the exact command on the clipboard.
- **Alternatives considered**: A user-owned folder such as `~/bin`, which is not on the default macOS PATH and would need PATH editing (the very thing the request rules out). Prompting for administrator rights from within the app was not built; Folio only shows the command.

### 9. Linux: symlink the AppImage into `~/.local/bin`

- **Decision**: When `process.env.APPIMAGE` is set, create `~/.local/bin` if needed, unlink any existing `folio` (ignoring `ENOENT`) and `fs.symlinkSync($APPIMAGE, ~/.local/bin/folio)`. On a permission error, offer `mkdir -p "<bin>" && ln -sf "<AppImage>" "<bin>/folio"` (`5c59ebc`).
- **Rationale**: From the code comment: "an AppImage is a single executable file, so we simply symlink it into ~/.local/bin (the XDG user bin dir, on PATH by default on modern distros and writable without sudo — no wrapper script needed)". Unlinking first means the link can be repointed "after an update moved/renamed the file".
- **Alternatives considered**: A wrapper script like the macOS one, which was unnecessary because the AppImage is already a single executable. Offering the command for `.deb` installs, which is unnecessary because they already provide `folio` (README). A `/usr/local/bin` target, which would need `sudo`.

### 10. Windows: `folio.cmd` in `WindowsApps`, with a fallback folder

- **Decision**: Write `@echo off\r\nstart "" "<exe>" %*\r\n` (with `%` in the path doubled) to `%LOCALAPPDATA%\Microsoft\WindowsApps\folio.cmd` when `isOnPath()` finds that folder on PATH. Otherwise write to `%LOCALAPPDATA%\Folio\bin\folio.cmd` and show how to add that folder to PATH, with **Copy Folder Path**. On a permission error, offer a PowerShell `New-Item … ; Set-Content …` one-liner (`ac1ff4a`).
- **Rationale**: From the code comments: `WindowsApps` is on "the default user PATH (10/1709+) and … writable without administrator rights — so no PATH edit, no elevation and no sign-out are needed". "`start ""` is what keeps the shim from blocking the terminal … The empty first argument fills `start`'s window-title slot". `isOnPath` compares entries case-insensitively and ignores quotes and trailing separators, "which real PATH entries often have".
- **Alternatives considered**: Letting the NSIS installer edit PATH, rejected in the code comment: "the NSIS package is a one-click installer with no options page on which to ask consent, editing PATH from NSIS risks truncating a long PATH at NSIS's 1024-character string limit, and it wouldn't help anyone running an unpackaged or portable build." A launcher without `start`, which would block the terminal while Folio runs.

## Retroactive findings

**README ↔ code drift**

- README.md (How to use › Open a folder) still says "the last opened folder is remembered between launches". That has been false since `5c48052`: the `folder` setting is still written (`openFolder`, folder launches in `get-init`, and `doCloseFolder`, which sets it to `null`) but nothing reads it. `filesVisible` and `outlineVisible` are likewise written but ignored at startup. The comment in `boot()` in `src/renderer/renderer.js` ("Restore a previously opened folder … Visibility follows the stored preference") is stale for the same reason.
- README.md (the `folio` command on Linux) says "If the menu item is greyed out or missing". The item is never greyed out: when `canInstallShellCommand()` is false it is left out of the menu.
- README.md (the `folio` command on macOS) says the menu command may report that "it needs elevated permissions". Since `5c59ebc` the shared dialog says "needs different permissions".
- README.md order: the PowerShell-profile paragraph (`$env:PATH += ':/usr/local/bin'`) is macOS guidance, but `5c59ebc` inserted the Linux section and `ac1ff4a` the Windows section between the macOS section and that paragraph. It now reads as if it belonged to Linux.
- README.md says `open -a` delivers arguments "as file-open events (never folders) and drops them entirely when the app is already running". The code from the same commit (`61017d1`) declares a `public.folder` document type, maps folders arriving through `open-file` to folder mode, and handles `open-file` in a running instance by opening a new window. The README statements describe observed `open -a` behavior and were not re-verified for this record; the spec only requires that whatever macOS delivers is handled.
- README.md and `samples/welcome.md` say you can "drop a file onto the app (or `Folio.exe`)". That works only through the OS routes: the Dock icon on macOS (`open-file`) and the executable on Windows (argv). The renderer has no drop handler, so dropping onto an open window is outside this feature and its behavior was not verified.
- README.md says "Relative paths are resolved against the directory you ran the command from". That holds for the packaged program and the `folio` command. With the development form `npm start -- <path>`, npm runs the script from the package root, so relative paths resolve against the repository root. The packaged example `Folio path/to/notes.md` assumes the executable is invoked by its full path, since no packaged build puts `Folio` itself on PATH.

**Known limitations (from the code; items marked "inferred" were not run)**

- `pathArgFrom` skips only the app folder of the process that *receives* the arguments. A development launch (`npm start -- notes.md`, i.e. `electron . notes.md`) handed to a running **packaged** Folio still carries the checkout folder as its first path-like argument, so the packaged instance opens the checkout in folder mode instead of `notes.md` (inferred). This can happen because development runs are named `folio` (no top-level `productName` in `package.json`) and packaged builds `Folio`: on case-insensitive volumes, the macOS and Windows defaults, both names resolve to the same `userData` folder, so the two share the single-instance lock and `folio-settings.json` (inferred). `61017d1` fixed the reverse direction (a packaged `folio` handed to a development instance).
- Installing the command from an unpackaged development run embeds the Electron runtime (`process.execPath`) without the app folder, so that launcher would not start Folio (inferred). The `ac1ff4a` comment counts "unpackaged" builds among those the menu command helps, but only packaged and portable builds can work.
- Every launcher records the absolute path of the executable or AppImage at install time. Moving or renaming Folio needs a re-run of the menu command, and the re-run replaces the old entry.
- The macOS manual one-liner embeds the executable path inside a single-quoted `printf` format, so a path that contains `'` or `%` would produce a broken one-liner. The direct write, and the default `/Applications/Folio.app`, are unaffected.
- On Linux the `folio` symlink runs the AppImage in the terminal's foreground when Folio is not already running; there is no background hand-off like `nohup … &` on macOS or `start` on Windows (inferred). README.md does not mention it.
- If several `open-file` hand-offs arrive before `ready`, only the last one opens, because `pendingLaunchTarget` is overwritten. Extra command-line paths are ignored by design.
- On macOS, `folio` without a path on a first launch does not call `app.focus` (focus is stolen only when a launch target exists), so the window can open behind the terminal (inferred).
- An existing `folio` at the target is replaced without confirmation on all three platforms, even if it belongs to another tool.
- None of the six commit messages lists the platforms verified with `npm run dist`, as quality gate 4 requires.
