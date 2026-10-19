# Feature Specification: Cross-Platform Packaging, App Identity & File Associations

**Feature Branch**: `002-cross-platform-packaging`

**Created**: 2026-07-09

**Status**: Implemented (retroactive)

**Input**: User description: "Make Folio installable on Windows, macOS and Linux with one npm command per platform (an NSIS installer, a DMG, and an AppImage plus a .deb), without needing administrator rights or Developer Mode. Give it its own app icon, register it as a handler for Markdown files with a distinct Markdown-document icon instead of the app icon, and make the build resilient to the environment failures I keep hitting: the runtime failing to install on very new Node.js releases, Windows file locks while packaging, and missing Linux system libraries."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `dd44537` (2026-07-09, Windows packaging without administrator rights or Developer Mode), `c5171da` (2026-07-09, app icon and icon generation), `f96fc39` (2026-07-09, enlarged icon glyph only), `4b2248b` (2026-07-10, Linux packaging fixes and prerequisites), `6bf8c90` (2026-07-13, self-repairing development runtime only), `002f2bb` (2026-07-14, Windows file-lock hardening), `68e67be` (2026-07-16, icon artwork refresh only), `57f8363` (2026-08-03, move to a supported runtime line after macOS revoked the embedded one), `59f97be` (2026-08-20, Markdown-document icon, file associations and the one-shot rebuild script), `5f9a8a0` (2026-09-16, retirement of the Windows signing-bundle workaround) and `218bccc` (2026-09-30, dependency refresh). The baseline packaging targets arrived with the initial build `bd8f5ef` (2026-07-09) and the macOS document-type declaration with `61017d1` (2026-08-04); this spec owns both. Related specs: [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md) (the app being packaged and its bundled documents), [003-command-line-launch](../003-command-line-launch/spec.md) (what Folio does with a file or folder the OS hands it, and the `folio` command), [004-three-axis-theming](../004-three-axis-theming/spec.md) (the packaged themes and the Word style's Aptos fonts), [007-multiple-windows](../007-multiple-windows/spec.md) (a second launch opens a new window).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Package Folio for every desktop OS with one command (Priority: P1)

The maintainer runs a single command on a Windows, macOS or Linux machine and gets that operating system's installable Folio package in the project's `release/` folder: an NSIS installer on Windows, a DMG on macOS, and both an AppImage and a .deb on Linux. No administrator account, Windows Developer Mode or code-signing certificate is needed. Each package contains everything Folio needs at run time (the app, its themes, its bundled documents and its icons) and leaves out what must not be redistributed.

**Why this priority**: Without installable packages Folio only runs from a source checkout, so it cannot reach the many work, home and remote machines it exists for. Every other story in this feature refines these packages.

**Independent Test**: On each OS, from a fresh checkout with dependencies installed, run `npm run dist` from a standard user account, install the produced artifact and launch Folio: it shows its welcome document and every theme choice works.

**Acceptance Scenarios**:

1. **Given** a Windows machine, a standard (non-administrator) account and Developer Mode turned off, **When** the maintainer runs `npm run dist`, **Then** an NSIS installer is written to `release/` and no "required privilege is not held" error occurs.
2. **Given** a macOS machine, **When** the maintainer runs `npm run dist`, **Then** a DMG is written to `release/` and the app it installs is named "Folio".
3. **Given** a Linux machine with the documented system libraries installed (User Story 6), **When** the maintainer runs `npm run dist`, **Then** an AppImage and a .deb are both written to `release/`, and the .deb names the maintainer (name and e-mail address) in its package metadata.
4. **Given** any of the three OSes, **When** the maintainer runs the OS-specific command for the host (`npm run dist:win`, `npm run dist:mac` or `npm run dist:linux`), **Then** the result is the same as `npm run dist`; naming an OS other than the host is cross-targeting, which needs extra tooling (for example Wine to build the Windows installer on macOS or Linux).
5. **Given** the maintainer has copied the Word style's Aptos fonts into the theme folder for personal use, **When** a package is built and installed, **Then** the theme files the installed Folio loads contain none of those fonts, and the Word style falls back to its substitute fonts as it does for anyone without them.
6. **Given** an installed package on any OS, **When** Folio starts, **Then** it opens its welcome document and all bundled themes are available, exactly as when run from source.

---

### User Story 2 - Folio has its own recognizable app icon (Priority: P2)

An end user can pick Folio out on the taskbar, in the Dock or in the application list because it has its own icon instead of the runtime's generic one: a light rounded tile with a darker frame, a stylized "F" and a teal editor-caret accent, evoking Typora's single-letter tile while clearly being Folio's own. The maintainer edits one source drawing and regenerates every OS-specific icon file with one command.

**Why this priority**: A package that shows a generic icon looks unfinished and is hard to find among other apps. Identity is the first thing a user sees after installing, but it only matters once packages exist (User Story 1).

**Independent Test**: Install a package on any OS and confirm the Folio tile on the installed app and on its running window; then run `npm run icons` and confirm it rewrites the PNG, Windows and macOS icon files for both artworks without errors.

**Acceptance Scenarios**:

1. **Given** Folio installed on Windows, **When** the user looks at the executable in Explorer and at the running app on the taskbar, **Then** both show the Folio tile.
2. **Given** Folio installed from the DMG, **When** the user looks at it in Finder or in the Dock, **Then** it shows the Folio tile.
3. **Given** Folio installed from the AppImage or the .deb, **When** it runs, **Then** its window and its application entry show the Folio tile.
4. **Given** Folio run from source on Windows or Linux (`npm start`), **When** a window opens, **Then** the window and taskbar show the Folio tile rather than the runtime's default icon.
5. **Given** the tile is shown on a white background or scaled down to 16, 32 or 48 pixels, **When** the user looks at it, **Then** its darker, thick frame keeps the near-white tile distinguishable.
6. **Given** the maintainer edits the source drawing, **When** they run `npm run icons`, **Then** a 1024×1024 PNG, a Windows icon file and a macOS icon file are regenerated for both the app icon and the Markdown-document icon, ready to commit.

---

### User Story 3 - Markdown files open with Folio and wear a Markdown-document icon (Priority: P3)

On Windows, installing Folio registers Markdown files (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`) as Folio "Markdown Document" files that show a document icon (a sheet of paper with a folded corner and the Folio glyph) rather than the app tile, so a folder of notes doesn't turn into a wall of app icons, and double-clicking one opens it in Folio. On macOS, Folio offers itself for Markdown and plain-text documents without displacing the user's existing default app, and once the user makes Folio the app for Markdown files, those files show the same document icon.

**Why this priority**: Double-clicking a note is the most common way to reach a viewer, but it is only valuable once Folio is installable (User Story 1) and recognizable (User Story 2).

**Independent Test**: Install the Windows package, open a folder containing one file with each of the five extensions in Explorer, and confirm the document icon, the "Markdown Document" type, and that double-clicking any of them opens Folio.

**Acceptance Scenarios**:

1. **Given** Folio installed on Windows, **When** the user browses files with any of the five Markdown extensions, **Then** Explorer shows the Markdown-document icon and the type "Markdown Document".
2. **Given** the same machine, **When** the user double-clicks one of those files, **Then** it opens in Folio.
3. **Given** a Windows user who, before installing, had chosen Folio for `.md` files with "Open with → Always use this app", **When** they install a Folio build with the registration, **Then** those files may keep showing the plain executable icon until the user re-chooses Folio once through "Open with → Choose another app → Folio → Always", after which the document icon appears, as the README explains.
4. **Given** Folio installed on macOS, **When** the user opens the "Open With" menu on a Markdown or plain-text file, **Then** Folio is listed, and Folio declares itself only as an alternate app, so it does not displace an existing default app.
5. **Given** the user has made Folio the app for Markdown files on macOS, **When** Finder shows those files, **Then** they display the Markdown-document icon.
6. **Given** Folio installed on macOS, **When** the system offers apps for a folder, **Then** Folio can accept the folder as a viewer but is never chosen as any folder's default app; what Folio does with a received file or folder is defined in 003.

---

### User Story 4 - The development runtime repairs itself on very new toolchains (Priority: P4)

On some bleeding-edge releases of the JavaScript toolchain, the app runtime's own installer downloads the runtime but silently fails to unpack it, and running Folio then fails with "failed to install correctly, please delete … and try installing again", which reinstalling doesn't fix. The project detects the missing runtime after `npm install` and before `npm start` or any packaging command, unpacks the already-downloaded runtime with the operating system's built-in unzip tool, and carries on. On a healthy installation the check does nothing.

**Why this priority**: It unblocks development and packaging on the newest toolchains, but a supported LTS toolchain avoids the problem entirely, so it ranks below the stories end users can see.

**Independent Test**: Remove the unpacked runtime from the installed dependencies while keeping its download in the cache, run `npm start`, and confirm the runtime is restored and Folio launches; run it again and confirm the check reports that there is nothing to do.

**Acceptance Scenarios**:

1. **Given** a healthy runtime installation, **When** `npm install`, `npm start` or a packaging command runs, **Then** the check reports that the runtime is already installed and changes nothing.
2. **Given** the runtime was downloaded but not unpacked, **When** any of those commands runs, **Then** the download is found in the cache, unpacked with the OS's built-in unzip tool (on macOS, Windows and Linux alike), and the command continues.
3. **Given** the runtime download is not in the cache either, **When** the check runs, **Then** it lets the runtime's own installer download it and then unpacks it itself.
4. **Given** an Apple Silicon Mac running the toolchain under Intel emulation, **When** the check picks which runtime to unpack, **Then** it picks the Apple Silicon build, as the official installer does; an explicitly configured architecture always wins.
5. **Given** no network connection and nothing cached, **When** the check runs, **Then** it stops the command with a one-line error asking the maintainer to check the network connection and re-run.
6. **Given** the maintainer wants to repair the runtime without launching anything, **When** they run the documented standalone repair command, **Then** the same check and repair run on their own.

---

### User Story 5 - Windows packaging survives file locks (Priority: P5)

On Windows, packaging used to fail with the cryptic "Unable to commit changes" error whenever antivirus briefly locked the freshly built executable or a previously packaged Folio was still running from the build output. Now stale build output is removed up front, a running Folio is reported in plain words before packaging starts, and transient locks are retried automatically while real errors still fail fast.

**Why this priority**: The failure is intermittent, Windows-only and has a manual workaround (close Folio, retry), so it ranks after the stories that create and identify the packages.

**Independent Test**: Start the previously packaged Folio from its unpacked output folder, run `npm run dist`, and confirm packaging stops before the packager starts with a message to close Folio; close it, re-run, and confirm packaging succeeds.

**Acceptance Scenarios**:

1. **Given** a previous build's unpacked output folder in `release/`, **When** `npm run dist` starts, **Then** that folder is deleted before packaging and previously built installers are kept.
2. **Given** a packaged Folio is running from that folder, **When** `npm run dist` starts, **Then** packaging stops with a message that names the folder, says a file there is locked (most likely by a running Folio) and asks the maintainer to close it and run the command again.
3. **Given** antivirus briefly locks the freshly built executable, **When** packaging fails with the transient lock error, **Then** packaging is re-run automatically after 4 seconds, up to 3 attempts in total, with a visible "attempt n/3" notice.
4. **Given** the lock persists through the third attempt, **When** packaging gives up, **Then** it prints guidance to close any running Folio and/or exclude the project's release folder from antivirus scanning, and ends with the packager's exit code.
5. **Given** packaging fails for any other reason, **When** the failure is detected, **Then** it is not retried and the original error and exit code reach the maintainer unchanged.
6. **Given** there is no `release/` folder or no unpacked output in it (on any OS), **When** packaging starts, **Then** the cleanup step does nothing and packaging proceeds.

---

### User Story 6 - Rebuild releases in one step and keep them working over time (Priority: P6)

The maintainer rebuilds a complete release with one command, and when the environment breaks a build or a shipped release, the documentation names the cause and the fix: Linux machines missing the system libraries needed to build the .deb or to run the AppImage, and macOS suddenly reporting Folio as malware because Apple revoked the outdated runtime it embedded. Folio's embedded runtime is kept on a release line that still receives security fixes.

**Why this priority**: These are maintenance concerns that matter once releases exist, and each failure has a documented manual fix.

**Independent Test**: Run the one-shot rebuild command with its Clean option on the host and confirm it regenerates the icons, packages Folio and lists the produced files; then follow the Linux prerequisite instructions on a Fedora or Ubuntu machine that lacks the libraries and confirm packaging and launching the AppImage succeed.

**Acceptance Scenarios**:

1. **Given** PowerShell 7 or later on any OS, **When** the maintainer runs `pwsh scripts/build.ps1`, **Then** the icons are regenerated, the host package is built, and the ten largest files in `release/` are listed with their sizes in MB.
2. **Given** the Clean, Install, SkipIcons and Platform options, **When** the maintainer passes them, **Then** the script respectively wipes `release/` first, runs `npm install` first, skips icon generation, or targets the current OS, Windows, macOS or Linux; the first failing step stops the script with a message naming the command and its exit code.
3. **Given** the Clean option and a locked `release/` folder, **When** the script tries to delete it, **Then** it stops with a message that a file there is locked, most likely by a running Folio, and asks to close it and retry.
4. **Given** a PowerShell older than version 7, **When** the maintainer runs the script, **Then** it refuses to run and states that PowerShell 7 or later is required.
5. **Given** a Linux machine without the legacy `libcrypt.so.1` library, **When** `npm run dist` builds the .deb, **Then** it fails with a missing `libcrypt.so.1` shared-library error, which the README explains together with the package to install on Fedora/RHEL and on Debian/Ubuntu.
6. **Given** a Linux machine without FUSE 2 (`libfuse.so.2`), **When** the user runs the built AppImage, **Then** it reports that AppImages require FUSE to run, which the README explains together with the package to install; building only the AppImage avoids the .deb prerequisite.
7. **Given** macOS reports Folio as malware and deletes it although nothing in the project changed, **When** the maintainer follows the macOS troubleshooting guide, **Then** one command confirms a revoked runtime, and the guide's seven steps (purge the runtime and its cached download, upgrade the runtime together with the packager, verify the new runtime, smoke-test from source, rebuild, reinstall, approve on first launch) restore a launchable Folio; a temporary re-sign workaround is offered only as a stopgap.

---

### Edge Cases

- A packaged Folio still running from the unpacked output folder on Windows: packaging stops before the packager starts and nothing new is produced; closing Folio and re-running succeeds.
- Antivirus holds the new executable through all three attempts: the build fails with guidance instead of retrying indefinitely.
- A failure that is not the lock (for example invalid configuration or a missing Linux library) is never retried and is reported unchanged.
- `npm run dist` removes only the unpacked output folders, so installers from earlier builds accumulate in `release/` until the one-shot rebuild's Clean option wipes the whole folder.
- The runtime check runs before dependencies were ever installed: it reports that there is nothing to do and suggests running `npm install` first.
- Runtime self-repair depends on the OS's unzip tool: it is built into macOS and Windows, while Linux needs the `unzip` command installed (the README does not list it; see research.md).
- The unzip tool fails, or unpacking does not produce the runtime executable: the calling command stops with an explanation, so Folio never launches on a half-unpacked runtime.
- `npm run icons` with a missing source drawing stops and names the missing file; files already regenerated for an artwork processed earlier in the same run stay rewritten.
- The icon file is missing at run time: windows still open, with the default icon.
- Running from source on macOS: the Dock shows the development runtime's own icon; the Folio tile appears in packaged builds.
- A Windows per-user "Always use this app" choice made before installing keeps the plain executable icon until Folio is re-chosen once (User Story 3, scenario 3).
- On macOS Folio is offered for every plain-text file, not only Markdown, because it declares both content types at alternate rank; for folders it uses the lowest rank, so it is never their default app.
- Linux packages register no Markdown file association; Markdown files are opened from inside Folio or passed on the command line (003). The README does not mention this difference (see research.md).
- Unsigned builds: macOS treats the app as coming from an unidentified developer, and the user approves it once per machine (right-click → Open, or System Settings → Privacy & Security → Open Anyway).
- macOS deleting `/Applications/Folio.app` together with the malware alert is part of the system's remediation, not a second bug; the fix is a rebuild on a supported runtime line.
- Cross-targeting another OS without the extra tooling it needs fails; each OS's packages are built on that OS.
- A second, unused copy of the theme folder inside the app package does not apply the Aptos-font exclusion, so fonts a maintainer copied locally could end up in that copy (recorded as a retroactive finding in research.md).
- The runtime line adopted in August 2026 needs a newer JavaScript toolchain release than the minimum the README states (recorded in research.md).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide one maintainer command, `npm run dist`, that packages Folio for the host OS, plus `npm run dist:win`, `npm run dist:mac` and `npm run dist:linux`, which name the target OS explicitly.
- **FR-002**: Packaging MUST produce an NSIS installer for Windows, a DMG for macOS, and both an AppImage and a .deb for Linux, all written to the project's `release/` folder, which is kept out of version control.
- **FR-003**: Every packaging command MUST run its stages in a fixed order (check or repair the development runtime per FR-016, rebuild the app from current sources, remove stale unpacked output per FR-019, then package) and MUST stop at the first failing stage with a non-zero exit.
- **FR-004**: Packages MUST present the app as "Folio" with one stable reverse-DNS application identifier and the project's version, MUST place it in the Productivity category on macOS and the Office category on Linux, and the .deb package MUST carry the maintainer's name and e-mail address in its metadata.
- **FR-005**: Packages MUST contain the app, its themes, its bundled documents and its icons, and MUST NOT contain source-map files. The theme files the packaged app loads MUST exclude font files supplied locally for the Word style (the Aptos fonts), which may not be redistributed.
- **FR-006**: Packaging MUST succeed from a standard Windows account without Administrator rights or Developer Mode, and on every OS without any code-signing certificate; builds are unsigned (ad-hoc signed on macOS).
- **FR-007**: Folio MUST have its own app icon (a light rounded tile with a darker frame, a stylized "F" and a teal editor-caret accent) and MUST use it for the Windows executable, the macOS app bundle and the Linux packages.
- **FR-008**: Folio's windows MUST show the app icon on Windows and Linux, including when run from source; if the icon file is missing, windows MUST still open with the default icon.
- **FR-009**: The project MUST keep the app icon and the Markdown-document icon as editable source drawings, and one command (`npm run icons`) MUST generate a 1024×1024 PNG, a Windows icon file and a macOS icon file from each. The generated files MUST be committed, so packaging never has to regenerate them.
- **FR-010**: Icon generation MUST stop with an error that names a missing source drawing, and with an error naming the icon file it failed to build.
- **FR-011**: The Windows installer MUST register a Folio-owned file type described as "Markdown Document" (content type `text/markdown`, Folio as its editor) for `.md`, `.markdown`, `.mdown`, `.mkd` and `.mkdn`, and that file type MUST use the Markdown-document icon rather than the app icon.
- **FR-012**: The macOS app MUST declare itself an editor of Markdown and plain-text documents at alternate rank (offered in "Open With" without claiming to be the default), with the Markdown-document icon for those documents.
- **FR-013**: The macOS app MUST declare that it can view folders at the lowest handler rank, so folders can be handed to it without Folio ever becoming a folder's default app. Handling the received file or folder is specified in 003.
- **FR-014**: The Markdown-document icon MUST be visibly different from the app icon: a sheet of paper with a folded upper-right corner and the Folio glyph inside.
- **FR-015**: The README MUST explain how a Windows user who chose Folio for `.md` files manually before installing gets the document icon (re-choose Folio once through "Open with → Choose another app → Always").
- **FR-016**: After `npm install`, and before running from source (`npm start`) or packaging, the project MUST check that the development runtime is completely unpacked (its recorded version matches the installed version and its platform executable exists) and MUST change nothing when it is.
- **FR-017**: When the runtime is not unpacked, the project MUST find the runtime download for the host OS and CPU architecture in the standard download cache locations (and in any cache location the maintainer configured), let the runtime's own installer download it when it is not cached, unpack it with the OS's built-in unzip tool, and record where the executable is. On an Apple Silicon Mac running the toolchain under emulation it MUST choose the Apple Silicon runtime, and an explicitly configured architecture MUST take precedence.
- **FR-018**: When the runtime download can be neither found nor fetched, the unzip tool fails, or unpacking does not produce the runtime executable, the check MUST stop the calling command with a one-line explanation and a non-zero exit. The check MUST also be runnable on its own through a documented command.
- **FR-019**: Before packaging, the project MUST delete every previous unpacked output folder in `release/`, and only those (built installers stay). When one cannot be deleted because a file in it is locked, packaging MUST stop with a message that names the folder, says a running Folio is the most likely cause, and asks the maintainer to close it and run the command again.
- **FR-020**: When packaging fails with the transient Windows executable-editing lock ("Unable to commit changes"), the project MUST re-run packaging automatically, up to 3 attempts in total with a 4-second pause between attempts, showing the packager's output live and an "attempt n/3" notice. After the last failed attempt it MUST print guidance (close any running Folio, exclude the release folder from antivirus scanning) and exit with the packager's exit code.
- **FR-021**: Any packaging failure other than that lock MUST end immediately with the packager's own exit code, and options given to a packaging command (such as the target OS) MUST reach the packager unchanged.
- **FR-022**: The project MUST provide a one-shot rebuild command, `pwsh scripts/build.ps1` (PowerShell 7 or later, on any OS), that regenerates the icons and then packages, with options to wipe `release/` first (Clean), install dependencies first (Install), skip icon generation (SkipIcons) and choose the target (Platform: current, the default, or win, mac or linux). It MUST stop at the first failing step, refuse to run on PowerShell older than 7, report a locked `release/` folder in plain words, and finish by listing the ten largest files in `release/` with their sizes in MB.
- **FR-023**: The README MUST document the Linux packaging prerequisites (the legacy `libcrypt.so.1` library needed to build the .deb and FUSE 2, `libfuse.so.2`, needed to run the AppImage) with the error each missing library causes, install commands for Fedora/RHEL and Debian/Ubuntu, and the AppImage-only alternative.
- **FR-024**: Folio MUST embed a runtime from a release line that still receives security fixes (one of the three newest major lines), upgraded together with the packager. A macOS troubleshooting guide MUST document the symptoms of a revoked runtime, a one-command diagnosis, the step-by-step fix, a temporary re-sign workaround, prevention advice and an incident log.
- **FR-025**: The README MUST describe every automatic packaging safeguard (runtime self-repair, stale-output cleanup, lock retry) and the build-environment failures behind them or needing manual action (runtime unpack failure, Windows file lock, missing Linux libraries, and the retired Windows signing-bundle privilege error), quoting the error text the maintainer will see and the remedy.

### Key Entities *(include if feature involves data)*

- **Release artifact**: An installable package for one OS (Windows NSIS installer, macOS DMG, Linux AppImage or .deb) written to `release/`, together with the unpacked app folder used to assemble it. Installers accumulate across builds; unpacked folders are replaced by every build.
- **Icon artwork**: The two editable source drawings (app icon and Markdown-document icon). Each is rendered into a 1024×1024 PNG, a Windows icon file and a macOS icon file; the drawings and the generated files are both version-controlled.
- **Markdown file-type registration**: The OS-level declaration that links Markdown extensions or content types to Folio: its description ("Markdown Document"), Folio's role (editor, and alternate handler on macOS) and the document icon, plus the macOS declaration that Folio can view folders.
- **Development runtime installation**: The locally installed app runtime used to run from source and to package. It is healthy when its recorded version matches the installed version and its platform executable exists; otherwise it can be repaired from the download cache.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 3 of 3 desktop operating systems, a maintainer without administrator rights, Developer Mode or a code-signing certificate turns a checkout into that OS's installable package(s) with one command.
- **SC-002**: After a Windows install, 5 of 5 Markdown extensions show the Markdown-document icon and the "Markdown Document" type and open in Folio on double-click, with no manual association step on a machine without an earlier per-user override.
- **SC-003**: All 6 per-OS icon files (2 drawings × 3 formats) are regenerated from the source drawings by 1 command; no per-OS icon file is ever edited by hand.
- **SC-004**: On a healthy installation the runtime check finishes in under 1 second without downloading or unpacking anything; on a broken one, the next `npm install`, `npm start` or packaging command repairs it with 0 manual steps.
- **SC-005**: A packaged Folio running from the release folder is reported in plain words before the packager starts in 100% of cases, instead of the cryptic lock error; a transient antivirus lock that clears within the retry window costs at most 8 seconds of extra waiting (two 4-second pauses) instead of a failed build.
- **SC-006**: Each of the 2 documented Linux library failures is fixed with 1 package-manager command from the README on Fedora/RHEL or Debian/Ubuntu.
- **SC-007**: A full clean rebuild (wipe outputs, install dependencies, regenerate icons, package) takes 1 command and ends with a size-sorted list of at most 10 produced files.
- **SC-008**: A macOS malware alert caused by a revoked runtime is confirmed with 1 diagnostic command and fixed by following the guide's 7 steps; the July 2026 incident was resolved this way.

## Assumptions

- Releases are built by the maintainer on the OS they target. Cross-targeting is possible but needs extra tooling and is not part of the verified workflow. Continuous integration, auto-update, app-store distribution and publishing releases are out of scope.
- Builds are unsigned (ad-hoc signed on macOS), so macOS asks the user to approve Folio once per machine. Signing and notarizing with a developer certificate is recommended in the macOS troubleshooting guide but is not part of this feature.
- The Windows installer keeps the packager's default behavior and does not change the user's PATH; installing a terminal command is specified in 003.
- This feature only declares and registers the file and folder associations. Opening what the OS hands to Folio (double-click, Open With, dropping a file or folder on the app) and the `folio` command are specified in 003; a second launch opening a new window is specified in 007.
- This feature decides what gets packaged, while the packaged content belongs to other specs: the app and its bundled documents (001), the themes and the Word style's Aptos fonts, which users supply themselves (004), and the self-hosted math fonts (009).
- Linux packages register no Markdown file association; Linux file-type registration is out of scope.
- A supported LTS release of the JavaScript toolchain is the recommended build environment. Runtime self-repair exists for bleeding-edge releases and is a no-op otherwise.
- Linux prerequisites are documented, not installed automatically. Fedora/RHEL and Debian/Ubuntu are the documented families; the Linux fixes were made on Fedora 44.
- The project keeps a single version (0.1.0); release numbering is out of scope.
- Ambiguities were resolved from the shipped code, commit messages and README (retroactive specification); no clarification questions were asked.
