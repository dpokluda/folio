# Implementation Plan: Open From the Command Line & the `folio` Command

**Branch**: `003-command-line-launch` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-command-line-launch/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `f96fc39` (2026-07-09), `5c48052` (2026-07-14), `8563975` (2026-07-14), `5c59ebc` (2026-07-21), `61017d1` (2026-08-04) and `ac1ff4a` (2026-09-16); describes the design as implemented. Where 007's commits `8062af5` (2026-07-14) and `87e9165` (2026-08-06) reshaped the same code paths (a new window per hand-off; explicit restore, show and focus of the target window), this plan names them but does not re-specify them.

## Summary

Folio reads a file or folder path from its launch arguments and opens it in the first window (file → document, folder → folder mode with the entry document), resolving relative paths against the working directory of the launch. With no usable path it shows the bundled Welcome document and never restores the previous session's document, folder or panes. The single-instance lock that has existed since the initial build forwards every later launch (its argv and working directory) to the running instance through `second-instance`; the running instance parses the path with the same rules, opens it (since 007, in a new window) and comes to the front, using `app.focus({ steal: true })` on macOS. macOS desktop hand-offs (`open-file` from Finder, the Dock or `open -a`) go through the same file-or-folder mapping, backed by `CFBundleDocumentTypes` declarations. File > Install 'folio' Command in PATH… writes one launcher per OS: on macOS a `/bin/sh` wrapper in `/usr/local/bin` that runs the bundle binary with `nohup … &` (with a copy-paste `sudo` one-liner when the folder is not writable); on Windows a `folio.cmd` using `start ""` in `%LOCALAPPDATA%\Microsoft\WindowsApps` (falling back to `%LOCALAPPDATA%\Folio\bin` with instructions); on Linux a `~/.local/bin/folio` symlink to `$APPIMAGE`, offered only when running from an AppImage.

## Technical Context

**Language/Version**: JavaScript (CommonJS, Electron main process). Electron ^31.3.1 with electron-builder ^24.13.3 when `f96fc39`, `5c48052`, `8563975` and `5c59ebc` landed; Electron ^43.2.0 with electron-builder ^26.15.3 for `61017d1` and `ac1ff4a` (upgraded in `57f8363` on 2026-08-03 after Apple revoked notarization for Electron 31.7.7, see `docs/macos-gatekeeper.md`).

**Primary Dependencies**: Electron `app` (`requestSingleInstanceLock`, the `second-instance` event with `argv` and `workingDirectory`, the macOS `open-file` event, `getAppPath`, `isReady`/`whenReady`, `focus({ steal: true })`), `dialog` (`showMessageBox`, `showMessageBoxSync`, `showErrorBox`), `clipboard`, `Menu`; Node built-ins `fs`, `path`, `os`; electron-builder `build.mac.extendInfo` for the Info.plist `CFBundleDocumentTypes`. No new npm dependency.

**Storage**: No new settings. Since `5c48052` the `folder`, `filesVisible` and `outlineVisible` keys of `folio-settings.json` (Electron `userData`, owned by `src/store.js`) are no longer read at startup; a launched file is added to `recentFiles`. Outside `userData` the feature writes exactly one launcher per OS: `/usr/local/bin/folio` (macOS), `%LOCALAPPDATA%\Microsoft\WindowsApps\folio.cmd` or `%LOCALAPPDATA%\Folio\bin\folio.cmd` (Windows), `~/.local/bin/folio` as a symlink (Linux).

**Testing**: No automated tests; manual verification per constitution quality gates and quickstart.md.

**Target Platform**: macOS, Windows (10 version 1709 or later for `WindowsApps` on the default user PATH), Linux desktop (AppImage and deb).

**Project Type**: desktop-app (Electron main + bundled renderer). This feature lives entirely in the main process (`src/main.js`, `src/menu.js`) plus macOS build metadata in `package.json`; it changes no renderer, preload or theme file.

**Performance Goals**: Argument scanning costs one `existsSync`/`statSync` per candidate and stops at the first hit. The macOS and Windows launchers give the terminal back immediately (`nohup … &`, `start ""`). A folder argument reuses the bounded scan of `src/folder.js` (`MAX_TREE_DEPTH` = 16, `SKIP_DIRS`, hidden entries skipped).

**Constraints**: Exactly one running instance (single-instance lock). No administrator rights where avoidable: Windows writes into `WindowsApps`, Linux into `~/.local/bin`; macOS needs `sudo` only when `/usr/local/bin` is not writable, and then the user runs the one-liner, Folio never elevates. Never edit PATH. Never crash on an install failure (every installer path is wrapped in `try`/`catch`). The embedded executable path is escaped for `sh`, `cmd` and PowerShell. A forwarded path must never replace a document in an existing window (Principle IV).

