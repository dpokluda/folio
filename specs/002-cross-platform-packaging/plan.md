# Implementation Plan: Cross-Platform Packaging, App Identity & File Associations

**Branch**: `002-cross-platform-packaging` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cross-platform-packaging/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `bd8f5ef` (baseline packaging targets), `dd44537`, `c5171da`, `f96fc39` (icon glyph only), `4b2248b`, `6bf8c90` (`scripts/ensure-electron.js` and its npm hooks only), `002f2bb`, `68e67be` (icon artwork only), `57f8363`, `61017d1` (macOS document types only), `59f97be`, `5f9a8a0` and `218bccc`. It describes the design as implemented, including the Windows signing-bundle workaround that `dd44537` added and `5f9a8a0` retired.

## Summary

Folio is packaged by electron-builder from a single `build` block in `package.json`: an NSIS installer (Windows), a DMG (macOS) and an AppImage plus a .deb (Linux), all written to `release/`. `themes/` is copied as `extraResources` minus `**/fonts/*.ttf`, so the Aptos fonts never reach the theme folder the packaged app loads. Every `dist*` npm script is a fail-fast chain, `ensure:electron` → `build:renderer` → `clean:release` → `node scripts/run-electron-builder.js [--win|--mac|--linux]`, built from small dependency-free Node helpers. `scripts/ensure-electron.js` re-unpacks the cached Electron zip with the OS's native unzip tool when Electron's installer silently fails on bleeding-edge Node releases. `scripts/clean-release.js` and `scripts/run-electron-builder.js` neutralize the Windows rcedit file lock.

App identity comes from two SVG sources in `build/icons/`, which `scripts/generate-icons.js` renders into committed `.png`, `.ico` and `.icns` files (using the dev-only sharp and png2icons). Markdown associations are declared in `win.fileAssociations` (the `Folio.Markdown` type) and in `mac.extendInfo.CFBundleDocumentTypes`, both with the document icon.

Maintenance is documented rather than automated:

- README covers the Linux library prerequisites and the retirement of `prepare-wincodesign.js` under electron-builder 26.
- `docs/macos-gatekeeper.md` is the playbook for a revoked macOS runtime (Electron 31.7.7 → 43.2.0).
- `scripts/build.ps1` is a cross-platform one-shot orchestrator.

## Technical Context

**Language/Version**: JavaScript, as CommonJS Node scripts in `scripts/` plus the main process (`src/main.js`); PowerShell 7+ for `scripts/build.ps1`; JSON packaging configuration in `package.json`; SVG icon sources.

**Primary Dependencies**:

- **At the time**: electron-builder `^24.13.3` packaging Electron `^31.3.1` (locked 31.7.7).
- **Runtime upgrade**: in `57f8363` (2026-08-03), after Apple revoked Electron 31.7.7's notarization, both moved together to electron `^43.2.0` and electron-builder `^26.15.3`. Electron has been locked at 43.7.7 since `218bccc`.
- **Icon tooling (dev-only)**: sharp `^0.35.3` (locked 0.35.5 since `218bccc`) and png2icons `^2.0.1` (`c5171da`).
- **Native OS tools for the runtime self-heal**: `ditto` (macOS), PowerShell `Expand-Archive` (Windows), `unzip` (Linux).
- **Historical**: `7zip-bin` 5.2.0, a transitive dependency of electron-builder 24, used by `scripts/prepare-wincodesign.js` (added in `dd44537`, deleted in `5f9a8a0`).

No runtime (production) dependency is added.

**Storage**: No user data. Build state lives on disk only:

- `release/` (git-ignored) holds the artifacts.
- `build/icons/` holds the committed sources and generated icons.
- The self-heal reads Electron's download cache: `~/Library/Caches/electron`, `%LOCALAPPDATA%\electron\Cache`, `$XDG_CACHE_HOME` or `~/.cache/electron`, or the `electron_config_cache` / `ELECTRON_CACHE` overrides.

`folio-settings.json` in userData is untouched.

**Testing**: No automated tests; manual verification per constitution quality gates and quickstart.md (gate 4: `npm run dist` on at least the host platform).

**Target Platform**: macOS, Windows, Linux desktop:

