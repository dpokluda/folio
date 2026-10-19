# Quickstart: Validate Command-Line Launch & the `folio` Command

**Feature**: [spec.md](./spec.md) | **Contracts**: [cli-launch](./contracts/cli-launch.md), [startup-view](./contracts/startup-view.md), [install-command](./contracts/install-command.md), [menu-commands](./contracts/menu-commands.md) | **Data model**: [data-model.md](./data-model.md)

Manual validation guide. Folio has no automated tests, so these scenarios plus the constitution's quality gates are the acceptance run for this feature.

## Prerequisites

- Node.js LTS as stated in README.md, and dependencies installed from the repository root:

  ```sh
  npm install
  npm start            # builds the renderer bundle once and shows the Welcome document; quit afterwards
  ```

- `REPO` set to the absolute path of the repository checkout (`export REPO=$(pwd)` from the root; PowerShell: `$REPO = (Get-Location).Path`).
- A scratch folder **outside** the repository, so that relative paths are clearly resolved against the caller's directory:

  ```sh
  mkdir -p ~/folio-qs/notes-folder ~/folio-qs/empty-folder
  printf '# Notes\n\nOpened from the command line.\n' > ~/folio-qs/notes.md
  printf '# Index\n\nFolder entry document.\n'       > ~/folio-qs/notes-folder/_index.md
  printf '# Other\n'                                  > ~/folio-qs/notes-folder/other.md
  ```

  On Windows, create the same files with Explorer or `Set-Content`.

- For User Stories 4 and 5, a packaged build for the host platform: `npm run dist` (or `npm run dist:mac`, `dist:win`, `dist:linux`), installed from `release/`. Linux AppImages need FUSE 2 (see README.md).

## How to run with a path

| Form | Command | Relative paths resolve against |
|---|---|---|
| Development, from the repository root | `npm start -- samples/formatting-tour.md` | the repository root (npm runs scripts there) |
| Development, from any directory | `"$REPO/node_modules/.bin/electron" "$REPO" notes.md` (Windows: `& "$REPO\node_modules\.bin\electron.cmd" $REPO notes.md`) | the current directory |
| Packaged program | `/Applications/Folio.app/Contents/MacOS/Folio notes.md`, `Folio.exe notes.md`, `./Folio-<version>.AppImage notes.md` | the current directory |
| Installed command | `folio notes.md` | the current directory |

