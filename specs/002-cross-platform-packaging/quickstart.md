# Quickstart: Validate Cross-Platform Packaging, App Identity & File Associations

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/](./contracts/) | **Data model**: [data-model.md](./data-model.md)

This guide proves the feature end to end on the machine you are on. Packaging is host-only, so run Scenario 1 on each OS you want to verify, and list the OSes you did not verify in the change description (constitution gate 4).

## Prerequisites

- **Node.js ≥ 22.12.0**: Electron 43 requires it since `57f8363`. README's "Node 18+" is outdated (research finding 1).
- **Dependencies**: from a clean checkout, run `npm install`. On a healthy machine the `postinstall` step prints `[ensure-electron] electron <version> already installed — nothing to do.`.
- **Windows**: a standard (non-administrator) account with Developer Mode off (Settings → System → For developers).
- **Linux**: `libcrypt.so.1` and `libfuse.so.2`:
  - Fedora/RHEL: `sudo dnf install libxcrypt-compat fuse fuse-libs`
  - Debian/Ubuntu: `sudo apt install libxcrypt1 libfuse2`

  Scenario 4 also needs `unzip` on Linux.
- **PowerShell 7+ (`pwsh`)** for Scenario 6.
- **Test documents**: `samples/welcome.md` and `samples/formatting-tour.md`. For Scenario 3, copy one of them into a scratch folder as `note.md`, `note.markdown`, `note.mdown`, `note.mkd` and `note.mkdn`.

## Run

```sh
npm start                                  # ensure runtime → build renderer → launch (dev)
npm start -- samples/formatting-tour.md    # dev launch with a file (launch rules: 003)
npm run dist                               # package for the host OS into release/
```

## Scenario 1: Package for the host OS (User Story 1; FR-001–FR-006)

1. Run `npm run dist`. On Windows, use a non-elevated terminal.
2. The log shows, in order:
   1. `[ensure-electron] … nothing to do.`
   2. The renderer build.
   3. `[clean-release] …`.
   4. The packager's output.

   The exit code is 0. On Windows, there is no "A required privilege is not held by the client" error.
3. `release/` contains the artifacts listed in [contracts/packaging-targets.md](./contracts/packaging-targets.md):
   - Windows: the NSIS `.exe` and `win-unpacked/`.
   - macOS: `Folio-<version>-arm64.dmg` on Apple Silicon, and `mac-arm64/Folio.app`.
   - Linux: the `.AppImage`, the `.deb` and `linux-unpacked/`.
4. On Debian/Ubuntu, check the .deb maintainer: `dpkg-deb -f release/<package>.deb Maintainer` prints the author's name and e-mail.
5. Check the contents:
   - **No source maps**: `npx @electron/asar list <unpacked-dir>/resources/app.asar | grep '\.map$'` prints nothing. On macOS the archive is at `Folio.app/Contents/Resources/app.asar`.
   - **No Aptos fonts in the theme resources**: with Aptos `.ttf` files present in `themes/word/fonts/`, `<unpacked-dir>/resources/themes/word/fonts/` contains only `README.txt`.
   - **Known gap**: the same `asar list` piped through `grep 'fonts/.*\.ttf'` lists those fonts inside the unused archive copy, which reproduces research finding 6.
6. Install and launch:
   - **Windows**: run the installer.
   - **macOS**: open the DMG and drag Folio to Applications. On first launch, use right-click → **Open** or System Settings → Privacy & Security → **Open Anyway**.
   - **Linux**: `chmod +x` the AppImage and run it, or install the .deb with `sudo apt install ./release/<package>.deb`.

   **Expected**: Folio opens its welcome document, and every Themes choice (Style × Appearance × Page width, [004](../004-three-axis-theming/spec.md)) restyles the page. The Word style falls back to its substitute fonts unless the system provides Aptos.

## Scenario 2: App icon (User Story 2; FR-007–FR-010)

1. Run `npm start`. On Windows and Linux, the window and taskbar show the Folio tile, not the runtime's default icon. On macOS, the Dock shows the development runtime's icon, which is expected.
2. In the installed builds, the Folio tile appears on `Folio.exe` in Explorer and on the taskbar (Windows), in Finder and the Dock (macOS), and in the application menu and on the window (Linux).
3. Look at the tile on a white background and at small sizes, for example Explorer "Small icons". The dark frame keeps it distinguishable.
4. Run `npm run icons`. It prints `[icons] wrote icon.png, icon.ico, icon.icns` and then `[icons] wrote document.png, document.ico, document.icns`. Only these six files in `build/icons/` can change. If the SVGs didn't change, restore them with `git restore build/icons`.
5. **Missing source**: temporarily rename `build/icons/document.svg` and run `npm run icons`. It fails with `[icons] Missing source icon: …document.svg` and exits 1, after `icon.*` was already rewritten. Restore the file.
6. **Missing icon at run time** (Linux or macOS): temporarily rename `build/icons/icon.png` and run `npm start`. The window still opens, with the default icon. Restore the file.

## Scenario 3: Markdown associations and the document icon (User Story 3; FR-011–FR-015)

**Windows**, with the NSIS build installed:

1. In Explorer's Details view, the scratch-folder files of all five extensions show **Type: Markdown Document** and the document icon (a page with a folded corner and the F glyph).
2. Double-click each file: it opens in Folio. While Folio is already running, the file opens in a new window ([007](../007-multiple-windows/spec.md)).
3. On a machine that had `.md` set to Folio through "Open with → Always use this app" before the install, files may show the plain executable icon. Choose **Open with → Choose another app → Folio → Always** once, and the document icon appears.

**macOS**, with Folio installed from the DMG:

1. In Finder, right-click `note.md` → **Open With**: Folio is listed, and it is also listed for a `.txt` file. The default app is unchanged.
2. Use **Get Info → Open with: Folio → Change All…**. `.md` files then show the document icon.
3. Drag a folder onto Folio's Dock icon. Folio accepts it and opens it in folder mode (003 and [005](../005-folder-mode-navigation/spec.md)). Folders still open in Finder by default.

**Linux**:

1. The installed desktop entry declares no Markdown `MimeType` (research finding 5). Open files from Folio, or pass them on the command line.

## Scenario 4: Runtime self-repair (User Story 4; FR-016–FR-018)

1. Run `npm run ensure:electron`. It prints `[ensure-electron] electron <version> already installed — nothing to do.`.
2. Simulate the bleeding-edge failure by deleting the unpacked runtime but keeping its cached download:
   - macOS/Linux: `rm -rf node_modules/electron/dist node_modules/electron/path.txt`
   - Windows: `Remove-Item -Recurse -Force node_modules/electron/dist, node_modules/electron/path.txt`
3. Run `npm start`. It prints `binary missing; looking for electron-v<version>-<platform>-<arch>.zip in the cache…`, then `extracting … with the native unzip tool…`, then `ready: electron <version> unpacked.`. Folio launches.
4. Run `npm run ensure:electron` again. It prints "already installed — nothing to do.".
5. **Offline failure**: repeat step 2, move the cached zip out of the cache folder (see [contracts/ensure-electron.md](./contracts/ensure-electron.md) for the locations), and disconnect from the network. Run `npm start`. It stops with `[ensure-electron] Could not find or download …. Check your network connection and re-run.` and exit 1, and the renderer build never starts. Restore the network or the cache and re-run.
6. **Linux without `unzip`** (optional): the repair fails with `Native unzip failed (exit null)…`. Install `unzip` and re-run.

## Scenario 5: Windows file-lock resilience (User Story 5; FR-019–FR-021)

1. After a successful `npm run dist`, launch `release\win-unpacked\Folio.exe`.
2. Run `npm run dist`. It stops with `[clean-release] Could not delete …\release\win-unpacked` and "A file there is locked — most likely a running Folio.", exits 1, and the packager never starts.
3. Close Folio and re-run. It prints `[clean-release] removed release\win-unpacked` and packaging succeeds. Installers from earlier builds are still in `release\`.
4. **Retry path** (observational, triggered by an antivirus scan): the log shows `[dist] electron-builder hit the transient rcedit file lock (attempt 1/3). Retrying in 4s…`. After a third failed attempt, the guidance about closing Folio and excluding `release\` from antivirus scanning appears, and the packager's exit code is returned.
5. **Fail fast**: any non-lock failure, such as Scenario 6 step 4 on Linux, is printed once, with no "Retrying" line.
6. **Any OS**: delete `release/` and run `npm run clean:release`. It prints `[clean-release] no release/ directory — nothing to clean.` and exits 0.

## Scenario 6: One-shot rebuild and maintenance docs (User Story 6; FR-022–FR-025)

1. Run `pwsh scripts/build.ps1 -?`. The help describes `-Platform`, `-Install`, `-Clean` and `-SkipIcons`, with examples.
2. Run `pwsh scripts/build.ps1 -Clean`. It prints `==> Cleaning …`, `==> Generating icons`, `==> Packaging (dist)` and `==> Done`, followed by at most 10 lines of the form `<size> MB  <file>`, largest first.
3. Run `pwsh scripts/build.ps1 -SkipIcons -Platform <host>` with `<host>` set to `win`, `mac` or `linux`. It has no icons step and runs `npm run dist:<host>`.
4. **Linux library failures**: on Fedora without `libxcrypt-compat`, `npm run dist` fails with "error while loading shared libraries: libcrypt.so.1". Install the packages from README, re-run, and packaging succeeds. Without FUSE 2, running the AppImage prints "AppImages require FUSE to run". Install FUSE 2 and run it again.
5. **Windows PowerShell 5.1**: `powershell -File scripts/build.ps1` refuses with `This script needs PowerShell 7+ (pwsh); found 5.1…`.
6. **macOS runtime health**:
   - `spctl -a -vvv /Applications/Folio.app` and `spctl -a -vvv node_modules/electron/dist/Electron.app` must not report `revoked`. For an ad-hoc build, `rejected` or "code has no resources but signature indicates they must be present" are normal.
   - If either reports `revoked`, follow `docs/macos-gatekeeper.md`: purge, upgrade, verify, smoke-test, rebuild, reinstall, approve.
7. **README review**: the README sections "If Electron fails to install correctly", "Linux packaging prerequisites", "Windows packaging note" and "Windows 'Unable to commit changes' (rcedit) note" quote the error texts seen in Scenarios 1 and 4–6.

## Scenario 7: Constitution gates for this feature

| Gate | How it applies | Result expected |
|---|---|---|
| 1. `npm run build:renderer` | It runs as stage 2 of every `dist*` script, and can also be run alone | No esbuild errors |
| 2. Smoke test with `npm start` | Run Scenario 2 step 1 and Scenario 4 step 3. Opening an associated file while Folio runs opens a new window (007), so no open document is replaced and the unsaved-changes guard is not exercised by this feature | App launches with its icon (Windows/Linux) |
| 3. Light/Dark | Check the app tile and the document icon on a light and on a dark taskbar, Dock or Explorer background | Frame and glyph visible on both |
| 4. `npm run dist` on the host | Scenario 1 on each verified OS | Artifacts in `release/`; list unverified OSes in the change description |
| 5. Principle III review | Not applicable: no IPC, preload, CSP, sanitization or external-open change | None |