- **Windows**: NSIS installer (x64).
- **macOS**: DMG for the host architecture, e.g. `Folio-<version>-arm64.dmg`.
- **Linux**: AppImage + .deb. The Linux fixes were made on Fedora 44.

**Project Type**: desktop-app (Electron main + bundled renderer). This feature is the build and packaging layer around it, plus one main-process touch-point (`appIconPath()` in `src/main.js`).

**Performance Goals**:

- On a healthy install, the Electron check does a handful of file-system reads and no network access (well under 1 s).
- The rcedit retry adds at most 2 × 4 s of waiting.
- `clean-release.js` retries each deletion up to 3 times, with linear back-off starting at 200 ms.

**Constraints**:

- No Administrator rights or Developer Mode on Windows.
- Builds are unsigned (ad-hoc signed on macOS).
- No new runtime dependency and no new process type (Principle VI).
- Helpers are no-ops when not needed (`ensure-electron.js`, `clean-release.js`, and the retired `prepare-wincodesign.js`).
- Electron stays on one of the latest three majors and is upgraded together with electron-builder.
- Since `57f8363`, Node.js ≥ 22.12.0 is required: `package-lock.json` records it as the `engines` minimum of electron 43.x and `@electron/get` 5.1.0.

**Scale/Scope**:

- 3 OSes and 4 artifact types.
- 2 icon sources × 3 formats = 6 generated files.
- 5 Markdown extensions and 2 macOS document types.
- 6 helper scripts over the feature's life (5 current, 1 retired).
- 10 npm scripts added or rewired.

All Technical Context items were resolved from code and commits; none remain open.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | ✅ Pass | Packaging leaves the DOM contract untouched. `themes/` ships intact as `extraResources`, and `themesDir()` in `src/main.js` resolves `process.resourcesPath/themes` when `app.isPackaged`. The ordered `<link class="folio-theme">` layers therefore load the same files as in development. |
| II. Complement Typora | ✅ Pass | On macOS, Folio registers only as an `Editor` at `LSHandlerRank` `Alternate` for Markdown and plain text, and at `None` for folders, so it never displaces an existing default app. On Windows it registers its own `Folio.Markdown` type. Nothing beyond distribution is added. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | No change to `webPreferences`, the preload bridge, the CSP or sanitization. Associations only deliver paths to the launch handling owned by 003. Source maps are excluded from packages (`!**/*.map`). `scripts/` is not matched by `build.files`, so no build helper ships in the app. |
| IV. Never Lose the User's Work | N/A | No document, session or settings handling. Installing or rebuilding never touches `folio-settings.json` in `userData`. |
| V. Cross-Platform Parity | ⚠️ Pass with finding | `npm run dist` packages on all three OSes without admin rights or Developer Mode: first via `dd44537`, then via electron-builder 26 (`5f9a8a0`). Platform workarounds sit behind platform checks with why-comments: the `process.platform` switches in `scripts/ensure-electron.js`, and the `win32` branches in `appIconPath()` and `scripts/run-electron-builder.js`. Signing and notarization pitfalls are documented in `docs/macos-gatekeeper.md`. **Finding**: Linux packages declare no Markdown association, because associations exist only under `build.win` and `build.mac`, and README does not document this platform difference. |
| VI. Lean, Local, Self-Contained | ✅ Pass | Only dev-only dependencies were added (sharp, png2icons); they are needed for icon generation and are never packaged. The self-heal uses OS-native unzip tools instead of a new zip library. All helpers are small in-repo CommonJS scripts with no Electron import. The packaged app stays fully offline. |
| Technology & Platform Constraints + Workflow & Quality Gates | ⚠️ Pass with findings | **Runtime**: moved to a supported Electron line, with electron-builder upgraded alongside (`57f8363`). **Toolchain**: `ensure-electron.js` is a no-op when healthy. **Packaging**: NSIS, DMG and AppImage + deb go to `release/`; associations use the document icon; icons come from `npm run icons` and are committed. **Gates**: gate 1 runs inside every `dist*` script (`build:renderer`), and gate 4 is recorded in `dd44537` (clean-cache NSIS build end to end) and `c5171da` (icon embedded in the packaged `Folio.exe`). **Findings**: (a) README's toolchain range ("Node 18+", "Node 18/20/22") was not updated in `57f8363`, although Electron 43 declares Node ≥ 22.12.0 (Documentation gate, Toolchain constraint). (b) `build.files` packs `themes/**/*` into the app archive without the `!**/fonts/*.ttf` exclusion, so locally supplied Aptos fonts would ship in that unused copy (Licensing constraint). |