In the second form the `"$REPO"` argument is the development app folder; the launch parser skips it by identity ([cli-launch.md](./contracts/cli-launch.md#synopsis)).

## Scenario 1: Open a file or folder named at launch (User Story 1)

Run each step from `~/folio-qs` with the development form, and quit Folio between steps.

1. `… "$REPO" notes.md`: the title is `notes.md - Folio`, the preview shows "Notes", and the explorer and outline are hidden. File > Open Recent lists `notes.md`.
2. `… "$REPO" notes-folder`: folder mode; the explorer lists `_index.md` and `other.md`, and `_index.md` is displayed.
3. `… "$REPO" --some-option missing.md notes.md`: `notes.md` opens (the option and the missing path are skipped).
4. `… "$REPO" does-not-exist.md`: the Welcome document opens (title `Welcome - Folio`) with no error.
5. `… "$REPO" empty-folder`: the explorer is shown but empty, and the Welcome document is displayed.
6. macOS/Linux: `printf 'x\n' > locked.md && chmod 000 locked.md`, then `… "$REPO" locked.md`: an error box titled **Folio — cannot open file** names the path and the reason, then the Welcome document appears. Afterwards run `chmod 644 locked.md`.
7. From the repository root: `npm start -- samples` opens folder mode with `formatting-tour.md` displayed (the first Markdown file, because `samples/` has no `_index.md`, `README.md` or `index.md`).
8. macOS: in steps 1 and 2 the Folio window appears in front of the terminal.

Expected: FR-001 to FR-007; the first-launch table in [cli-launch.md](./contracts/cli-launch.md#first-launch-no-running-instance).

## Scenario 2: Send a path to the running Folio (User Story 2)

1. `npm start`. Toggle source mode (`Ctrl/Cmd+/`) and type a few characters, so the title shows `• Welcome - Folio`. Minimize the window.
2. In a second terminal: `cd ~/folio-qs && "$REPO/node_modules/.bin/electron" "$REPO" notes.md`. The command returns at once; a **new**, cascaded window shows `notes.md` in the foreground. The first window still holds its edits and the `•`. The Dock or taskbar shows a single Folio.
3. Same terminal: `… "$REPO" notes-folder` opens another new window in folder mode.
4. `… "$REPO"` with no path: no new window opens, and the most recently focused Folio window comes forward (restored if minimized).
5. Optional mixed packaging (macOS, packaged build installed with the `folio` command from Scenario 4): with the development Folio from step 1 still running, run `folio notes.md` from `~/folio-qs`. The development instance opens `notes.md` (the case fixed in `61017d1`). The reverse direction, a development launch handed to a running packaged Folio, opens the checkout in folder mode instead; that is a recorded limitation in [research.md](./research.md#retroactive-findings), not a failure of this step.
6. Close the windows; when asked about the unsaved Welcome edits, choose not to save.

Expected: FR-008 to FR-012; the hand-off sequence in [cli-launch.md](./contracts/cli-launch.md#hand-off-to-a-running-instance). The window behavior itself belongs to 007.

## Scenario 3: Start clean (User Story 3)

1. `npm start`, then File > Open Folder… → `~/folio-qs/notes-folder`, and turn on View > Toggle Outline. Quit.
2. `npm start`: the Welcome document is shown, with the explorer and the outline hidden.
3. Turn source mode on, quit, and run `npm start` again: the Welcome document opens in source mode (the preference is kept, FR-015). Turn source mode off again.
4. In source mode, edit the Welcome document and press `Ctrl/Cmd+S`: a Save As dialog appears instead of overwriting `samples/welcome.md`. Cancel and discard the edit.

Expected: FR-013 to FR-015; the `get-init` values in [startup-view.md](./contracts/startup-view.md).

## Scenario 4: Install the `folio` command (User Story 4, packaged build)

Check the dialog texts and file contents against [install-command.md](./contracts/install-command.md).

**macOS**

1. Launch `/Applications/Folio.app` and choose File > Install 'folio' Command in PATH….
2. If `/usr/local/bin` is writable you get **Command Installed**. Otherwise (the default on Apple silicon without Homebrew in `/usr/local`) a warning shows the `sudo` one-liner: click **Copy Command**, paste it into Terminal and enter your password.
3. `cat /usr/local/bin/folio` shows `#!/bin/sh` and the `nohup "…/Folio.app/Contents/MacOS/Folio" "$@" >/dev/null 2>&1 &` line.
4. In a **new** terminal: `cd ~/folio-qs && folio notes.md`. The prompt returns immediately and Folio opens `notes.md`. With Folio still running, `folio notes-folder` opens a new window in front. Close the terminal and confirm Folio keeps running.

**Windows**

1. Install the NSIS build, start Folio and choose File > Install 'folio' Command in PATH….
2. The confirmation names `%LOCALAPPDATA%\Microsoft\WindowsApps\folio.cmd`; `Get-Content "$env:LOCALAPPDATA\Microsoft\WindowsApps\folio.cmd"` shows `@echo off` and `start "" "…\Folio.exe" %*`.
3. In a **new** PowerShell window: `cd ~\folio-qs; folio notes.md`. The prompt returns immediately and Folio opens the file. Repeat in `cmd`.
4. Fallback: quit Folio. In PowerShell run `$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notlike '*\Microsoft\WindowsApps*' }) -join ';'`, then start `Folio.exe` from that shell by its full path and choose the menu command again. The "isn't on your PATH yet" dialog appears, **Copy Folder Path** copies `%LOCALAPPDATA%\Folio\bin`, and `folio.cmd` exists there. Delete it afterwards.

**Linux (AppImage)**

1. Run `release/Folio-<version>.AppImage` and choose File > Install 'folio' Command in PATH….
2. `ls -l ~/.local/bin/folio` shows a symlink to the AppImage.
3. In a **new** terminal: `cd ~/folio-qs && folio notes.md` opens the file.
4. Permission fallback: `chmod u-w ~/.local/bin`, then choose the menu command. A warning shows `mkdir -p "…/.local/bin" && ln -sf "…AppImage" "…/.local/bin/folio"`. Click **Copy Command**, run `chmod u+w ~/.local/bin`, then paste and run the command.
5. Start Folio with `npm start` (or from a `.deb` install): the File menu has **no** install item.

Expected: FR-016 to FR-024; [menu-commands.md](./contracts/menu-commands.md).

## Scenario 5: macOS desktop hand-offs (User Story 5, packaged build)

1. Quit Folio. `open -a Folio ~/folio-qs/notes.md`: Folio starts and shows `notes.md` in front.
2. With Folio running, drag `~/folio-qs/notes-folder` onto Folio's Dock icon: a new window opens in folder mode.
3. In Finder, right-click a `.md` file → Open With: Folio is listed, but the default app is unchanged.
4. Note the result of `open -a Folio ~/folio-qs/notes-folder`, both with Folio quit and running, against the README caveat recorded in [research.md](./research.md#retroactive-findings).

Expected: FR-025 to FR-027; [cli-launch.md](./contracts/cli-launch.md#macos-desktop-hand-off-open-file).

## Constitution gates

| Gate | How to check for this feature |
|---|---|
| 1. Renderer build | `npm run build:renderer` completes; the feature does not change the renderer. |
| 2. Smoke test with unsaved-changes guard | Scenarios 1 to 3; Scenario 2 step 2 proves that a hand-off never touches an edited window. |
| 3. Light/Dark and Style families | N/A: no themed UI was added (the install dialogs are native OS dialogs). |
| 4. `npm run dist` on the host | Scenario 4 (and 5 on macOS) on the packaged build. List the platforms you did not verify. |
| 5. Principle III review | `git show --stat f96fc39 5c48052 8563975 5c59ebc 61017d1 ac1ff4a` lists no `src/preload.js`, `src/renderer/` or CSP change, so no new IPC surface. |
| Documentation | README.md › How to use covers "Open from the command line" and "The `folio` command on macOS / Windows / Linux", including the PowerShell-profile PATH line and the `open -a` caveat (FR-028). |

## Cleanup

```sh
rm -rf ~/folio-qs
rm -f ~/.local/bin/folio                    # Linux
sudo rm -f /usr/local/bin/folio             # macOS (drop sudo if the folder is writable)
```

On Windows: `Remove-Item "$env:LOCALAPPDATA\Microsoft\WindowsApps\folio.cmd"`.
