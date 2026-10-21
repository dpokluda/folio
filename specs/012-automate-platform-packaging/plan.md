# Implementation Plan: Product Version, Consumer Guide, and Automated Cross-Platform Packages

**Branch**: `main` (in-place checkout; no branch created) | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: [Feature 012 specification](./spec.md)

**Planning status**: Phase 0 research and Phase 1 design complete.
This document describes implementation work; it does not claim that product changes, packages, or workflow runs have been completed.

## Summary

Deliver the work in the user's requested order: update the product's declared source version to `1.0.0`, author and ship a consumer README, then automate packaging.
The first two changes must work through the existing local build commands before the workflow is introduced.
Automation reads the version and guide from its checked-out revision; it neither changes product metadata nor generates documentation.

Retain electron-builder, the existing npm entry points, the renderer build, runtime self-repair, and targeted Windows file-lock retries.
Add Windows ZIP, macOS and Linux tar.gz archives, and a small Inno Setup integration over the completed Windows payload.
Publish only workflow artifacts for the six operating-system/architecture targets.
Expose the installed guide through the existing guarded built-in document flow rather than adding another document viewer or privileged bridge.

## Technical Context

**Language/Version**: Existing JavaScript modules; CommonJS main process and packaging scripts; existing esbuild-bundled renderer; YAML workflow; Inno Setup installer definition.

**Primary Dependencies**: Electron 43, with a focused lockfile refresh from `43.7.7` to researched supported-minor patch `43.8.1` before distributing the new packages; retain stable electron-builder `26.15.3`.
This is source maintenance within the existing `^43.2.0` range, not an automatic CI update or a runtime major-version migration.
Use Node.js 24 LTS for automation and Inno Setup `6.7.3` for Windows.
Promote the already locked `semver` `7.8.5` and `@electron/asar` `3.4.1` to explicit development dependencies for metadata and package inspection rather than relying on transitive imports.
No new application runtime dependency or framework.

**Storage**: Source-controlled product metadata and consumer guide; generated files under `release/`; run-scoped Actions artifacts.
Existing settings remain in Electron's unchanged `userData` directory.
No database, server, accounts, or telemetry.

**Testing**: Node's built-in test runner for focused packaging-helper tests; source metadata checks; actual archive extraction and package inspection; native runtime probes; manual installed-app acceptance on each target.
No new test framework.
Package inspection and runtime probes do not substitute for the user-facing acceptance checks.

**Target Platform**: Windows, Linux/Fedora, and macOS; native x64 and arm64 application payloads.
Reference acceptance systems are Windows 11, macOS 15, and Fedora 44 on both architectures.
Electron 43.8.1 documents Windows 10+ and macOS 12+; its Linux documentation includes Fedora 32+, but obsolete Fedora releases are not this feature's support reference.
Preserve those runtime deployment requirements rather than raising them from documentation for a newer Electron major.
The existing macOS runtime and package also declare deployment floor `12.0`.
Reference-system acceptance does not constitute testing on every older vendor-supported OS version.

**Project Type**: Existing offline desktop application plus local packaging tools and a delivery workflow.

**Performance Goals**: Build the renderer once per target invocation; package the same prepared application into the target's two distribution formats.
Retain npm download caching, but do not share architecture-specific installed dependencies or stale packaged outputs between targets.
No release-latency service-level objective is introduced.

**Constraints**: Standard-user Windows installation; no Developer Mode; no paid code-signing or notarization dependency; no version mutations in CI.
Keep all six targets and twelve required payload files.
Retain local `.deb` support without publishing `.deb` files in this workflow.

