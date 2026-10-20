# Contract: Local Packaging, Payloads, and Windows Installation

**Feature**: [spec.md](../spec.md) | **Model**: [data-model.md](../data-model.md)

## Local Commands and Source Inputs

The existing `npm run dist`, `dist:win`, `dist:mac`, and `dist:linux` remain the packaging entry points.
`scripts/build.ps1` continues to orchestrate those npm scripts.
The host-specific script and `dist` are equivalent on that host.
An explicit architecture flag is forwarded to electron-builder; no architecture flag means the existing host-default behavior.

| Command on matching host | Output |
| ------------------------ | ------ |
| `npm run dist:win -- --x64 --publish never` | Windows x64 ZIP and Inno setup EXE. |
| `npm run dist:win -- --arm64 --publish never` | Windows arm64 ZIP and Inno setup EXE. |
| `npm run dist:mac -- --x64 --publish never` | Intel DMG and application-bundle tar.gz. |
| `npm run dist:mac -- --arm64 --publish never` | Apple Silicon DMG and application-bundle tar.gz. |
| `npm run dist:linux -- AppImage tar.gz --x64 --publish never` | Linux x64 AppImage and tar.gz, without `.deb`. |
| `npm run dist:linux -- AppImage tar.gz --arm64 --publish never` | Linux arm64 AppImage and tar.gz, without `.deb`. |
| `npm run dist:linux` | Host AppImage, tar.gz, and the existing `.deb` capability. |
| `npm run dist -- --dir --publish never` | Deliberately unpacked-only output; no Inno compiler requirement. |

Before packaging, validate product SemVer, matching root lockfile metadata, guide existence, and required source assets.
The declared source version is never rewritten.
An absent prerequisite gives a named, actionable error and nonzero exit.
Existing runtime repair, renderer bundling, cleanup, and rcedit-only retry semantics are preserved.
Windows full distribution requires a supported Inno compiler; cross-host Inno compilation is not promised by this feature.

## Required Package Names

Let `V` be the validated source product version and `A` be `x64` or `arm64`.

| Target | Required files |
| ------ | -------------- |
| Windows | `Folio-V-windows-A.zip`, `Folio-V-windows-A-setup.exe` |
| Linux x64 | `Folio-V-linux-x64.tar.gz`, `Folio-V-linux-x86_64.AppImage` |
| Linux arm64 | `Folio-V-linux-arm64.tar.gz`, `Folio-V-linux-arm64.AppImage` |
| macOS | `Folio-V-macos-A.tar.gz`, `Folio-V-macos-A.dmg` |

Use explicit per-platform `artifactName` configuration rather than depending on builder's varying default filenames.
For AppImage only, electron-builder expands x64's architecture spelling as `x86_64`, so that file is `Folio-V-linux-x86_64.AppImage`.
The corresponding tarball and workflow target remain `x64`; arm64 filenames are unchanged.
Only the custom setup filename is supplied by the Inno integration.
Other local outputs may exist, but only these twelve payload files are published, each as a separate direct-file Actions artifact.

## Contents and Resource Locations

Every package contains a complete application, including its companion libraries and application resources.
Windows ZIP is not a single-executable product.
macOS tar.gz contains the complete `Folio.app`; extraction preserves bundle structure, symlinks, modes, and signatures.
Linux tar.gz contains the runnable `folio` application and its companions; executable modes are preserved.
AppImage is a runnable distribution file, not automatic desktop-menu installation.

| Resource | Windows/Linux application payload | macOS application bundle |
| -------- | --------------------------------- | ------------------------ |
| Consumer guide | `resources/README.md` | `Contents/Resources/README.md` |
| Product MIT license | `resources/LICENSE` | `Contents/Resources/LICENSE` |
| Active themes | `resources/themes/` | `Contents/Resources/themes/` |
| Product metadata and bundled documents | `resources/app.asar` | `Contents/Resources/app.asar` |
| Windows association icon | `resources/document.ico` | Not applicable. |
| macOS document icon | Not applicable. | Existing `Contents/Resources/document.icns`. |

Archive wrapper folders and AppImage internal layout may differ; the verifier locates exactly one application payload and validates its resource directory.
Do not change existing application IDs, executable names, document declarations, or user-data identity.
Keep production dependency notices.
Exclude personal Aptos TTF files from both external theme resources and the ASAR theme copy.
Generated renderer and KaTeX assets must still be present for offline operation.

## Inno Compilation

