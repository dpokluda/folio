# Contract: Consumer README and Offline Access

**Feature**: [spec.md](../spec.md), User Story 2

## Authorship and Distribution

`docs/user/README.md` is the one maintained consumer guide.
Create it as a product change before adding the workflow.
Do not replace the long repository README or have CI generate another consumer document.
Both local and automated packages copy the authored guide as ordinary `README.md` resources using [the packaging layout](./packaging.md).
The guide stays with the application after a DMG is ejected, an archive is deleted, or the source repository is unavailable.

The guide is concise English Markdown, written for someone using the app.
It is self-contained: core instructions do not depend on repository images, build scripts, external web pages, or a network connection.
Web links for source and issue reporting are supplementary.
It does not claim Folio is a single-file application or copy Anniversary's runtime-specific instructions.

## Required Coverage

| Topic | Consumer outcome |
| ----- | ---------------- |
| Purpose | Understand local Markdown viewing and light source editing; retain the Typora non-affiliation statement where compatibility is named. |
| Choosing a download | Distinguish OS, x64/arm64, Intel/Apple Silicon, installer versus archive, direct Actions downloads, and legacy outer transport ZIPs. |
| Starting | Install Windows per user, copy the macOS app from DMG, extract complete archives, or make an AppImage executable. |
| First launch | Follow ordinary unsigned-app approval; do not disable system-wide protections or treat genuine malware warnings as harmless. |
| Core use | Open files/folders; switch preview/source; save and Save As; find text/files; change themes; export PDF; open another window. |
| Terminal use | Existing `folio` command installation and path arguments; explain disabled Linux archive command-install behavior and direct executable use instead. |
| Settings | Identify the actual unchanged Electron `userData` directory and `folio-settings.json`; distinguish settings from document locations. |
| Removal/transition | Remove the relevant package form, retain documents/settings, remove optional shell launchers deliberately, and explain legacy NSIS transition. |
| License/support | Point to bundled MIT `LICENSE`, preserve relevant credits, and link source/issues without making online access necessary for use. |

Document Windows and macOS approval using supported OS UI paths.
Do not make a quarantine-removal command or disabled security policy the default troubleshooting advice.
State Fedora 44 acceptance and the prerequisites verified for the produced AppImage.
Linux archive launch uses `./folio`, not an invented capitalized or single-file executable.
macOS archive launch opens the extracted `.app`, not a bare console program.

## Help Entry and Document State

Add `User Guide` to the existing Help submenu, alongside Welcome and Markdown Formatting Tour.
It is available on every supported platform and reads the local source during development or the ordinary packaged resource when installed.
Reuse the existing main-process menu action, focused-window/session selection, and built-in document loader.
Do not add a renderer filesystem API, browser window, or IPC channel just to read a known bundled file.

Opening the guide must pass through the existing unsaved-changes check.
Save saves the current document before opening; Discard opens the guide; Cancel leaves document, edits, folder, history, and focus state unchanged.
After successful loading, the guide is an untitled document named `User Guide`.
It is not watched as a user file, and editing followed by Save invokes Save As rather than overwriting the source or installed guide.
Opening a known bundled document through File Open, file association, or launch arguments must retain that same untitled protection.
Use the existing explicit error dialog if the known file cannot be read.
Do not replace the guide with synthesized success-shaped fallback text.

## Acceptance Boundaries

Confirm Help access from local development, Windows installation/ZIP, macOS DMG copy/tarball, and Linux AppImage/tarball.
Include both Light and Dark appearance and the existing style families.
Test an unsaved document with Save, Discard, and Cancel before opening the guide.
Remove the original installation medium and disconnect the network; the installed guide must still open.
The guide-access feature must not change existing Welcome, Formatting Tour, file-opening, command-line, or settings behavior.
