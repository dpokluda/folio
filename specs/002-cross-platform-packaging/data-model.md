# Data Model: Cross-Platform Packaging, App Identity & File Associations

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

This feature stores no user data and adds no settings keys to `folio-settings.json`. Its data is build configuration, generated assets, OS-level registrations and build state on disk. Each entity below cites where it lives.

## 1. Packaging configuration

**Lives in**: `package.json` → `build`, read by electron-builder.

| Field | Type | Value as shipped | Rules / notes | Since |
|---|---|---|---|---|
| `appId` | string (reverse DNS) | `com.dpokluda.folio` | Stable across builds; the macOS bundle identifier (`bundle_id` in the gatekeeper log) | bd8f5ef |
| `productName` | string | `Folio` | Name of the app, executable and bundle | bd8f5ef |
| `files` | glob[] | `src/**/*`, `themes/**/*`, `samples/**/*`, `build/icons/**`, `!**/*.map` | Packed into the app archive. `build/icons/**` was added in c5171da. Has no font exclusion (research finding 6) | bd8f5ef |
| `extraResources[0]` | FileSet | `{ from: "themes", to: "themes", filter: ["**/*", "!**/fonts/*.ttf"] }` | Copied to `resources/themes/`, which `themesDir()` reads when `app.isPackaged`. Never contains Aptos `.ttf` files | bd8f5ef |
| `directories.output` | path | `release` | The folder is git-ignored | bd8f5ef |
| `win.target` | string | `nsis` | No `nsis` block, so the packager's default installer options apply | bd8f5ef |
| `win.icon` | path | `build/icons/icon.ico` | | c5171da |
| `win.fileAssociations` | FileAssociation[] | see §5 | | 59f97be |
| `mac.target` | string | `dmg` | Host architecture | bd8f5ef |
| `mac.category` | string | `public.app-category.productivity` | | bd8f5ef |
| `mac.icon` | path | `build/icons/icon.icns` | | c5171da |
| `mac.extraResources` | FileSet[] | `[{ from: "build/icons/document.icns", to: "document.icns" }]` | macOS-only entry. Lands in `Folio.app/Contents/Resources/` | 59f97be |
| `mac.extendInfo.CFBundleDocumentTypes` | dict[] | see §6 | Merged into `Info.plist` | 61017d1 (icon 59f97be) |
| `linux.target` | string[] | `["AppImage", "deb"]` | | bd8f5ef |
| `linux.category` | string | `Office` | | bd8f5ef |
| `linux.icon` | path | `build/icons/icon.png` | 1024×1024 | c5171da |

Related manifest fields:

- `name`: `folio`.
- `version`: `0.1.0`, used in artifact names.
- `author`: `{ name, email }` (4b2248b). The e-mail is required for the .deb `Maintainer` field.
- `devDependencies`: `electron`, `electron-builder`, `esbuild`, `png2icons`, `sharp`.
- `allowScripts`: `esbuild@0.28.2` and `electron-winstaller@5.4.0` (218bccc).

No signing fields are set: no certificate, identity, `hardenedRuntime` or `notarize`.

## 2. Maintainer command chain

**Lives in**: `package.json` → `scripts`. See [contracts/npm-scripts.md](./contracts/npm-scripts.md).

`dist`, `dist:win`, `dist:mac` and `dist:linux` share one state machine:

```text
ENSURE_RUNTIME ──ok──▶ BUILD_RENDERER ──ok──▶ CLEAN_RELEASE ──ok──▶ PACKAGE(attempt k=1)
     │fail                  │fail                  │fail (locked dir)         │
     ▼                      ▼                      ▼                          ├─ exit 0 ─────────────▶ DONE (0)
  FAILED (1)            FAILED (n)             FAILED (1)                     ├─ lock signature, k<3 ─▶ wait 4 s ─▶ PACKAGE(k+1)
                                                                              ├─ lock signature, k=3 ─▶ FAILED (code) + guidance
                                                                              └─ any other failure ───▶ FAILED (code)
```

The other scripts:

- `start`: ENSURE_RUNTIME → BUILD_RENDERER → launch `electron .`.
- `postinstall`: ENSURE_RUNTIME only, run after `npm install`.
- `icons`: runs the icon pipeline (§4) and is independent of the chain.

History of the `dist` chain:

| Commit | Change |
|---|---|
| bd8f5ef | `npm run build:renderer && electron-builder` |
| dd44537 | `npm run prepare:wincodesign` inserted before the packager (`dist`, `dist:win` only) |
| 6bf8c90 | `npm run ensure:electron` prepended to every `dist*` and to `start` |
| 002f2bb | `npm run clean:release` inserted; `electron-builder` replaced by `node scripts/run-electron-builder.js [--win\|--mac\|--linux]` |
| 5f9a8a0 | `npm run prepare:wincodesign` removed |

## 3. Release folder

**Lives in**: `release/` (git-ignored).

