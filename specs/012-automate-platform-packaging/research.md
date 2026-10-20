# Research: Product Version, Consumer Guide, and Automated Cross-Platform Packages

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-19

**Status**: Phase 0 complete.
Repository findings were inspected locally; public toolchain findings were checked against the first-party references below.
Dates and versions describe the planning snapshot, not a promise that moving documentation or hosted images will stay unchanged.
No product files, dependencies, packages, or hosted workflows have been changed or executed by this planning work.

## 1. Product metadata belongs to the source, not the workflow

**Decision**: Update the root product version once to `1.0.0`, including the root and root-package entries in the lockfile.
Keep `package.json` authoritative for subsequent versions.
All packaging paths read and validate it; no workflow version constant, automatic bump, tag, or source rewrite is introduced.

**Rationale**: Both manifests currently declare `0.1.0`.
The existing About dialog already displays `app.getVersion()`, so the application can consume the declared version without another version mechanism.
The user's clarification explicitly makes the version update a product deliverable completed before pipeline work.

**Alternatives considered**: A workflow-level `1.0.0` value would drift from local builds and require pipeline edits for future releases.
Run-number-based product versions or tags would add unrequested release management.

**Evidence**: [package.json](../../package.json), [package-lock.json](../../package-lock.json), and `showAbout` in [src/main.js](../../src/main.js).

## 2. One consumer guide, available as an ordinary resource and through Help

**Decision**: Author `docs/user/README.md` independently of automation.
Copy it through electron-builder `extraResources` to `README.md` beside the packaged resource directory's other assets.
Add `Help > User Guide` and reuse the existing built-in document loader, unsaved-changes guard, untitled-buffer behavior, and error dialog.

**Rationale**: Existing `build.files` excludes `docs/`, while the app already loads mutable external theme resources and guarded built-in documents.
An ordinary resource remains readable outside the ASAR archive.
The Help entry makes it accessible inside a mounted AppImage and an installed macOS app without teaching consumers to unpack application internals.
Local development reads the same authored source file; local packages include it before CI exists.

**Alternatives considered**: Packaging the repository README would ship a long contributor-oriented document.
Keeping the guide only at a DMG root would lose it after ejection.
Keeping it only inside ASAR would not provide an ordinary installed README file.
Another viewer, browser window, or filesystem IPC capability is unnecessary.

**Evidence**: `BUILTIN_DOCS`, `builtinDocPath`, `openBuiltinDoc`, and `loadBuiltinDoc` in [src/main.js](../../src/main.js); the Help menu in [src/menu.js](../../src/menu.js).
The installed electron-builder `getFileMatchers` implementation combines common and platform-specific resource matchers, so the existing macOS document icon remains included.

## 3. Preserve the current packaging entry points and failure behavior

**Decision**: Retain the `dist*` npm chains, `scripts/build.ps1`, runtime self-repair, targeted unpacked-output cleanup, and the existing three-attempt rcedit-lock retry.
Use the build block for supported archive targets.
Compile Inno Setup from an `afterAllArtifactBuild` hook over a Windows ZIP target's completed unpacked application.
Return the produced setup paths through that hook's documented build-result interface.
Do not compile an installer for a deliberately unpacked-only `--dir` build.

**Rationale**: The existing wrapper forwards arguments and preserves failures instead of implementing its own packager.
A post-build hook leaves native resource stamping and ZIP creation with electron-builder and avoids an installer containing an incompletely processed executable.
The hook sees the current invocation's artifact paths, rather than inferring successful output from stale installers left in `release/`.

**Alternatives considered**: Replacing all npm commands with another packaging framework would duplicate working orchestration.
Building the installer before native executable processing could produce inconsistent app metadata.
Retrying compiler or configuration errors would hide real failures.

**Evidence**: [scripts/run-electron-builder.js](../../scripts/run-electron-builder.js), [scripts/clean-release.js](../../scripts/clean-release.js), [scripts/build.ps1](../../scripts/build.ps1).
The installed electron-builder `BuildResult` declares `outDir`, `artifactPaths`, `platformToTargets`, and `configuration`; `afterAllArtifactBuild` returns additional artifact paths.

## 4. Keep identity and require a deliberate transition from NSIS

**Decision**: Keep product `Folio`, npm name `folio`, application ID `com.dpokluda.folio`, executable `Folio.exe`, existing macOS declarations, and the settings-store location.
Use stable Inno application ID `com.dpokluda.folio`.
Detect legacy NSIS uninstall entries and ask the user to remove that installation through Windows Settings before proceeding.
Do not invoke its uninstaller automatically or delete user data.

