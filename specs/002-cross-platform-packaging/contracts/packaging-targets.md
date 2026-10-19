# Contract: Packaging targets, identity and contents

**Feature**: [../spec.md](../spec.md) (User Story 1) | **Data model**: [../data-model.md](../data-model.md) §1, §3

**Source of truth**: `package.json` → `build`, consumed by electron-builder. It was introduced in bd8f5ef and later extended by c5171da, 61017d1, 59f97be and 218bccc.

## Identity

| Property | Value | Visible as |
|---|---|---|
| Product name | `Folio` | App, executable and bundle name |
| Application id | `com.dpokluda.folio` | macOS bundle identifier, the stable identity across builds |
| Version | `package.json` `version` (`0.1.0`) | Artifact names and app metadata |
| Maintainer | `author.name` and `author.email` (4b2248b) | The .deb `Maintainer` field (electron-builder requires the e-mail) |

## Targets and artifacts

| OS | Command (on that OS) | Target | Artifacts in `release/` | App icon | Category |
|---|---|---|---|---|---|
| Windows | `npm run dist` or `npm run dist:win` | `nsis` (packager defaults) | NSIS installer `.exe` and `win-unpacked/` | `build/icons/icon.ico` | none |
| macOS | `npm run dist` or `npm run dist:mac` | `dmg` | `.dmg` for the host architecture (for example `Folio-<version>-arm64.dmg`) and the app folder (for example `mac-arm64/Folio.app`) | `build/icons/icon.icns` | `public.app-category.productivity` |
| Linux | `npm run dist` or `npm run dist:linux` | `AppImage`, `deb` | `.AppImage`, `.deb` and `linux-unpacked/` | `build/icons/icon.png` | `Office` |

## Contents

| Location in the package | Taken from | Rule |
|---|---|---|
| App archive | `src/**/*`, `themes/**/*`, `samples/**/*`, `build/icons/**` | Excludes `**/*.map`. `build/icons/**` lets `appIconPath()` find the icon when packaged |
| `resources/themes/` | `themes/` | Excludes `**/fonts/*.ttf`. This is the copy the app loads: `themesDir()` uses `process.resourcesPath/themes` when packaged |
| `Folio.app/Contents/Resources/document.icns` (macOS only) | `build/icons/document.icns` | Referenced by `CFBundleTypeIconFile` |

Not packaged: `scripts/`, `docs/`, `specs/`, `build.js` and the root `README.md`, because none of them match the `build.files` patterns. devDependencies (electron-builder, esbuild, sharp, png2icons) are not bundled into the app either: the packager copies only production `dependencies`.

Two notes on contents:

- **Generated files**: the renderer bundle and the self-hosted math assets under `src/renderer/` are generated files. They are included through `src/**/*` only if `build:renderer` has run, which every `dist*` chain guarantees.
- **Known gap**: `themes/**/*` in the app archive has no `.ttf` exclusion. Aptos fonts present in the working tree would be packed into that unused copy (research finding 6).

## Signing

No signing is configured: there is no Windows certificate, no macOS identity, and no `hardenedRuntime` or `notarize` setting. The macOS build is ad-hoc signed, so the first launch needs a one-time "Open Anyway" approval. Signing and notarizing is listed as prevention advice in `docs/macos-gatekeeper.md`, not as a requirement.

## Preconditions

| OS | Requirement |
|---|---|
| All | Dependencies installed (`npm install`) and Node.js ≥ 22.12.0 since 57f8363 (Electron 43 `engines`) |
| Windows | Standard user account; neither Administrator rights nor Developer Mode needed (electron-builder 26, see research §2) |
| Linux | `libcrypt.so.1` to build the .deb (`libxcrypt-compat` on Fedora/RHEL, `libxcrypt1` on Debian/Ubuntu); `libfuse.so.2` to run the AppImage (`fuse fuse-libs`, `libfuse2`) |
| macOS | None beyond the toolchain. The DMG is built for the host architecture |

## Postconditions

- The installed app launches with themes loaded from `resources/themes/` and its bundled documents from the app archive ([001](../../001-markdown-viewer-editor/spec.md)).
- The app shows the Folio icon: on the executable and taskbar (Windows), the bundle and Dock (macOS), and the window and launcher entry (Linux).
- On Windows and macOS, the file associations in [file-associations.md](./file-associations.md) are registered by installation.