Use compiler `6.7.3`, resolved through explicit `ISCC_PATH` or a verified supported local installation.
An explicitly supplied invalid compiler path fails; it does not silently select a different version.
Local packaging never downloads or installs the compiler itself.
Both CI provisioning and the local hook call the same engine checker in `scripts/build-inno-installer.js`.
It compiles a minimal standard-input probe with output disabled and requires the engine to report `6.7.3`.
The launcher's PE `FileVersion` is not a compiler-version contract.
The diagnostic CLI is `node scripts/build-inno-installer.js --check-compiler <ISCC.exe>`.

The post-build hook receives electron-builder's actual current-invocation output.
For each completed Windows ZIP, select its matching completed unpacked payload and verify `Folio.exe` architecture.
Pass validated source version, target architecture, payload directory, and output destination to the `.iss` definition.
The compiler also receives the source-derived four-part numeric Windows version and a temporary payload-check include.
That include records installed-file SHA-256 checks so ignoring a locked or failed file cannot produce a reported successful partial replacement.
It is build metadata, not generated consumer documentation or a product-version mutation.
Compile after native resource/version processing, not before it.
Return only existing nonempty setup files as additional artifact paths.
Compiler spawn failure, nonzero status, or absent output fails the build with the original diagnostic context.

## Windows Install and Upgrade Behavior

Use `PrivilegesRequired=lowest`, stable `AppId=com.dpokluda.folio`, and default `%LOCALAPPDATA%\Programs\Folio`.
Set the appropriate `x64compatible` or `arm64` restrictions and 64-bit install mode.
Provide a current-user Start menu shortcut, the Folio icon, matching AppUserModelID, and ordinary uninstall support.
Do not modify PATH automatically.

Register `Folio.Markdown` for `.md`, `.markdown`, `.mdown`, `.mkd`, and `.mkdn` as an available per-user handler.
Its open command quotes both `Folio.exe` and the `%1` file argument.
Its document icon references the ordinary installed `resources/document.ico`, not a path inside ASAR.
Keep declarations consistent with the existing manifest, and verify actual registry state after installation.
Do not rewrite protected `UserChoice` values or another application's selected default.
On removal, delete only the installer's own registration and installed files, preserving other handlers and all user documents/settings.

Check legacy NSIS uninstall identity in the relevant HKCU/HKLM registry views.
If found, explain the safe uninstall-then-install transition and stop; do not execute that uninstaller automatically.
The guide explains that existing settings are preserved.

Allow replacing a build with another build of the same product version.
Use application-file replacement semantics that do not leave an older equal-version executable or guide in place.
Do not ask Restart Manager to close the application automatically.
Preflight existing payload files for replacement locks before installation, and require the user to close Folio through its normal save-guarded UI.
Session-shutdown messages must not bypass that asynchronous save dialog.
If closure is refused, files remain locked, or a required operation fails, Setup does not claim successful replacement.
An interactive post-install launch is optional; silent CI installation must not automatically launch the GUI.

## Verification CLI

```text
node scripts/package-metadata.js
node scripts/package-metadata.js --version
node scripts/verify-packages.js --platform windows|linux|macos --arch x64|arm64 --directory release
node scripts/verify-packages.js --platform linux --arch arm64 --directory release --fedora 44
```

The metadata command validates source inputs and prints JSON by default or only the validated product version with `--version`.
It is read-only and fails on invalid inputs.
The verifier checks both actual package files for its target and stages only those files under `release/artifacts/<platform>-<arch>/` on success.
Unknown target values, missing/empty files, extraction failures, wrong architecture/version, missing or changed guide, invalid resources, or native-probe failures produce nonzero exits.
The Linux-only `--fedora 44` option requires Docker and performs both Fedora probes inside the verifier's extraction lifetime, before staging or cleanup.
It is mandatory in Linux CI.
A local run without that option reports that Fedora checks were not requested; it does not claim Fedora qualification.
Reject the option for another platform or an unsupported reference release.

Windows verification refuses to start stateful checks if an existing Folio installation, owned shell registration, or conflicting shortcut is present.
It then performs temporary silent install/uninstall and owned shell-registration checks on the clean test account.
Resolve the temporary parent to its native canonical path before creating the owned test directory, so expanded shell-link paths match the installation paths.
Integration failures identify each mismatched command, icon, extension registration, registered application, or shortcut with its expected and actual values.
There is no force option to adopt or remove an existing installation.
macOS verification checks both extracted tarball and mounted/copied DMG contents and signatures.
Linux verification checks tarball and extracted AppImage contents.
Temporary mounts, processes, owned containers, and test installations are cleaned up without hiding an earlier failure.
Never clean up other containers, installations, user files, or shared resources.
Full GUI acceptance and Fedora compatibility evidence follow [quickstart.md](../quickstart.md); structural validation alone is not a claim that those passed.
