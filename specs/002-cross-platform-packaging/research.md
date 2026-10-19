# Research: Cross-Platform Packaging, App Identity & File Associations

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-09 (reconstructed 2026-10-18)

Phase 0 had no open unknowns. Each decision below was recovered from code comments, commit messages and README text, and each entry cites its evidence.

### 1. One packager, one configuration, three operating systems

**Decision**: Package with electron-builder from the `build` block in `package.json` (`bd8f5ef`):

- Targets: `win.target` is `nsis`, `mac.target` is `dmg` and `linux.target` is `["AppImage", "deb"]`. Output goes to `release/`.
- `npm run dist` packages for the host.
- `dist:win`, `dist:mac` and `dist:linux` pass `--win`, `--mac` and `--linux`.
- README explains, since `59f97be`, that the host-specific variant is equivalent to `dist` and that other targets are cross-targeting.

**Rationale**: One declarative configuration in the existing manifest produces the three formats the README promises. There are no per-OS project files to maintain, and the npm scripts stay the single source of truth, the same principle `scripts/build.ps1` later states. Packaging on the host avoids cross-build tooling such as Wine for NSIS on macOS or Linux.

**Alternatives considered**:

- Separate per-OS installer projects: three configurations for a single maintainer.
- More Linux formats (Snap, Flatpak, RPM): not adopted, because the AppImage runs on any distribution and the .deb covers Debian/Ubuntu.
- Building every OS from one machine: kept possible, but unverified and documented as needing extra tooling.

### 2. Windows packaging without Administrator rights or Developer Mode

**Decision**: In `dd44537`, add `scripts/prepare-wincodesign.js` and run it in `dist` and `dist:win` before the packager:

- On Windows it downloads `winCodeSign-2.6.0.7z` and extracts it with `7za x -bd -snl- -y` (symlink creation disabled) into `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`.
- electron-builder then finds `windows-10\x64\signtool.exe` there and skips its own extraction.
- The helper does nothing on macOS and Linux, or when the cache is already populated.

`5f9a8a0` retired the helper together with the `prepare:wincodesign` script.

**Rationale**: The archive contains macOS `.dylib` symlinks. Creating symlinks on Windows requires Administrator rights or Developer Mode, so `npm run dist` failed with "Cannot create symbolic link : A required privilege is not held by the client", even though those darwin files are irrelevant to a Windows build (`dd44537`).

The electron-builder 26 upgrade (`57f8363`) removed `7zip-bin`, the helper's own dependency, from the tree. `package-lock.json` lists it up to `002f2bb` and no longer from `57f8363`. After that, the helper's `require('7zip-bin')` failed on any machine without a pre-populated cache.

Per README, electron-builder 26 tolerates the symlink failure, downloads its own 7-Zip on demand and fetches winCodeSign only when signing is configured. So the helper was deleted instead of repaired ("Fixing 7zip dependency", `5f9a8a0`).

**Alternatives considered**:

- Require Developer Mode or an elevated shell: rejected, because removing that requirement was the point of the change.
- Keep the helper and add `7zip-bin` as a direct dependency: unnecessary once the packager no longer needed the pre-extraction.
- Code-sign the Windows build: out of scope, since unsigned builds are acceptable (Principle V).

### 3. Self-healing Electron install instead of pinning the toolchain

**Decision**: Add `scripts/ensure-electron.js` (`6bf8c90`). It runs as `postinstall`, as `npm run ensure:electron`, and as the first stage of `start` and every `dist*` script.

It does nothing when all three hold:

- `node_modules/electron/dist/version` matches the package version.
- `path.txt` matches the platform executable path.
- That executable exists.

Otherwise it:

1. Looks for `electron-v<version>-<platform>-<arch>.zip` in the `@electron/get` cache roots, running Electron's `install.js` to download it when it's missing.
2. Extracts it with the native tool:
   - `ditto -x -k` on macOS, which preserves the `.app` bundle's symlinks and permissions.
   - `Expand-Archive` on Windows.
   - `unzip -o -q` elsewhere.