| Item | Example | Lifecycle |
|---|---|---|
| Windows installer | NSIS `.exe` | Kept across builds; deleted only by `scripts/build.ps1 -Clean` |
| macOS disk image | `Folio-<version>-arm64.dmg` | Kept across builds |
| Linux packages | `.AppImage`, `.deb` | Kept across builds |
| Unpacked app | `win-unpacked/`, `linux-unpacked/` | Deleted by `scripts/clean-release.js` before every `dist*` run |
| macOS app folder | `mac-arm64/Folio.app` | Does not match `*-unpacked`, so `clean-release.js` doesn't touch it |

Packaging transitions:

- Absent → created by the first packaging run.
- `*-unpacked` folders are deleted, then rebuilt, on every `dist*` run.
- `build.ps1 -Clean` deletes the whole folder.
- A locked `*-unpacked` folder blocks packaging until the running Folio is closed.

## 4. Icon artwork

**Lives in**: `build/icons/`, generated by `scripts/generate-icons.js`.

| Source | Canvas | Design parameters | History |
|---|---|---|---|
| `icon.svg` | 1024×1024 | Tile at `x/y 72`, `880×880`, `rx 200`, gradient `#FFFFFF → #E6EAEF`. Frame stroke `#808A96`, 26 px. Glyph: F in `#2D333B` plus caret `#2DD4BF → #0EA5A3`, scaled 1.45× about (523, 512) | c5171da (832 px tile, 3 px `#D3D9DF` border); f96fc39 (glyph 1.26×); 68e67be (current) |
| `document.svg` | 1024×1024 | Page with folded upper-right corner, gradient `#FFFFFF → #E6EAEF`, frame `#808A96`, 26 px. Fold flap `#DCE2E9 → #BFC8D2`. Glyph scaled 1.3× and centred at (512, 610) | 59f97be |

Generated outputs:

| Output | Format | Consumer |
|---|---|---|
| `icon.png` | PNG 1024×1024 master (sharp) | `linux.icon`; `appIconPath()` on macOS/Linux |
| `icon.ico` | ICO from `png2icons.createICO(master, BICUBIC, 0, false)`, BMP-encoded entries | `win.icon`; `appIconPath()` on Windows |
| `icon.icns` | ICNS from `png2icons.createICNS(master, BICUBIC, 0)` | `mac.icon` |
| `document.png` | PNG 1024×1024 | none (research finding 5) |
| `document.ico` | ICO (BMP entries; same size as `icon.ico`, 432,254 bytes) | `win.fileAssociations[0].icon` |
| `document.icns` | ICNS | `mac.extraResources` → `CFBundleTypeIconFile` |

Validation rules:

- A missing source stops the run with `Missing source icon: <path>`.
- A failed conversion stops it with `Failed to build <name>.ico|icns`.
- Both are printed with the `[icons]` prefix and exit with code 1.
- Sources are processed in the order `icon`, then `document`, so `icon` outputs are already rewritten when the document step fails.

Outputs are committed next to their sources.

**Window icon**: `appIconPath()` in `src/main.js` returns `build/icons/icon.ico` on `win32` and `build/icons/icon.png` elsewhere, or `undefined` when the file is missing. `createWindow()` passes it as the `icon` option of every window.

## 5. Windows Markdown file type

**Lives in**: `package.json` → `build.win.fileAssociations[0]`.

| Field | Value | Effect after NSIS install (README) |
|---|---|---|
| `ext` | `md`, `markdown`, `mdown`, `mkd`, `mkdn` | The five extensions map to the Folio file type |
| `name` | `Folio.Markdown` | The registered file type |
| `description` | `Markdown Document` | Type name shown in Explorer |
| `mimeType` | `text/markdown` | Content type |
| `role` | `Editor` | Folio is the type's editor |
| `icon` | `build/icons/document.ico` | The type's `DefaultIcon`: the document icon, not the app icon |

**Relationship**: A per-user "Always use this app" choice made before installing resolves to the raw executable icon. That choice keeps priority until the user re-chooses Folio once (README).

## 6. macOS document types

**Lives in**: `package.json` → `build.mac.extendInfo.CFBundleDocumentTypes`, written into `Info.plist`.

| `CFBundleTypeName` | `CFBundleTypeRole` | `LSHandlerRank` | `LSItemContentTypes` | `CFBundleTypeIconFile` | Since |
|---|---|---|---|---|---|
| Markdown Document | Editor | Alternate | `net.daringfireball.markdown`, `public.plain-text` | `document.icns` | 61017d1; icon 59f97be |
| Folder | Viewer | None | `public.folder` | none | 61017d1 |

`Alternate` means Folio is listed as an alternate app without claiming the default. `None` means Folio can receive folders but is never their default app.

Linux declares no association (research finding 5). What Folio does with a received file or folder is specified in 003.

## 7. Development runtime installation

**Lives in**: `node_modules/electron/`, managed by `scripts/ensure-electron.js`.