**Scale/Scope**: One product, one maintained consumer guide, six target pairs, twelve package payloads per complete workflow run.
Every update to `main` builds its resulting tip; feature-branch and pull-request publication is outside scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Pre-research assessment | Design constraint |
| ---- | ----------------------- | ----------------- |
| I. Typora compatibility | Pass | No renderer DOM, theme-layer, highlighting, or source-editor contract changes. |
| II. Viewer/light-editor scope | Pass | The consumer guide explains existing workflows; retain the non-affiliation disclaimer and acknowledgements. |
| III. Hardened shell | Pass | Reuse built-in document loading and existing IPC; do not relax isolation, sanitization, CSP, or OS security policy. |
| IV. Preserve user work | Pass | Guide access uses the dirty-document guard and untitled-buffer behavior; installation and removal preserve documents and settings. |
| V. Cross-platform parity | Pass with documented packaging exception | Both architectures and both formats on each OS; keep local npm packaging usable without elevated developer privileges. |
| VI. Lean, local, self-contained | Pass | No runtime dependency or new application architecture; bundled guide and assets remain available offline. |
| Packaging technology constraint | Justified exception | Replace NSIS with Inno Setup because the user explicitly selected it after being offered the simpler existing installer. See Complexity Tracking. |
| Supported runtime/toolchain | Pass with source-maintenance prerequisite | Electron 43 is in the verified active 42/43/44 set; refresh its outdated locked minor before distribution. Retain the already reviewed stable builder rather than adopting the live documentation's v27 alpha schema. |
| Development/documentation gates | Pass as planned obligations | Update the root README and consumer guide; record native acceptance separately from automated structural checks. |

**Pre-research result**: Pass with the specific, justified NSIS-to-Inno Setup exception below.
The constitution explicitly allows a violation to be justified in this plan's Complexity Tracking table.
This plan does not silently amend the constitution or rewrite the historical packaging specification.

**Post-design result**: Pass with the same documented Inno Setup exception.
The contracts retain the theme and IPC boundaries, use the existing dirty-document guard, preserve settings and shell-launch behavior, and cover all six target pairs.
The runtime patch refresh, native acceptance checks, and Fedora desktop checks are implementation gates, not claims of verification already performed.

## Project Structure

### Documentation (this feature)

```text
specs/012-automate-platform-packaging/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- checklists/requirements.md
`-- contracts/
    |-- packaging.md
    |-- user-guide.md
    `-- workflow.md
```

### Source Code (repository root)

```text
.github/workflows/package.yml       # New; added after the product changes
.github/scripts/setup-inno.ps1      # New; pinned compiler provisioning for CI only
package.json                       # Version, locked-tool declarations, packaging configuration
package-lock.json                  # Matching product version and explicit development tools
README.md                          # Existing repository guide, updated without wholesale replacement
docs/user/README.md                # New canonical consumer guide
build/windows/folio.iss            # New Inno Setup definition
scripts/
|-- package-metadata.js            # New shared source-version and expected-output checks
|-- build-inno-installer.js        # New afterAllArtifactBuild hook
|-- add-mac-archive-readme.js       # Visible README beside the signed app in macOS tar.gz only
|-- verify-packages.js             # New target-package validation and staging
|-- run-electron-builder.js        # Existing wrapper; add metadata/guide preflight only
|-- ensure-electron.js             # Preserve self-repair
|-- clean-release.js               # Preserve targeted cleanup
`-- build.ps1                      # Keep npm orchestration; update affected documentation
src/
|-- main.js                       # Resolve the consumer guide and reuse guarded document loading
`-- menu.js                       # Add Help > User Guide
tests/packaging.test.js             # New focused tests using node:test
release/                           # Generated only; never source-controlled
```

**Structure Decision**: Keep the single existing application and its build block in `package.json`.
The small packaging helpers own metadata, installer compilation, and validation separately; no general release framework or duplicate build configuration is introduced.
The Windows hook runs after electron-builder finishes its native executable/resource processing, so the installer wraps the completed payload.
`tasks.md` is not created by this command.

## Implementation Design

### 1. Finish the two product deliverables before adding the workflow

First update the product version and matching lockfile metadata to `1.0.0`.
Refresh Electron within major 43 to the researched supported minor, without updating unrelated dependencies or migrating builder schemas.
Author `docs/user/README.md`, copy it as an ordinary packaged resource, and add `Help > User Guide` through the current guarded built-in document flow.
Copy the existing MIT `LICENSE` alongside the guide.
Also copy the guide beside Windows/Linux executables and beside `Folio.app` in the macOS tar.gz, without changing startup behavior.
Keep the DMG's visible content limited to the app and Applications shortcut; its internal Help guide travels with the copied app.
Keep the root README, disclaimer, acknowledgements, and contributor material; add links rather than replacing it wholesale.