3. Hoists `electron.d.ts`, writes `path.txt` and re-verifies.

**Rationale**: On bleeding-edge Node releases (26+, per README), Electron's `extract-zip` (yauzl) extractor silently does nothing: it neither resolves nor rejects, and the process exits 0. That leaves no `path.txt` and an empty `dist/`, so `electron .` throws "Electron failed to install correctly". The download itself succeeds and is cached; only extraction is broken (comment in `scripts/ensure-electron.js`).

Re-running only the extraction, with a native tool, fixes exactly that step. The script mirrors `electron/install.js`, including `npm_config_arch` and the Rosetta → arm64 rule, and costs nothing on a healthy install, so it is safe on every platform and every install.

**Alternatives considered**:

- Require an Electron-supported Node LTS: still README's "most robust fix", but no help to someone already on a newer release.
- Delete `node_modules/electron` and reinstall, as the error message suggests: the same extractor no-ops again.
- Add a JavaScript unzip dependency: an extractor of the same class, plus a new dependency (Principle VI).

### 4. Neutralizing the Windows rcedit file lock

**Decision** (`002f2bb`):

- `scripts/clean-release.js` deletes every `release/*-unpacked` directory before packaging. It turns `EBUSY`, `EPERM`, `ENOTEMPTY` and `EACCES` into a "close any open Folio window and run the command again" message, with exit code 1.
- `scripts/run-electron-builder.js` runs electron-builder with the forwarded argv and tees its output. It re-runs only when the output contains `Unable to commit changes`, `rcedit-x64.exe` or `rcedit-ia32.exe`, for at most 3 attempts with 4 s between them. Any other failure exits immediately with electron-builder's code.

**Rationale**: electron-builder stamps version info and the icon into the freshly copied ~180 MB `Folio.exe` with rcedit.