**Rationale**: The specification requires a safe documented transition, not automatic cross-installer migration.
Avoiding overlapping installer ownership is simpler and safer than attempting to adopt files and registry entries from another installer technology.
Keeping source identity avoids accidentally moving Electron's `userData` directory.

**Alternatives considered**: Reusing the old uninstall registration as if it belonged to Inno would confuse removal and upgrades.
Silently installing alongside NSIS would leave conflicting active installations.
An automatic migration framework is outside scope.

**Evidence**: The existing NSIS implementation derives its uninstall identifier from the application ID using electron-builder's UUID namespace.
With the current app ID, the verified legacy key suffix is `9f5ff8db-51b6-575b-9468-75de01a1e384`.
Check the relevant per-user and machine registry views; do not identify another product solely by its display name.
The existing packaged ASAR metadata contains npm name `folio`, version `0.1.0`, and no overriding root `productName`.
The existing store uses `app.getPath('userData')`; do not replace it with a guessed title-cased directory.

## 5. Restore Windows shell registration explicitly when changing installer technology

**Decision**: The Inno installer owns per-user registration for `Folio.Markdown`, the five existing Markdown extensions, and the quoted file-open command.
Copy `build/icons/document.ico` as an ordinary Windows resource for the registry's document-icon reference.
Register Folio as an available handler without modifying protected user-choice settings or forcing another default app away.
Keep automatic PATH changes out of the installer.

**Rationale**: `win.fileAssociations` currently works through NSIS; an unrelated installer does not inherit those registry operations.
The ICO currently packed inside ASAR is not a valid ordinary Windows registry icon path.
The existing `File > Install 'folio' Command in PATH` behavior already covers optional terminal access.

**Alternatives considered**: Assuming electron-builder's NSIS registration is embedded in an unpacked application would lose associations.
Pointing the registry into ASAR would lose the document icon.
Forcing defaults or rewriting PATH would change unrelated user preferences.

**Evidence**: [Existing association contract](../002-cross-platform-packaging/contracts/file-associations.md), [package.json](../../package.json), and the shell-command installers in [src/main.js](../../src/main.js).

## 6. Respect licenses in every packaged copy

**Decision**: Retain the existing filtered external theme resources and add an explicit exclusion for `themes/word/fonts/*.ttf` in the ASAR file selection.
Inspect both locations during package validation.
Also copy the existing root `LICENSE` into ordinary packaged resources and preserve dependency license notices already included with the production dependencies.

**Rationale**: The baseline's broad `themes/**/*` ASAR inclusion does not apply the external resource filter.
The new packages must not reproduce that known redistribution gap.
This is directly required by FR-016, not unrelated cleanup.
The inspected existing package lacks Folio's root license text, whose MIT terms require the notice to accompany distributed copies.
Including that existing notice is part of producing complete new distributions, not introducing a new license or installer agreement.

**Alternatives considered**: Depending only on `.gitignore` would not protect local builds with personal font files.
Removing the established theme layout would expand the change unnecessarily.

**Evidence**: [Existing contents contract](../002-cross-platform-packaging/contracts/packaging-targets.md), [package.json](../../package.json), [.gitignore](../../.gitignore), and [LICENSE](../../LICENSE).
The existing macOS ASAR and ordinary resource directory were inspected read-only to distinguish app and dependency license inclusion.

## 7. Use locked development tools and narrow validation helpers

**Decision**: Use Node.js 24 LTS in CI and retain stable builder `26.15.3`.
Refresh the source lockfile from Electron `43.7.7` to the researched `43.8.1` within the existing major-43 manifest range before distributing the new packages.
Do not perform this refresh in the workflow.
Declare the already locked `semver` `7.8.5` and `@electron/asar` `3.4.1` explicitly as development dependencies when implementing their direct usage.
Use Node's built-in test runner for the small metadata, naming, architecture-header, and failure-propagation checks.

**Rationale**: The lockfile and installed dependencies resolve Electron `43.7.7`, which requires Node `>=22.12.0`, and builder `26.15.3`.
The repository README's older Node 18 guidance is not a safe CI baseline.
Official release metadata identifies active stable major lines 42, 43, and 44, so no runtime major-version migration is needed.
The older locked 43.7 minor is not the currently maintained minor of its line; a focused source lock refresh avoids distributing that stale minor.
Explicit development dependencies avoid relying on hoisted transitive packages for package validation, without adding runtime dependencies or another test framework.
Native OS tools handle archive extraction; package inspection uses the ASAR API rather than an incomplete custom ASAR parser.

**Alternatives considered**: The current host's Node 26 is not the chosen reproducible LTS baseline.
Installing another UI-testing framework is unnecessary for this packaging feature.
Testing only filenames or archive existence would miss wrong architectures, missing resources, and invalid archive permissions.