Demonstrate these changes with the existing local start and packaging commands before introducing the workflow.
The consumer guide must not depend on a workflow generator, artifact download, network connection, or source checkout to be read after installation.

### 2. Extend local packaging, not a separate CI-only packager

Keep `package.json` as electron-builder's configuration source.
Use Windows `zip`, macOS `dmg` plus `tar.gz`, and Linux `AppImage` plus `tar.gz` plus the existing local `deb`.
The workflow explicitly selects only `AppImage` and `tar.gz` for Linux.
Keep the existing `dist*` scripts and argument forwarding.

Add source-version, lockfile, and guide preflight to the existing builder wrapper before invoking the packager.
Keep its cleanup and rcedit-only retry behavior.
Use `afterAllArtifactBuild` to compile Inno Setup after the current invocation's Windows ZIP payloads are complete.
The hook handles only ZIPs reported by that build, validates their matching payload architecture, and returns the setup paths.
Unpacked-only `--dir` builds do not require Inno Setup.
Compiler failures are not retried as packaging locks and never yield a success-shaped result.

Use platform-specific `extraFiles` for the Windows/Linux root README.
The pinned builder does not support `extraDistFiles` for tar targets, so use a focused `artifactBuildCompleted` hook for macOS tar.gz.
Append the guide to its uncompressed tar stream and atomically replace the recompressed output, leaving signed app bytes and the DMG untouched.
Do not process stale artifacts or require this hook for unpacked-only builds.

Use explicit platform/architecture filenames and ordinary resource copies described in [the packaging contract](./contracts/packaging.md).
Close the known font exclusion gap in the unused ASAR theme copy as well as retaining the external resource filter.
Declare `semver` and `@electron/asar` explicitly as development tools at their already locked versions.

### 3. Use six explicit native hosted runners

| Target key | Hosted runner | Node architecture | Required payloads |
| ---------- | ------------- | ----------------- | ----------------- |
| `windows-x64` | `windows-2022` | `x64` | ZIP, Inno Setup EXE |
| `windows-arm64` | `windows-11-arm` | `arm64` | ZIP, Inno Setup EXE |
| `linux-x64` | `ubuntu-24.04` | `x64` | tar.gz, AppImage |
| `linux-arm64` | `ubuntu-24.04-arm` | `arm64` | tar.gz, AppImage |
| `macos-x64` | `macos-15-intel` | `x64` | tar.gz, DMG |
| `macos-arm64` | `macos-15` | `arm64` | tar.gz, DMG |

These are documented standard hosted runners for the public repository, not paid larger runners or newly provisioned self-hosted machines.
Check runner architecture as well as Node architecture; do not silently substitute Rosetta, x64 emulation, or another output architecture.
Native ARM application payloads are required even though some installer/compiler bootstrap tools may themselves use OS-supported emulation.

Trigger only on pushes to `main`; merging a pull request already produces that push.
Do not add pull-request, tag, or release publication triggers.
Keep all matrix jobs running when another fails, with `fail-fast: false`, no `continue-on-error`, and a 45-minute per-job timeout.
Do not add latest-only filtering or a branch-wide concurrency group that cancels or replaces older pushes.

Use the reviewed action commit pins in [research.md](./research.md), `contents: read`, and checkout credentials disabled after checkout.
Install Node 24 for the actual target architecture, use `npm ci`, and cache npm downloads rather than `node_modules` or `release/`.
Call the same local packaging scripts with an explicit architecture and `--publish never`.
Neither the source version nor the consumer README may change during the job.

### 4. Provision only the compiler, never release identity

On Windows CI, provision Inno Setup `6.7.3` from the official versioned release, verifying its recorded SHA-256 and valid vendor signature.
Install it into a runner-temporary per-user directory and expose `ISCC_PATH` for the packaging hook.
Do not elevate, install signing certificates, or silently use a different preinstalled compiler version.
Local packaging resolves a supported local compiler or gives an actionable prerequisite error; it does not install tools automatically.

