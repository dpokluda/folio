# Folio

Folio opens local Markdown files as a formatted page and lets you make small edits in source mode.
It works offline, needs no account, and does not collect telemetry.
Choose **Help > User Guide** to read this document inside the app.

## Starting it

Choose the download for your operating system and processor.
`x64` is for Intel/AMD PCs and Intel Macs; `arm64` is for Windows on Arm, Linux aarch64, and Apple Silicon Macs.
The bundled runtime requires Windows 10 or newer or macOS 12 or newer.
Fedora 44 is the Linux compatibility reference; other distributions need compatible desktop libraries and are not qualified by a successful Ubuntu build alone.

- **Windows:** run the setup `.exe`, then open Folio from the Start menu.
- **macOS:** open the `.dmg`, drag Folio into Applications, eject the disk image, then open Folio from Applications.
- **Linux:** make the AppImage executable with `chmod +x "Folio.AppImage"` (use your downloaded filename), then run it.
  An AppImage is the application itself, not an installer that automatically creates a desktop-menu entry.

Each target also has an archive: `.zip` on Windows and `.tar.gz` on macOS/Linux.
Extract the complete archive.
On Windows run `Folio.exe` and keep all companion files together; on macOS open the extracted `Folio.app`; on Linux run `./folio` from its extracted folder.
Archive use does not create a separate portable-settings mode.
Downloads name the product version, operating system, and architecture, such as `Folio-1.0.0-windows-arm64-setup.exe`.
If GitHub Actions wraps your download in another ZIP, extract that transport ZIP first to get the actual package files.

The app includes its runtime; you do not need Node.js, npm, or developer tools.
Close Folio before updating or replacing its application files.
For an older Windows NSIS installation, close Folio and uninstall that copy in **Settings > Apps** before using the new setup.
Keep your documents and preferences; setup does not migrate or remove that earlier installation automatically.

## Opening it the first time

Folio has no trusted Microsoft or Apple developer certificate, so your operating system may ask you to approve a download or first launch.
Only approve a copy from a source you trust.
Do not disable system-wide protections or treat a genuine malware warning as an ordinary unsigned-app warning.

**Windows:** for the ordinary "Windows protected your PC" notice, choose **More info > Run anyway** if you trust the download.
Managed computers may require your administrator's approval instead.

**macOS:** try opening Folio first.
For an unidentified-developer or unverified-app notice, open **System Settings > Privacy & Security** and use **Open Anyway** for Folio, then confirm.
If macOS reports malware, stop rather than bypassing that warning.

**Linux:** desktop installations need the usual graphical libraries.
If the AppImage reports that FUSE is missing, install your distribution's compatible FUSE library.
On Fedora, the existing packaging guidance uses `sudo dnf install fuse fuse-libs`; ask an administrator if you cannot install system packages.
Do not run Folio as root or add `--no-sandbox` to get around a launch failure.

## Using Folio

Shortcuts use **Cmd** on macOS and **Ctrl** on Windows/Linux unless another key is shown.

- **Open:** **File > Open** (`Ctrl/Cmd+O`) opens a document.
  **File > Open Folder** (`Ctrl/Cmd+Shift+O`) shows a file explorer; click a Markdown file or follow a document link to navigate.
- **Edit:** **View > Toggle Source Code Mode** (`Ctrl/Cmd+/`) switches between source and preview.
  **Format** contains shortcuts for headings, bold, links, code, and other Markdown formatting.
- **Save:** `Ctrl/Cmd+S` saves; `Ctrl/Cmd+Shift+S` saves under another name.
  A dot in the title means unsaved edits.
  When asked to save before leaving a document, Cancel keeps your current work.
- **Find:** `Ctrl/Cmd+F` searches the document.
  With a folder open, `Ctrl/Cmd+Shift+F` searches its Markdown files.
- **Appearance:** **Themes** selects Style, Light/Dark/System appearance, and page width.
  The choices affect both preview and source and are remembered.
- **Export:** **File > Export to PDF** exports the rendered page using the selected page width.
- **Another window:** **File > New Window** (`Ctrl/Cmd+Shift+N`) opens another independent document window.
  The **Window** menu switches between open windows.

**Help > Markdown Formatting Tour** demonstrates supported Markdown, math, and diagrams.
Built-in help documents open as untitled copies; Save uses Save As instead of changing the bundled originals.

## From a terminal

Choose **File > Install 'folio' Command in PATH** to set up the existing optional terminal command.
Windows uses a per-user launcher; macOS may need permission to write `/usr/local/bin`.
On Linux this menu option is available when running an AppImage and links that file into `~/.local/bin`.
It is unavailable for a Linux archive; use the extracted executable directly, for example `./folio "path/to/notes.md"`.
Reopen your terminal if needed, then use:

```sh
folio "path/to/notes.md"
folio "path/to/notes-folder"
```

An additional launch opens the path in a new window if Folio is already running.
Moving or deleting the application may break its optional launcher; set it up again for the new location.

## Files and settings

Your documents stay wherever you open or save them.
Folio's preferences are separate, in `folio-settings.json` under:

- Windows: `%APPDATA%\folio`
- macOS: `~/Library/Application Support/folio`
- Linux: `$XDG_CONFIG_HOME/folio`, normally `~/.config/folio`

Uninstalling the application does not intentionally delete your documents or these preferences.

## Removing it

On Windows, uninstall Folio through **Settings > Apps**.
On macOS, move Folio from Applications to the Trash.
On Linux, delete the AppImage and any optional desktop integration you added.
For an archive, delete its extracted application folder.
Remove an optional terminal launcher if you no longer use it: `folio.cmd` on Windows, `/usr/local/bin/folio` on macOS, or `~/.local/bin/folio` on Linux.
Delete the preferences folder separately only if you want to reset your settings.

## License and support

Folio is free and open source under the MIT License; the full notice is in the bundled `LICENSE` next to this README.
Source and issues: https://github.com/dpokluda/folio

Folio is not affiliated with, endorsed by, or sponsored by the Typora team.
Typora is a trademark of its owner and is named only to describe theme compatibility.
Microsoft Aptos fonts are not redistributed; the Word style uses substitute fonts when they are unavailable.
