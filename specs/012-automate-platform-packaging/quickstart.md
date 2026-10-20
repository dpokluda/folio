# Quickstart: Validating Product Metadata, Consumer Guide, and Packages

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This is the implementation validation guide, not a claim that these checks have run.
Commands for new helpers become available when the corresponding implementation work is complete.
Do not start a hosted run, push a commit, install into an existing user environment, or change product versions merely to execute this planning document.
Use normal review/merge authorization and clean test accounts or disposable machines for installation checks.

## Prerequisites

Use Node.js 24 LTS and the committed lockfile.
Windows full packaging additionally needs Inno Setup 6.7.3; set `ISCC_PATH` if the compiler is not in a supported discovery location.
PowerShell 7 is needed only for the existing one-shot script and Windows provisioning/checks.
Native Windows, macOS, and Linux tooling must match the target architecture.
Docker is additionally required for Linux qualification with `--fedora 44`, not for ordinary local application use.
Use the [packaging contract](./contracts/packaging.md) for exact formats, output names, and resource paths.

Reference desktop acceptance systems are Windows 11, macOS 15, and Fedora 44, each on x64 and arm64.
Do not present those reference systems as a newly raised minimum deployment target.
Electron 43.8.1 documents Windows 10+ and macOS 12+; preserve that distinction from the OS versions actually exercised.
Record the refreshed runtime's requirements and actual qualification evidence in the finished guide.

## 1. Prove the Product Changes Without a Pipeline

Complete the source version and consumer-guide changes first.
The product version must be `1.0.0`; root lockfile metadata must match.
The guide must exist as `docs/user/README.md`, and the existing local packaging path must include it as ordinary resources.

```sh
node -p "require('./package.json').version"
node -p "require('./package-lock.json').version"
node -p "require('./package-lock.json').packages[''].version"
npm ci
npm run build:renderer
npm start
```

Expected: all three printed product versions are `1.0.0`, and About Folio reports the same version.
The Electron dependency version is a separate value, not the product version.
Confirm `Help > User Guide` opens the authored consumer guide locally.
Edit another document first and exercise Save, Discard, and Cancel before opening the guide.
Edit the guide itself and save: Save As must open, leaving its source unchanged.
Repeat the changed Help flow across Light/Dark and the existing style families.

Run the existing local host packaging command before introducing the workflow.
Open the guide from that locally installed or extracted application without a source checkout or network access.
This establishes SC-008 independently of CI.

## 2. Check Metadata and Failure Cases

After the packaging helpers are implemented:

```sh
node scripts/package-metadata.js
node scripts/package-metadata.js --version
node --test tests/packaging.test.js
```

Expected: JSON metadata or a single validated version, and focused tests pass.
Use temporary fixtures in the tests, not edits to the real product version, to cover a later version such as `1.1.0`.
Both that version and `1.0.0` must produce their correct names with unchanged workflow logic.
Cover mismatched lockfile versions, invalid SemVer, missing guide, missing/wrong compiler, wrong native headers, missing resources, compiler failure, and source paths containing spaces or non-ASCII characters.
Each negative case must fail for the intended reason without a fabricated fallback version or guide.

## 3. Build and Verify a Native Target

Use the matching host and architecture.
For example, on Apple Silicon:

```sh
npm run dist:mac -- --arm64 --publish never
node scripts/verify-packages.js --platform macos --arch arm64 --directory release
```

For another target, use its exact npm invocation from [the packaging contract](./contracts/packaging.md), then:

```text
node scripts/verify-packages.js --platform <windows|linux|macos> --arch <x64|arm64> --directory release
```

Expected: the target's two actual package files pass extraction/install checks and appear alone under `release/artifacts/<target>/`.
Check product version against source, Electron against the lock, actual application architecture, guide/license bytes, themes/icons, offline math assets, and absence of personal fonts.
Confirm that source manifests and guide were not rewritten:

```sh
git diff --exit-code -- package.json package-lock.json docs/user/README.md
```

That clean-diff check is performed after the planned source changes are already part of the checked-out revision.
For local uncommitted implementation work, compare against a saved pre-build snapshot instead; do not commit merely to make this command pass.
Use a fresh generated-output directory for qualification.
The existing one-shot `-Clean` option deliberately removes generated `release/` output; do not use it if older generated files must be retained.

Windows verification installs to a dedicated temporary destination and checks uninstall cleanup.
It must refuse an existing installation or conflicting owned shell registration; use a clean test account, not a real existing Folio installation.
macOS verification must detach its temporary DMG mounts.
All helpers must stop their own child processes and report cleanup errors without masking a primary failure.

## 4. Validate Fedora Separately

On native Linux x64, run:

```sh
npm run dist:linux -- AppImage tar.gz --x64 --publish never
node scripts/verify-packages.js --platform linux --arch x64 --directory release --fedora 44
```