**Scale/Scope**: One optional path per launch (the first existing path wins). About 50 lines of launch parsing (`pathArgFrom`, `launchTargetFor`), about 270 lines of install code (`canInstallShellCommand`, `installShellCommand`, the three per-OS installers, `isOnPath`, `permissionDialogOptions`) and the app-lifecycle block in `src/main.js`; one File-menu item in `src/menu.js`; two macOS document types in `package.json`; four README subsections.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | N/A | No DOM, stylesheet or theme-layer change. Startup only decides which `document`/`folder` the existing `get-init` channel returns; the renderer still injects into `#write`. |
| II. Complement Typora | ✅ Pass | Opening local Markdown files and folders from a terminal serves viewing and light editing; no editing surface is added. The install command mirrors VS Code's "Install 'code' command" (comment in `src/menu.js`). |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | No new IPC channel or `window.folioAPI` method: `src/preload.js` and the renderer are untouched by all six commits, and the install action runs in the main process from a native menu click. Launch arguments are used only after `existsSync`/`statSync` confirm a file or directory. `get-init` still resolves the window's `Session` from `event.sender`. The launchers embed `process.execPath` escaped for a double-quoted `sh` string (`"`, `$`, backtick, `\`), with `%` doubled for batch and `'` doubled for PowerShell literals. |
| IV. Never Lose the User's Work | ✅ Pass | A forwarded path or macOS hand-off always goes to `createWindow(target)` (a new window, 007), so no existing `Session` document is replaced and no guard is needed. At startup there is no earlier document. The Welcome document opens untitled (Save becomes Save As). No settings shape changes, so no migration is needed. |
| V. Cross-Platform Parity | ✅ Pass | The same launch semantics on every OS (`pathArgFrom`, `launchTargetFor`). The install differs per OS, and the difference is explicit in the UI (the menu item is hidden on Linux outside an AppImage, `canInstallShellCommand`) and documented in README.md. Platform workarounds sit behind `process.platform` checks with commented reasons (`app.focus({ steal: true })`, bundle binary instead of `open -a`, `start ""`, why the NSIS installer does not edit PATH). |
| VI. Lean, Local, Self-Contained | ✅ Pass | No new dependency (built-in `fs`/`path`/`os`, Electron `dialog`/`clipboard`); works offline; folder arguments reuse the bounded scan in `src/folder.js`. |
| Workflow & Quality Gates | ⚠️ Partial | README.md was updated in the same commit for `f96fc39`, `8563975`, `5c59ebc`, `61017d1` and `ac1ff4a`, but `5c48052` changed startup without touching README.md, which still says "the last opened folder is remembered between launches" (see [research.md](./research.md#retroactive-findings)). Gate 4 (`npm run dist` on the host, list unverified platforms) cannot be confirmed from the commit messages. Gate 5 is not triggered (no IPC, preload, CSP or sanitization change). |

**Post-design re-check (after Phase 1)**: Unchanged. The contracts add no IPC channel, dependency or theme surface. The ⚠️ is documentation drift recorded for follow-up, not a design violation, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-command-line-launch/
├── spec.md                  # Feature specification (/speckit-specify)
├── checklists/
│   └── requirements.md      # Spec quality checklist (/speckit-specify)
├── plan.md                  # This file (/speckit-plan)
├── research.md              # Phase 0 decisions + retroactive findings
├── data-model.md            # Phase 1: launch target, startup view, launcher state
├── quickstart.md            # Phase 1: validation scenarios per user story
├── contracts/
│   ├── cli-launch.md        # Launch arguments, single instance, macOS open-file
│   ├── startup-view.md      # get-init values driven by the launch target
│   ├── install-command.md   # Per-OS launcher files, dialogs, manual fallbacks
│   └── menu-commands.md     # File > Install 'folio' Command in PATH…
└── tasks.md                 # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main.js        # Launch parsing: pathArgFrom (f96fc39 → 5c48052 → 61017d1), launchTargetFor (61017d1)
│                  # Startup view: get-init (f96fc39, 5c48052)
│                  # App lifecycle: second-instance, open-file, whenReady (f96fc39, 5c48052, 61017d1)
│                  # Install: canInstallShellCommand, installShellCommand, installShellCommandMac,
│                  #   installShellCommandWindows, installShellCommandLinux, isOnPath,
│                  #   permissionDialogOptions (8563975, 5c59ebc, 61017d1, ac1ff4a)
└── menu.js        # File > Install 'folio' Command in PATH… (8563975, 5c59ebc)
package.json       # build.mac.extendInfo.CFBundleDocumentTypes: Markdown Document, Folder (61017d1)
README.md          # How to use › Open from the command line; the `folio` command on macOS, Windows, Linux
```

**Structure Decision**: Keep the feature inside the existing main-process modules. Launch handling sits in `src/main.js` next to `createWindow` and `Session`, which it feeds. The menu item lives in `src/menu.js` behind a `canInstallShellCommand` flag that `rebuildMenu()` computes in the main process. The macOS document-type declaration lives in the electron-builder config in `package.json`. No new module was created: argument parsing needs `app.getAppPath()` and the installers need `dialog` and `clipboard`, so an Electron-free split in the style of `src/folder.js` would only have covered the small `isOnPath` helper.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

No violations — table intentionally empty.