Use Inno's per-user mode and architecture restrictions, stable application ID, and explicit shell registration.
Detect legacy NSIS identity and require its deliberate removal before switching installer technology.
Support same-version reinstallations because successive source revisions can legitimately retain the same product version.
Never force-close a running Folio or delete its user-data directory.
The implemented installer uses `CloseApplications=no` and a preflight for existing-file locks, requiring normal user closure instead of Restart Manager session shutdown.
This refines the initial graceful-closure approach because session shutdown can bypass the asynchronous editor save dialog.

For macOS, use the v26 flat configuration keys with explicit ad-hoc identity `"-"`, `hardenedRuntime: false`, and notarization disabled.
Disable certificate autodiscovery in CI.
Ad-hoc integrity signing requires no purchased identity and does not claim Developer ID trust or notarization.
Windows remains unsigned.

### 5. Validate real payloads, then upload an allowlist

`verify-packages.js` extracts the actual produced archives and inspects their application payloads, not just the unpacked build directory.
Check architecture, locked Electron runtime, ASAR product version, consumer-guide bytes, MIT license, themes, icons, generated renderer/math resources, and restricted-font absence.
Perform a bounded native runtime probe with `ELECTRON_RUN_AS_NODE=1`; this is a runtime/loader check, not a GUI smoke test.

On Windows, first refuse stateful verification if an existing Folio installation or owned shell registration is present.
On a clean test account, silently install to a dedicated temporary directory, inspect the installed payload and owned registry entries, then uninstall only that test installation.
On macOS, mount the actual DMG, inspect and copy out the app, then detach it and check the copied app's resources and signature.
On Linux, extract the actual AppImage and tarball.
With the Linux verifier's required CI option `--fedora 44`, run both extracted payloads against Fedora libraries in a matching-architecture container before temporary extraction cleanup.
Do not disable the application sandbox to make a check pass.

Stage only the target's two validated payload files under `release/artifacts/<target>/` after every requested check has succeeded.
Upload each file separately with the pinned action's `archive: false` mode, following Anniversary's user-selected artifact presentation.
Each artifact is named after the package file, including product version, OS, architecture, and format, without commit/run suffixes.
Keep source commit, run/attempt details, and both immutable artifact IDs and links in the job summary.
Use repository-configured retention, no overwrite, and an error if expected files are absent.
Six successful jobs with two validated payloads each establish the required twelve-file set.
Do not upload builder logs, update metadata, blockmaps, source files, or broad `release/**` globs.

### 6. Separate automation evidence from consumer acceptance

Fedora containers prove loader/library compatibility for the extracted payloads, not desktop integration, FUSE mounting, or the full GUI.
Hosted Windows tests do not prove standard-user behavior merely because installation used per-user directives; hosted accounts may have administrative membership.
Complete the manual acceptance matrix on Windows 11, macOS 15, and Fedora 44, including genuine standard-user Windows accounts, both architectures, and both package forms.
Record actual OS/runtime versions and distinguish completed, failed, and not-run checks.
No platform is declared verified solely from a green package-upload step.

### Requirement Coverage

| Requirements | Design surface |
| ------------ | -------------- |
| FR-001, FR-002, FR-005 through FR-007 | Six-job push workflow, twelve direct-file artifacts with run provenance, failure propagation. |
| FR-003, FR-004 | Source-only product-version update and shared metadata preflight; future-version fixtures. |
| FR-008, FR-009 | Inno contract, stable identity, per-user shell registration, deliberate NSIS transition. |
| FR-010, FR-011, FR-016 | Complete archive payloads, native inspection, resource and license inclusion, both font exclusions. |
| FR-012 through FR-015 | Canonical consumer guide, ordinary resource copies, guarded Help access, platform-specific instructions. |
| FR-017 | Root README artifact-download and local-build updates without removing existing required prose. |
| FR-018, FR-019 | Extracted-payload checks, native probes, Fedora 44 checks, and separately recorded desktop acceptance. |
| SC-008 | Product version and guide validated locally before the workflow is added. |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ----------------------------------- |
| The packaging section names NSIS; this design replaces it with Inno Setup and a small compiler hook. | The user explicitly confirmed Inno Setup after the existing NSIS alternative and its lower maintenance cost were explained. Retain the same product identity, per-user behavior, and file-type registration. | Keeping NSIS would contradict that confirmed requirement. Switching the whole product to another packager would introduce more change than wrapping the existing Windows payload. |