**Post-design re-check (after Phase 1)**: Unchanged. The contracts add no IPC channel, preload surface or CSP change. The ⚠️ items are documentation and configuration drift found while documenting the shipped code, not design decisions that need justification. They are recorded in [research.md](./research.md#retroactive-findings) for a follow-up feature directory (flow-forward).

## Project Structure

### Documentation (this feature)

```text
specs/002-cross-platform-packaging/
├── spec.md                          # Feature specification (/speckit-specify)
├── checklists/
│   └── requirements.md              # Specification quality checklist (/speckit-specify)
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/                       # Phase 1 output (/speckit-plan command)
│   ├── npm-scripts.md               # postinstall / start / icons / ensure:electron / clean:release / dist* chains
│   ├── packaging-targets.md         # package.json build block: identity, targets, contents, preconditions
│   ├── file-associations.md         # Windows Folio.Markdown type, macOS document types, Linux (none)
│   ├── icon-pipeline.md             # build/icons sources → generated icons → consumers, window icon
│   ├── ensure-electron.md           # Electron runtime self-heal CLI contract
│   ├── release-cleanup-and-retry.md # clean-release.js + run-electron-builder.js
│   └── build-ps1.md                 # one-shot rebuild CLI
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json                 # scripts (postinstall, ensure:electron, start, icons, clean:release, dist*),
                             # build{…}, author{name,email}, devDependencies, allowScripts
package-lock.json            # Electron 31.7.7 → 43.2.0 + electron-builder 26.15.3 (57f8363); refresh (218bccc)
.gitignore                   # release/ and the Aptos fonts kept out of git (bd8f5ef)
README.md                    # Packaging, One-shot rebuild, Linux packaging prerequisites, App & document icons,
                             # Markdown file associations, Windows notes, "If Electron fails to install correctly"
docs/
└── macos-gatekeeper.md      # revoked-runtime diagnosis, fix, prevention, incident log (57f8363)
build/icons/
├── icon.svg                 # app icon source (c5171da; glyph f96fc39; artwork 68e67be)
├── icon.png                 # generated 1024×1024 (linux.icon, window icon off Windows)
├── icon.ico                 # generated (win.icon, window icon on Windows)
├── icon.icns                # generated (mac.icon)
├── document.svg             # Markdown-document icon source (59f97be)
├── document.png             # generated (no consumer)
├── document.ico             # generated (Folio.Markdown file-type icon)
└── document.icns            # generated (CFBundleTypeIconFile)
scripts/
├── ensure-electron.js       # Electron runtime self-heal (6bf8c90)
├── clean-release.js         # remove release/*-unpacked before packaging (002f2bb)
├── run-electron-builder.js  # electron-builder wrapper with rcedit-lock retry (002f2bb)
├── generate-icons.js        # SVG → png/ico/icns (c5171da; both sources since 59f97be)
├── build.ps1                # one-shot rebuild orchestrator (59f97be)
└── prepare-wincodesign.js   # winCodeSign pre-extraction (dd44537; deleted in 5f9a8a0)
src/
└── main.js                  # appIconPath() + BrowserWindow icon (c5171da); packaged themesDir() (bd8f5ef)
```

**Structure Decision**: Packaging lives in build-time tooling at the repository root:

- `package.json` (npm scripts plus the electron-builder `build` block) is the single source of truth.
- `scripts/` holds small CommonJS helpers that run in plain Node without importing Electron, plus one PowerShell orchestrator that only calls npm scripts.
- `build/icons/` keeps the editable SVG sources next to their committed outputs.
- Troubleshooting lives in README.md and `docs/`.

The only runtime touch-point is `appIconPath()` in `src/main.js`; the renderer and the preload bridge are untouched.

## Complexity Tracking

No violations — table intentionally empty. The two ⚠️ rows in the Constitution Check record drift found while documenting the shipped code; they are open findings for a follow-up feature, not justified violations.
