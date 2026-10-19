# Contract: Install the `folio` Command

**Feature**: [../spec.md](../spec.md) | **Implements**: FR-016 to FR-024

**Code**: `installShellCommand`, `installShellCommandMac`, `installShellCommandWindows`, `installShellCommandLinux`, `isOnPath` and `permissionDialogOptions` in `src/main.js`.

**Introduced/changed by**: `8563975` (macOS, `open -a` wrapper), `5c59ebc` (Linux; per-OS split; shared permission dialog), `61017d1` (macOS bundle-binary wrapper; folder usage in the success dialogs), `ac1ff4a` (Windows).

## Common rules

- Runs in the main process from the File-menu click ([menu-commands.md](./menu-commands.md)). No renderer involvement and no IPC.
- Dispatch on `process.platform`: `darwin` → macOS, `win32` → Windows, `linux` → Linux, anything else → the "isn't supported on this platform" info dialog.
- Never edits PATH or the registry, and never elevates. Folio writes one file or link, or shows the user a command to run.
- Re-running is idempotent: the target is overwritten (macOS, Windows) or unlinked and re-linked (Linux) without confirmation.
- `EACCES`/`EPERM` while writing → the **permission dialog** with that platform's manual command. Any other exception → the **error dialog**. The whole routine is wrapped so a failure (even inside the error dialog) never crashes Folio.
- The executable path is captured at install time from `process.execPath` (macOS, Windows) or `$APPIMAGE` (Linux).

## macOS

| Item | Value |
|---|---|
| Folder | `/usr/local/bin` (created with `mkdirSync(…, { recursive: true })`) |
| Target | `/usr/local/bin/folio`, mode `0755` (written with `mode: 0o755`, then `chmodSync(0o755)` for a file that already existed) |
| Escaping | `process.execPath` with `"`, `$`, backtick and `\` backslash-escaped |
| Success dialog | info · **Command Installed** · "The 'folio' command was installed." · detail: usage `folio path/to/file.md` and `folio path/to/folder`, "You may need to open a new terminal, and make sure /usr/local/bin is on your PATH." · [OK] |

Launcher content (since `61017d1`; `8563975` wrote `exec open -a "Folio" "$@"` instead):

```sh
#!/bin/sh
nohup "<escaped process.execPath>" "$@" >/dev/null 2>&1 &
```

Manual command (for the default install location):

```sh
sudo mkdir -p /usr/local/bin && printf '#!/bin/sh\nnohup "/Applications/Folio.app/Contents/MacOS/Folio" "$@" >/dev/null 2>&1 &\n' | sudo tee /usr/local/bin/folio >/dev/null && sudo chmod 0755 /usr/local/bin/folio
```

## Windows

| Item | Value |
|---|---|
| Base | `%LOCALAPPDATA%`, or `<home>\AppData\Local` when the variable is missing |
| Preferred folder | `%LOCALAPPDATA%\Microsoft\WindowsApps`, used when `isOnPath()` finds it in `process.env.PATH` (case-insensitive; surrounding quotes and trailing `\` or `/` ignored) |
| Fallback folder | `%LOCALAPPDATA%\Folio\bin` |
| Target | `<folder>\folio.cmd` (folder created with `mkdirSync(…, { recursive: true })`) |
| Escaping | every `%` in `process.execPath` is doubled; the path is wrapped in double quotes (a Windows path cannot contain `"`) |
| Success dialog (preferred) | info · **Command Installed** · "The 'folio' command was installed." · detail: "A launcher was created at `<target>`.", usage for a file and a folder, "Open a new terminal first — an already-running one won't see it yet." · [OK] |
| Success dialog (fallback) | info · **Command Installed** · "The 'folio' command was installed, but its folder isn't on your PATH yet." · detail: `Folio wrote <target>.`, the folder to add, "Press Win+R, run "rundll32 sysdm.cpl,EditEnvironmentVariables", edit the user "Path" variable and add the folder above. Then open a new terminal and run: folio path/to/file.md" · [Copy Folder Path] (default; copies the folder to the clipboard) / [OK] (cancel) |

Launcher content (CRLF line endings):

```bat
@echo off
start "" "<process.execPath with % doubled>" %*
```

Manual command (PowerShell; `'` doubled inside the single-quoted literals):

```powershell
New-Item -ItemType Directory -Force -Path '<folder>' | Out-Null; Set-Content -Path '<folder>\folio.cmd' -Value '@echo off', 'start "" "<exe>" %*'
```

## Linux

| Item | Value |
|---|---|
| Precondition | `process.env.APPIMAGE` is set (otherwise the menu item is hidden; if called anyway: info · **Install Command** · "Installing the 'folio' command needs Folio to be running as an AppImage." · [OK]) |
| Folder | `~/.local/bin` (`os.homedir()`; created with `mkdirSync(…, { recursive: true })`) |
| Target | `~/.local/bin/folio`, a **symlink** to `$APPIMAGE`. An existing entry is removed first with `unlinkSync`, and `ENOENT` is ignored. |
| Success dialog | info · **Command Installed** · "The 'folio' command was installed." · detail: "A symlink was created at `<target>`.", usage for a file and a folder, "You may need to open a new terminal, and make sure `<folder>` is on your PATH." · [OK] |

Manual command:

```sh
mkdir -p "<home>/.local/bin" && ln -sf "<$APPIMAGE>" "<home>/.local/bin/folio"
```

## Shared dialogs

| Dialog | Type · Title | Message | Detail | Buttons |
|---|---|---|---|---|
| Permission (`permissionDialogOptions`) | warning · **Install Command** | "Installing the 'folio' command needs different permissions." | "Folio couldn't write `<target>` directly. Run this in a terminal to install it manually:" followed by the manual command | [Copy Command] (default; copies the manual command to the clipboard) / [Cancel] |
| Error | error · **Install Command** | "Couldn't install the 'folio' command." | the error message | [OK] |
| Unsupported platform | info · **Install Command** | "Installing the 'folio' command isn't supported on this platform." | "Folio can only install a launcher on macOS, Windows and Linux." | [OK] |

The permission dialog and the Windows fallback dialog are modal (`showMessageBoxSync`) because their button decides the clipboard action. The success and error dialogs are asynchronous (`showMessageBox`).