On native arm64, use `--arm64` and `--arch arm64`.
The verifier uses Docker with matching `linux/amd64` or `linux/arm64` and the release-pinned `fedora:44` image.
It records the resolved image digest and checks both extracted payloads before deleting its extraction directories.
It uses actual packaged binaries, not the development Electron executable.

Inside the disposable Fedora environment, install the GTK, NSS, audio, graphics, and FUSE libraries needed by the payload.
Verify the documented `fuse`/`fuse-libs` recipe provides `libfuse.so.2`, correcting the guide if package metadata proves otherwise.
Run a bounded probe in each extracted application directory:

```sh
ELECTRON_RUN_AS_NODE=1 ./folio -p 'JSON.stringify({arch: process.arch, electron: process.versions.electron})'
```

Expected: the target architecture and locked Electron version are reported against Fedora libraries.
A missing loader/library is a failure with its diagnostic preserved.
This does not prove GUI startup or AppImage self-mounting.

On a real Fedora 44 desktop of each architecture, separately:

```sh
chmod +x Folio-<version>-linux-<arch>.AppImage
./Folio-<version>-linux-<arch>.AppImage
```

Also extract the tarball and run `./folio` from its application folder.
Exercise the document workflows and offline guide in the acceptance matrix below.
Do not add `--no-sandbox`, run the GUI as root, or disable host protections to turn a failed launch into a pass.

## 5. Observe the First Authorized Workflow Run

After the implemented changes enter `main` through the normal authorized workflow:

```sh
gh run list --repo dpokluda/folio --workflow package.yml --branch main --limit 5
gh run view <run-id> --repo dpokluda/folio
gh run download <run-id> --repo dpokluda/folio --dir <empty-download-directory>
```

Expected: six required target jobs succeed and six target bundles contain twelve product package files.
Names identify source version, OS, architecture, commit, run, and attempt; package names match the contract.
There is no new or moved tag and no GitHub Release.
Builder update metadata, blockmaps, logs, and source files are not uploaded.
Download instructions explain repository access, expiry, and the transport ZIP.

Validate failure propagation with the focused test fixtures and an authorized disposable test workflow environment if one is available.
Do not push deliberately broken prerequisites to `main` solely to test failure behavior.
A failed target or upload must make the workflow fail while other target jobs can finish.
When legitimately rerunning failed jobs, confirm same-revision provenance and no artifact-name overwrite.

## 6. Desktop Acceptance Matrix

For each package form on every target, record actual OS/runtime versions and result.
Use `Pass`, `Fail`, or `Not run`, not an implied pass from another architecture or a successful upload.

| Target | Archive | Installer/distribution package | Required native environment |
| ------ | ------- | ------------------------------ | --------------------------- |
| Windows x64 | ZIP | Inno setup EXE | Windows 11, genuine standard-user account. |
| Windows arm64 | ZIP | Inno setup EXE | Windows 11 on Arm, native arm64 app, standard user. |
| Linux x64 | tar.gz | AppImage | Fedora 44 desktop, documented FUSE prerequisite. |
| Linux arm64 | tar.gz | AppImage | Fedora 44 aarch64 desktop, documented FUSE prerequisite. |
| macOS x64 | tar.gz | DMG copy | macOS 15 Intel. |
| macOS arm64 | tar.gz | DMG copy | macOS 15 Apple Silicon. |

For all twelve forms, launch, open a Markdown file and folder, switch source/preview, save an edit, find text, change theme, export PDF, and open another window.
Disconnect the network and remove the original installation medium; the guide and bundled assets must still work.
Check the current command-line setup behavior, including Linux archive limitations.
Check Windows file-open quoting and document icons without displacing another default app.
Check a legacy NSIS transition, a same-version reinstall, a later-version upgrade, and uninstall while preserving documents and settings.
Attempt replacement while Folio has unsaved edits; the installer must not force-kill it or report success over a partially replaced app.

Implementation is not fully qualified until the required native acceptance evidence exists.
Unavailable test hardware is reported as `Not run`, not replaced by container or emulation claims.

## Implementation Execution Record

Implementation started on 2026-10-19 in the existing `main` checkout at `ffe4da510698cb82753f66ba4baeac5c71ef5ae5`.
The initial working tree contained only the ten untracked feature-design documents.
Product metadata was `0.1.0`; the lock and installed runtime resolved Electron `43.7.7` and builder `26.15.3`.
The host is macOS arm64, initially using Node `26.12.0` and npm `11.20.0`.
Node 24, Docker, and actionlint were not available as named commands on the initial PATH.
The requirements checklist was read-only and passed 16/16 items.
No branch, commit, tag, or push was created.

Qualification results are added below only after their corresponding checks run.

Node `24.22.0` was obtained in an isolated npm-exec cache after the source manifest changed.
The system Node installation and default PATH were not changed.
The actual host version is macOS `27.0.1` arm64, not the plan's macOS 15 reference system.