**Evidence**: Root lockfile entries and installed package metadata were read without changing dependencies.
The existing build uses `build.js` to vendor offline KaTeX assets and bundle the renderer; every `dist*` chain already invokes it.

## 8. Native public hosted runners, with no architecture fallback

**Decision**: Use `windows-2022`, `windows-11-arm`, `ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15-intel`, and `macos-15`.
Install Node 24 for the matching target architecture.
Keep all six jobs required; do not substitute a floating `latest` label or silently drop an unavailable architecture.

**Rationale**: GitHub's standard public-runner table covers all six combinations.
The current plain macOS version labels are Apple Silicon; Intel needs the explicit `-intel` label.
Runner images are maintained images, not immutable OS snapshots, so log their version and verify the expected architecture at job start.
Public standard-runner availability does not imply permanent artifact hosting or unlimited artifact storage.

**Alternatives considered**: One machine cross-packaging all operating systems adds Wine, signing, and native-toolchain complications.
Universal macOS packages change the agreed six-target matrix.
Paid larger runners or self-hosted infrastructure are not needed and are not provisioned.

**Sources**: [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [runner image labels](https://github.com/actions/runner-images), and [Windows ARM runner image](https://github.com/actions/runner-images/blob/main/images/windows/Windows11-Arm64-Readme.md).

## 9. Pin Fedora 44 and distinguish its runtime probe from desktop acceptance

**Decision**: Use Fedora 44 as the Linux compatibility reference on x64 and arm64.
Build on the native Ubuntu 24.04 runners, then run the extracted application payloads against Fedora 44 libraries in a matching-architecture container.
Retain actual Fedora desktop acceptance for AppImage self-mounting, sandbox behavior, UI, guide access, and file workflows.

**Rationale**: The Fedora 44 schedule records a 2026-04-28 final target and 2027-06-02 EOL.
Fedora 43 is close to EOL and Fedora 45 is scheduled immediately after this planning date.
There is no standard GitHub-hosted Fedora desktop runner.
The reference environment is release-pinned as `fedora:44`, not `fedora:latest`; log the resolved image digest.

**Alternatives considered**: Inferring Fedora support from an Ubuntu build does not satisfy FR-019.
Running an extracted binary in a container is useful evidence but does not prove that a desktop AppImage mounts with FUSE.
Provisioning a shared or customer machine for testing is not authorized by this plan.

**Prerequisite qualification**: The repository already documents `fuse` and `fuse-libs` on Fedora.
The upstream AppImage FUSE guide does not contain a Fedora-specific recipe.
The Fedora 44 check must verify that the documented packages provide the required `libfuse.so.2`; desktop acceptance must actually launch the produced AppImage.
A missing library causes a failed check and a corrected, verified recipe, not a disabled sandbox or a claim that an untested package works.

**Sources**: [Fedora 44 schedule](https://fedorapeople.org/groups/schedule/f-44/f-44-key-tasks.html), [Fedora EOL information](https://docs.fedoraproject.org/en-US/releases/eol/), [AppImage FUSE troubleshooting](https://docs.appimage.org/user-guide/troubleshooting/fuse.html), and the existing repository README's Linux prerequisites.

## 10. Use Inno Setup 6.7.3 as a compiler over the finished Windows payload

**Decision**: Pin Inno Setup `6.7.3`.
Provision it from the official versioned release, check its published digest and valid vendor signature, and compile using the established `/D`, `/O`, and `/F` arguments.
Use per-user installation and architecture-specific application payloads.

| Provisioning property | Planning snapshot |
| --------------------- | ----------------- |
| Official asset | `https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe` |
| Published SHA-256 | `9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732` |
| Expected signer | `Pyrsys B.V.` |
| Local/CI compiler override | `ISCC_PATH`, pointing to the verified `ISCC.exe` |

The digest was obtained from official release-asset metadata, not from a download executed during planning.
Implementation must verify the downloaded bytes before executing the installer.

**Rationale**: Inno Setup is not a built-in electron-builder Windows target.
The separate hook is necessary; changing a target string to an invented `inno` target would not work.
The compiler's license permits use and redistribution, including commercial use; requested financial support is not a mandatory signing or license purchase.

**Installer constraints**: Use `PrivilegesRequired=lowest`.
Use `x64compatible` or `arm64` in `ArchitecturesAllowed` and `ArchitecturesInstallIn64BitMode`.
The initial research considered `CloseApplications=yes` rather than `force`.
Implementation chose the more conservative `CloseApplications=no` with an explicit file-lock preflight.
Restart Manager session shutdown is not the same contract as Folio's asynchronous window-close/save guard.
Requiring normal user closure protects edits without relying on that equivalence, and post-install payload hashes still prevent reporting a partial replacement as success.
The bootstrap executable's own CPU type need not match its native Electron payload; verify `Folio.exe`, not just Setup's PE header.

**Alternatives considered**: A preinstalled compiler may drift or be at a different patch.
Inno 7 introduces an unnecessary toolchain change.
An unofficial marketplace setup action or another packaging framework is not required.

**Sources**: [Official release](https://github.com/jrsoftware/issrc/releases/tag/is-6_7_3), [download verification](https://jrsoftware.org/isdl-verify.php), [license](https://jrsoftware.org/files/is/license.txt), [compiler command line](https://jrsoftware.org/ishelp/topic_compilercmdline.htm), [per-user privileges](https://jrsoftware.org/ishelp/topic_setup_privilegesrequired.htm), [architecture restrictions](https://jrsoftware.org/ishelp/topic_setup_architecturesallowed.htm), [64-bit install mode](https://jrsoftware.org/ishelp/topic_setup_architecturesinstallin64bitmode.htm), and [running applications](https://jrsoftware.org/ishelp/topic_setup_closeapplications.htm).

## 11. Pin action commits and publish six immutable target bundles

**Decision**: Use the following reviewed first-party action commit pins, resolved from their current version tags during research.

| Action | Version snapshot | Commit pin |
| ------ | ---------------- | ---------- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-artifact` | `v7.0.2` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Upload one ordinarily ZIP-wrapped artifact per target, containing its two already-compressed package files.
Names include product version, target, source commit, run ID, and attempt.
Use no overwrite and follow repository-configured retention.
Do not use the newer single-file unwrapped upload option.

**Rationale**: Immutable run/attempt-scoped names avoid collisions without deleting earlier output.
The six bundles are convenient to download while preserving twelve actual product package files.
Actions wrapping does not change the formats or permissions encoded inside the tarballs and DMGs.
The uploaded AppImage itself may need the documented executable-bit step after download.

**Alternatives considered**: One mutable `latest` artifact would lose clear provenance.
Twelve separate uploads add bookkeeping without changing the requested outputs.
A fixed retention value could conflict with repository policy; permanent release hosting was explicitly rejected.

**Sources**: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [upload-artifact](https://github.com/actions/upload-artifact), [artifact storage and downloads](https://docs.github.com/en/actions/tutorials/store-and-share-data).

## 12. Use version-specific builder configuration and honest signing claims

**Decision**: Retain the v26 flat schema and explicit ad-hoc macOS signing with `mac.identity: "-"`, `mac.hardenedRuntime: false`, and notarization disabled.
Use certificate autodiscovery disabled in CI.
Do not migrate to the v27 schema or add Developer ID, paid certificates, Windows signing, or notarization.

**Rationale**: The live builder site now describes an upcoming v27 schema.
The installed `26.15.3` implementation directly confirms the flat properties, ad-hoc identity handling, and post-build hook used here.
Ad-hoc signing preserves bundle integrity without an Apple developer identity; it does not remove Gatekeeper approval or create Apple notarization.
The user's unsigned-build assumption means no purchased trust identity, not a ban on the integrity signatures used for runnable macOS bundles.

**Version-specific compatibility**: The tagged `v43.8.1` README documents macOS Monterey 12+, Windows 10+, and Linux builds made on Ubuntu 22.04 with Fedora 32+ among the verified distributions.
This matches local inspection of Electron `43.7.7` and the existing packaged app, which both declare `LSMinimumSystemVersion=12.0`.
The moving main-branch README's macOS Ventura 13 floor belongs to a newer runtime major and must not be applied retroactively.
Use macOS 15, Windows 11, and non-EOL Fedora 44 for the actual acceptance matrix.
These reference tests do not certify every older OS version named in upstream compatibility documentation.

**Sources**: Installed `MacPackager`, `MacTargetHelper`, and `macCodeSign` implementations, [builder macOS signing documentation](https://www.electron.build/docs/features/code-signing/code-signing-mac), [Electron support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), [Electron 43.8.1 release](https://github.com/electron/electron/releases/tag/v43.8.1), [version-specific platform support](https://github.com/electron/electron/blob/v43.8.1/README.md#platform-support), and [Node.js release schedule](https://github.com/nodejs/Release/blob/main/schedule.json).

## Verification boundary

All design questions have concrete decisions above.
Compiling the packages, confirming the native AppImage toolchain on the pinned builder, checking the Fedora package recipe, and completing the six-target desktop acceptance remain implementation validation work.
This research did not run native packages, install a compiler, change dependencies, or start a hosted workflow.