- Defender's real-time scan, or a shell thumbnailer, can hold the new file open for a second. That defeats rcedit and electron-builder's own rapid in-process retries; waiting before re-running the whole package step clears it.
- A previously packaged Folio still running from `release\win-unpacked\` holds the file permanently. Deleting stale output up front turns that case into a clear message instead of the cryptic rcedit error.

Both rationales come from the code comments and from `002f2bb`.

**Alternatives considered**:

- Retry every failure: rejected, because it would mask and repeat real errors.
- Turn off executable editing in the packager: the packaged `Folio.exe` would lose its icon and version info.
- Ask users to disable antivirus: README suggests excluding only the project's `release\` folder, and only as a last resort.

### 5. App icon drawn once as SVG, outputs generated and committed

**Decision**: Keep the artwork as `build/icons/icon.svg`. `npm run icons` (`scripts/generate-icons.js`, `c5171da`) generates three files from it:

- `icon.png`: the 1024×1024 sharp master.
- `icon.ico`: `png2icons.createICO` with BICUBIC scaling and BMP-encoded entries.
- `icon.icns`: `png2icons.createICNS`.

The outputs are committed, and `win.icon`, `mac.icon` and `linux.icon` point at them.

`appIconPath()` in `src/main.js` passes `icon.ico` (Windows) or `icon.png` (elsewhere) to every `BrowserWindow` and returns `undefined` when the file is missing. Because `build/icons/**` is part of `build.files`, this also works inside the packaged app.

**Rationale**: The goal was to replace Electron's default icon with Folio's own mark: a light rounded tile with a stylized F and a teal caret, "evoking Typora's single-letter tile while being clearly Folio's own" (`c5171da`). The design evolved in two steps:

- `f96fc39` scaled the glyph 1.26× "so it fills more of the tile, closer to Typora's proportions".
- `68e67be` enlarged the tile (880 px, `rx` 200) and gave it a darker 26 px `#808A96` frame, "so the near-white tile stays visible on white backgrounds and survives downscaling to 16/32/48px favicons". The glyph grew to 1.45×.

Committing the outputs keeps sharp's native binaries off the packaging path. On Windows the packaged app takes its icon from the executable, so the window icon mainly serves `npm start` and Linux (code comment).

**Alternatives considered**:

- Hand-drawn bitmaps per size: more work for every artwork change.
- Regenerating icons on every `npm run dist`: puts the image toolchain on every packaging run.
- A single PNG left to the packager's implicit conversion: less control over the per-OS files that are reviewed and committed.

### 6. A distinct Markdown-document icon and per-OS associations

**Decision** (`59f97be`, building on the macOS document types from `61017d1`):

- **Document icon**: add `build/icons/document.svg`, a sheet with a folded upper-right corner and the Folio glyph at 1.3×. The same script generates `document.png`, `document.ico` and `document.icns` (`SOURCES = ['icon', 'document']`).
- **Windows**: declare `win.fileAssociations` with:
  - `ext`: `md`, `markdown`, `mdown`, `mkd`, `mkdn`
  - `name`: `Folio.Markdown`
  - `description`: `Markdown Document`
  - `mimeType`: `text/markdown`
  - `role`: `Editor`
  - `icon`: `build/icons/document.ico`
- **macOS**: keep the `CFBundleDocumentTypes` that `61017d1` added:
  - "Markdown Document": `Editor`, `LSHandlerRank` `Alternate`, content types `net.daringfireball.markdown` and `public.plain-text`.
  - "Folder": `Viewer`, `LSHandlerRank` `None`, `public.folder`.

  Then add `CFBundleTypeIconFile` `document.icns`, which `mac.extraResources` copies into `Contents/Resources`.

**Rationale**:

- Associating `.md` with Folio must not "turn every Markdown file into an app-tile icon" (comment in `scripts/generate-icons.js`). The Windows file type carries `document.ico` as its `DefaultIcon`, so Explorer shows *Markdown Document* with the document icon (README).
- The macOS types let Finder and `open` deliver Markdown files and folders to Folio, which 003's `open-file` handling needs.
- The `Alternate` and `None` ranks keep Folio from claiming defaults, consistent with complementing Typora (Principle II).

**Alternatives considered**:

- Reuse the app icon for documents: rejected for the reason above.
- One top-level `fileAssociations` shared by every target: not used. Windows gets an explicit block and macOS uses `extendInfo`, which leaves Linux without any declared association (finding 5).
- Claim `Owner` or `Default` rank on macOS: would displace the user's existing Markdown app.

### 7. Keep Electron on a supported line (macOS notarization revocation)

**Decision**: In `57f8363` (2026-08-03), upgrade two packages together:

- Electron from `^31.3.1` (locked 31.7.7) to `^43.2.0`.
- electron-builder from `^24.13.3` to `^26.15.3`.

Record the incident, diagnosis and prevention in `docs/macos-gatekeeper.md`.

**Rationale**: Folio's ad-hoc signed build has no signing team, so it inherits the code identity of the Electron runtime it embeds. On 2026-07-28, XProtect (v5352) revoked the notarization of Electron 31.7.7, which was end-of-life at the time. macOS reported Folio as malware, deleted `/Applications/Folio.app` and `release/mac-arm64/Folio.app`, and blocked `npm start` too.

The revocation is keyed to the binary's cdhash and is never lifted. Electron patches only the latest three majors, so staying on a supported line is the only durable defense. electron-builder moves with Electron because older builders don't understand newer Electron layouts and carry stale macOS signing logic (all from the guide). Recent Electron needs Node ≥ 22.12.0 to build (guide; `engines` in `package-lock.json`).

**Alternatives considered**:

- Ad-hoc re-signing (`codesign --force --deep --sign -`): it changes the cdhash and sidesteps the revocation, but any rebuild undoes it and the runtime stays unpatched. The guide offers it only as an emergency stopgap.
- Signing and notarizing with an Apple Developer ID: the guide's recommended prevention, not adopted because there is no certificate and unsigned builds are acceptable.

### 8. Document Linux prerequisites instead of scripting them

**Decision**: Add a README section, "Linux packaging prerequisites" (`4b2248b`). It covers two libraries:

- `libcrypt.so.1`, needed by electron-builder's bundled `fpm` to build the .deb.
- `libfuse.so.2`, needed to run AppImages.

It gives `sudo dnf install libxcrypt-compat fuse fuse-libs` for Fedora/RHEL and `sudo apt install libxcrypt1 libfuse2` for Debian/Ubuntu, plus an AppImage-only option. The same commit turned `author` into `{ name, email }`.

**Rationale**: Both failures come from system libraries that some distributions don't install by default; the fixes were made on Fedora 44.

- Without `libcrypt.so.1`, `fpm` fails with "ruby: error while loading shared libraries: libcrypt.so.1".
- Without FUSE 2, the AppImage prints "AppImages require FUSE to run".

Installing system packages needs the distribution's package manager and `sudo`, which a build script shouldn't do silently. The `author` change matters because, when `linux.maintainer` is unset, electron-builder fills the .deb `Maintainer` field from `author` and requires an e-mail address there.

**Alternatives considered**:

- Drop the .deb target: rejected, because Debian/Ubuntu users get a native package.
- Install the libraries from the build script: needs root and differs per distribution.
- Bundle the libraries: not possible for the host-side `fpm` or the FUSE runtime.

### 9. A PowerShell 7 one-shot rebuild that only orchestrates

**Decision**: Add `scripts/build.ps1` (`59f97be`). It runs these steps in order:

1. `[-Clean]` removes `release/`.
2. `[-Install]` runs `npm install`.
3. `npm run icons`, unless `-SkipIcons` is given.
4. `npm run dist`, or `dist:<Platform>`.

Its other rules:

- `-Platform` is validated against `current|win|mac|linux`.
- It requires PowerShell 7.
- `Invoke-Npm` turns any non-zero npm exit into a terminating error.
- It finishes by listing the ten largest files in `release/`.

**Rationale**: A full rebuild had become an ordered sequence: icons, then packaging, sometimes after an install or a clean. That sequence is easy to run out of order. pwsh runs on all three OSes, and comment-based help provides `-?` for free. Keeping the script "pure orchestration" leaves the npm scripts as the source of truth (README). `-Clean` exists because `npm run dist` removes only `*-unpacked` and leaves older installers in place.

**Alternatives considered**:

- A Bash or Make script: not available by default on Windows.
- Another Node script: would work, but PowerShell gives parameter validation and help for free.
- Folding icon generation into `dist`: would put the dev-only image toolchain on every packaging run.

### 10. Dependency refresh and the install-script allowlist

**Decision**: `218bccc` makes four changes:

- Raises `esbuild` to `^0.28.2`.
- Refreshes the lockfile: Electron 43.2.0 → 43.7.7, sharp 0.35.3 → 0.35.5, plus patch updates.
- Expands the inline JSON arrays in the `build` block.
- Adds a top-level `allowScripts` allowlist for `esbuild@0.28.2` and `electron-winstaller@5.4.0`.

**Rationale**: The constitution keeps the runtime on a supported line and re-checks compliance whenever a major dependency is upgraded. The allowlist covers exactly the two dependencies in `package-lock.json` that declare install scripts. Electron 43 declares none: the lockfile drops `hasInstallScript` for electron from `57f8363` on. That's why Electron needs no entry.

**Alternatives considered**: Leave dependencies alone until the next incident. The July 2026 revocation showed the cost of drifting onto an end-of-life runtime.

## Retroactive findings

1. **README's toolchain range is stale (Documentation gate, Toolchain constraint).**
   - README asks for "Node.js LTS (Node 18+; developed on Node 20/24)" and recommends "Node 18/20/22".
   - Since `57f8363`, `package-lock.json` records `engines.node` `>= 22.12.0` for electron 43.x and `>=22.12.0` for `@electron/get` 5.1.0.
   - `docs/macos-gatekeeper.md` says "recent Electron needs Node >= 22.12.0", and sharp 0.35.5 requires `>=20.9.0`.
   - Nothing enforces a minimum: `package.json` has no `engines` field and the repository has no `.nvmrc`.
2. **README doesn't link to the macOS troubleshooting guide.** `docs/macos-gatekeeper.md` can only be found by browsing `docs/`.
3. **README describes the Electron 31 install path.** "Electron's own `postinstall` step silently fails" matches Electron 31.7.7, whose lockfile entry has `hasInstallScript: true`. The electron 43.x entries have no install script and instead expose `install.js` as an `install-electron` bin. On a fresh `npm install`, Folio's own `postinstall` (`ensure-electron.js`) now downloads and unpacks the runtime, invoking `install.js` when the zip isn't cached. Behavior is unchanged and still a no-op when healthy; only the explanation is dated.
4. **Linux self-repair needs `unzip`, which README doesn't list.** `extractZip()` spawns `unzip` on Linux, and without it the repair fails with "Native unzip failed (exit null)". The macOS and Windows tools (`ditto`, `Expand-Archive`) are built in. README's Linux prerequisites name only `libcrypt.so.1` and `libfuse.so.2`.
5. **Linux has no Markdown association, and README doesn't say so (Principle V).** `fileAssociations` lives under `build.win` and the macOS types under `build.mac.extendInfo`, so neither the AppImage nor the .deb declares a Markdown MIME type. README's "Markdown file associations" covers only Windows and macOS. A side effect: `build/icons/document.png` is generated but nothing consumes it.
6. **The Aptos fonts could ship in an unused theme copy (Licensing constraint).**
   - `extraResources` copies `themes` with the filter `!**/fonts/*.ttf`, but `build.files` also includes `themes/**/*` with no such exclusion.
   - A maintainer who has copied the Aptos fonts into `themes/word/fonts/` would therefore pack them into the app archive. That copy is never read at run time, because `themesDir()` uses `process.resourcesPath/themes` when packaged.
   - A clean checkout is unaffected, because the fonts are git-ignored.
   - Follow-up: add `!**/fonts/*.ttf` to `files`, or drop `themes/**/*` from it.
7. **Stale comment in `scripts/generate-icons.js`.** The header says sharp and png2icons are "installed on demand — see the npm script". In fact the `icons` script is plain `node scripts/generate-icons.js`, and both packages are ordinary devDependencies installed by `npm install`, as README correctly states.
8. **README's AppImage-only shortcut bypasses the `dist` chain.** `electron-builder --linux AppImage` skips `ensure:electron`, `build:renderer`, `clean:release` and the lock retry. It also needs `npx` unless electron-builder is installed globally. Run `npm run build:renderer` first, so the package doesn't ship a stale or missing renderer bundle.
9. **Historical, resolved: Windows packaging broke between `57f8363` and `5f9a8a0`.** From 2026-08-03 to 2026-09-16, `dist` and `dist:win` still ran `prepare-wincodesign.js`. Its `require('7zip-bin')` no longer resolved after the electron-builder 26 upgrade, so Windows packaging failed with "Cannot find '7zip-bin'" on any machine whose winCodeSign cache wasn't already populated. `5f9a8a0` ("Fixing 7zip dependency") removed the step.
10. **electron-builder 26 internals can't be verified from the repository.** README states that electron-builder 26 tolerates the symlink failure, downloads 7-Zip on demand and fetches winCodeSign only when signing is configured. These are the maintainer's observations. The evidence in the repository is the removal of the workaround and unsigned Windows builds continuing afterwards.
11. **Plain-text files on macOS.** The "Markdown Document" type also lists `public.plain-text`, so Finder offers Folio in "Open With" for every plain-text file. README mentions only Markdown.
12. **The cleanup only matches `-unpacked` folders.** `clean-release.js` removes directories whose names end in `-unpacked`, such as `win-unpacked` and `linux-unpacked`. macOS output such as `release/mac-arm64/` is not touched. This matches README ("only clears `release/*-unpacked`") and is harmless, because the rcedit lock affects only Windows targets.