| Field | Source | Rule |
|---|---|---|
| `version` | `node_modules/electron/package.json` | Expected version. If the file is missing, the state is NOT_INSTALLED |
| `dist/version` | file | Must equal `version` once a leading `v` is stripped |
| `path.txt` | file | Must equal the platform executable path |
| executable | `dist/<platform path>` | Must exist |
| platform path | `process.platform` | `darwin`/`mas`: `Electron.app/Contents/MacOS/Electron`; `linux`/`freebsd`/`openbsd`: `electron`; `win32`: `electron.exe`; any other platform is an error |
| arch | `npm_config_arch`, otherwise `process.arch` | On `darwin` x64 without an override, `sysctl -in sysctl.proc_translated` = `1` (Rosetta) selects `arm64` |
| archive | `electron-v<version>-<platform>-<arch>.zip` | Searched recursively; the first match wins |
| cache roots | `electron_config_cache`, `ELECTRON_CACHE`, then the OS default | OS defaults: `~/Library/Caches/electron`; `%LOCALAPPDATA%\electron\Cache`; `$XDG_CACHE_HOME`, or `~/.cache/electron` when unset. Duplicates and empty values are removed |

State transitions:

```text
NOT_INSTALLED ─────────────────────────────────────────▶ exit 0 (no-op, "run npm install first")
HEALTHY ───────────────────────────────────────────────▶ exit 0 (no-op, "already installed")
BINARY_MISSING ─▶ SEARCH_CACHE ─found─▶ EXTRACTING
                       │not found
                       ▼
                  DOWNLOADING (node install.js) ─▶ SEARCH_CACHE ─found─▶ EXTRACTING
                                                        │not found
                                                        ▼
                                                   FAILED ("Could not find or download …")
EXTRACTING: rm dist/ → native unzip ─exit≠0─▶ FAILED ("Native unzip failed …")
            └─ok─▶ hoist electron.d.ts → write path.txt ─▶ VERIFY ─ok─▶ HEALTHY ("ready")
                                                            └─fail─▶ FAILED ("Extraction did not produce …")
FAILED ─▶ "[ensure-electron] <message>", exit 1
          (fails `npm install`'s postinstall; stops `start` and `dist*` before any later stage)
```

## 8. Packaging attempt

**Lives in**: constants in `scripts/run-electron-builder.js`.

| Field | Value |
|---|---|
| `MAX_ATTEMPTS` | 3 |
| `RETRY_DELAY_MS` | 4000 |
| `LOCK_SIGNATURES` | `Unable to commit changes`, `rcedit-x64.exe`, `rcedit-ia32.exe` (matched in combined stdout and stderr) |
| `forwarded` | `process.argv.slice(2)`, for example `--win` |
| `builderBin` | `node_modules/.bin/electron-builder`, or `electron-builder.cmd` with `shell: true` on Windows |
| exit code | Packager code; `1` on a launch error or when the packager is killed by a signal |

The transitions are those of the PACKAGE state in §2.

## 9. Release cleanup

**Lives in**: `scripts/clean-release.js`.

| Field | Value |
|---|---|
| target | Every directory in `release/` whose name ends in `-unpacked` |
| delete options | `rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })` |
| lock codes | `EBUSY`, `EPERM`, `ENOTEMPTY`, `EACCES`: print a message naming the folder, then exit 1 |
| other errors | Rethrown (non-zero exit) |
| no-op cases | No `release/` folder; no `*-unpacked` folder |

## 10. One-shot rebuild options

**Lives in**: the `param()` block of `scripts/build.ps1`.

| Parameter | Type | Default | Validation | Effect |
|---|---|---|---|---|
| `Platform` | string | `current` | `ValidateSet('current','win','mac','linux')` | `current` runs `npm run dist`; any other value runs `npm run dist:<Platform>` |
| `Install` | switch | off | none | Runs `npm install` after the optional clean |
| `Clean` | switch | off | none | First removes the whole `release/` folder; a lock produces a "most likely a running Folio" error |
| `SkipIcons` | switch | off | none | Skips `npm run icons` |

The steps run in this order: Clean → Install → icons → dist → listing of the ten largest files in `release/`. PowerShell older than 7 throws before any step runs.

## 11. Runtime line

**Lives in**: `package.json` `devDependencies` and `package-lock.json`.

| Date | Electron range (locked) | electron-builder | Commit | Reason |
|---|---|---|---|---|
| 2026-07-09 | `^31.3.1` (31.7.7) | `^24.13.3` | bd8f5ef | Initial build |
| 2026-08-03 | `^43.2.0` (43.2.0) | `^26.15.3` | 57f8363 | XProtect revoked Electron 31.7.7 on 2026-07-28 (`docs/macos-gatekeeper.md`) |
| 2026-09-30 | `^43.2.0` (43.7.7) | `^26.15.3` | 218bccc | Dependency refresh |

Invariants:

- Electron stays within the latest three majors.
- electron-builder is upgraded together with Electron.
- The Node.js minimum follows Electron's `engines` field (≥ 22.12.0 for 43.x).