### Product and guide checkpoint

The source version and both lockfile product entries were changed to `1.0.0` using npm without a commit or tag.
The Electron-only lock refresh resolved `43.8.1`; builder remained `26.15.3`.
`npm ci` under Node 24 restored the runtime and the existing repair helper completed successfully.
The original macOS arm64 DMG build succeeded, its ASAR declared `1.0.0`, and the real About action reported `Folio 1.0.0`.

Before the consumer guide was added, its isolated Electron smoke check failed specifically with the expected missing-guide `ENOENT`.
After implementation, the actual main process and renderer passed offline guide loading, Save/Discard/Cancel, guide Save As without overwriting its source, all three style families in Light/Dark, and explicit missing-guide error behavior.
The smoke process used its own user-data directory and blocked outbound HTTP(S), without changing the normal Folio profile or interacting with its documents.
These were automated in-process menu/dialog checks on macOS 27.0.1 arm64, not human OS-warning approval or foreign-platform tests.

The consumer guide and MIT license were also compared byte-for-byte in a locally built app.
An isolated copied application, with only its test entry bootstrap changed and re-signed, exercised the real packaged-resource path and the same guide/guard/theme scenarios.
No test bootstrap was added to the distributed application.

### Local packaging checkpoint

Node 24 passed all 22 current packaging fixtures, including source immutability, future versions, native headers, compiler-failure/stale-output checks, Windows stateful-test refusal, resource/font checks, and staging.
The macOS arm64 tar.gz and DMG were actually built with ad-hoc signing and inspected from their real outputs.
Both native runtime probes matched arm64 / Electron 43.8.1 and product metadata 1.0.0.
The DMG was mounted read-only, its application copied, the image detached, and the copied application checked again.
Only the two validated package files were staged under `release/artifacts/macos-arm64/`.
The unpacked-only command also succeeded without an Inno compiler.
Snapshots confirmed that package metadata, the authored guide, and the MIT license were unchanged by both packaging commands.
Foreign native packages, Windows compiler execution/installation, Fedora containers, and the full desktop matrix have not run on this host.

### Workflow and final local checks

The six-target workflow passed actionlint `1.7.12`.
All three pinned action commits were independently confirmed in their first-party repositories, and the official Inno 6.7.3 asset digest matched the provisioning script.
The compiler-provisioning and local-build PowerShell files and the embedded registry-probe script passed syntax parsing.
Provisioning was also checked to refuse this local non-Windows environment before any download or installation.
The refusal-check harness initially failed because PowerShell wrapped its error display; capturing the original exception message confirmed the intended refusal without changing the guard.

All 24 current Node fixtures passed after making the later-version compiler case a standalone test.
The actual application smoke checks additionally passed Welcome, Formatting Tour, PDF export, folder explorer, local Markdown links, Back/Forward, and another window.
A direct File Open regression was reproduced: the installed README had been treated as a writable user file.
Known bundled paths now retain untitled protection through File Open, associations, and startup arguments; direct-open and launch-argument checks passed in both development and an isolated copied native package.

A disposable real macOS build containing only dummy root/nested mixed-case TTF markers proved that both packaged theme copies exclude them.
No real personal font was copied into the fixture.
The Windows installer deliberately requires normal application closure rather than sending automatic Restart Manager session-shutdown messages.
Its generated preflight checks existing payload-file locks, and its post-install checks verify every shipped file before reporting success.
These safety paths still require native Windows qualification.

### Remaining qualification gates

| Check | Result and limitation |
| ----- | --------------------- |
| macOS arm64 package contents, signatures, native runtime, guide and local application flows | Pass on actual macOS 27.0.1; isolated test profiles and copied test-entry bootstrap where needed. This is not a claim that macOS 15 or the macOS 12 minimum was tested. |
| Actual first-launch trust/SmartScreen/Gatekeeper approval | Not run against a freshly downloaded quarantined copy. |
| macOS Intel package and desktop acceptance | Not run; no native Intel host in this session. |
| Windows x64/arm64 compiler, installer and genuine standard-user checks | Not run; compiler/process fixtures and PowerShell syntax checks are not native Windows execution. |
| Fedora 44 x64/arm64 container, FUSE mount and desktop acceptance | Not run; Docker and native Fedora desktops are unavailable on this host. |
| Preserved local Linux deb generation | Configuration retained and checked by fixtures; native generation not run. |
| Complete twelve-payload content and license audit | Not run; only the macOS arm64 pair exists locally. |
| Live six-job Actions run, upload and rerun behavior | Not run; no commit, push, merge, workflow dispatch, or repository setting change was authorized or performed. |

Tasks T031 through T037 remain unchecked until their required external/native evidence exists.
The feature must not be marked fully implemented based only on these local results.
