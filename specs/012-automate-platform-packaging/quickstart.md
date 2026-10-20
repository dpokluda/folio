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
Use `x86_64` for the AppImage filename on x64; tarballs and target arguments use `x64`.

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
| macOS Intel package and desktop acceptance | Native macOS Intel CI package checks passed in the first run below; desktop acceptance is still not run. |
| Windows x64/arm64 compiler, installer and genuine standard-user checks | The third run built both ZIP/setup pairs but failed installed shell-integration verification. A canonical-path correction and field-specific diagnostics are local; native confirmation and genuine standard-user qualification remain pending. |
| Fedora 44 x64/arm64 container, FUSE mount and desktop acceptance | Native Linux and Fedora 44 container probes passed for both architectures in the second run. Desktop/FUSE-mount checks are not run. |
| Preserved local Linux deb generation | Configuration retained and checked by fixtures; native generation not run. |
| Complete twelve-payload content and license audit | Pending; no run has yet provided the complete six-bundle set. |
| Live six-job Actions run, upload and rerun behavior | The third run has four successes with both Windows jobs failing after successful package builds. See the run evidence below. No fix was committed or pushed by the agent. |

Tasks T031 through T037 remain unchecked until their required external/native evidence exists.
The feature must not be marked fully implemented based only on these local results.

### First merged GitHub Actions run: 2026-10-20

The user's merge reached `main` at `9f820dfe3b73938006ee9164a395d028fbbc9d4f`.
[Run 39429753648](https://github.com/dpokluda/folio/actions/runs/39429753648) was triggered by `push` and completed with conclusion `failure`.
The local checkout and remote main matched that revision before the targeted CI fixes were prepared.

| Target | Job ID | Result |
| ------ | ------ | ------ |
| Windows x64 | `118651402230` | Failed contract checks: nested ASAR paths used POSIX separators, and Windows fixtures attempted to represent POSIX executable modes. |
| Windows arm64 | `118651401450` | Same two contract failures, before compiler provisioning or packaging. |
| Linux x64 | `118651401650` | Built tar.gz and AppImage; verification expected `x64.AppImage` while builder correctly emitted `x86_64.AppImage`. |
| Linux arm64 | `118651401862` | Passed build, actual-payload/runtime inspection, Fedora 44 probes, source immutability, and upload. |
| macOS x64 | `118651401842` | Passed native Intel build, package/signature/runtime checks, source immutability, and upload. |
| macOS arm64 | `118651401753` | Passed native arm64 build, package/signature/runtime checks, source immutability, and upload. |

The API confirmed three unexpired, source-matching target bundles with artifact IDs `12267592524` (Linux arm64), `12268340906` (macOS x64), and `12267647199` (macOS arm64).
These do not constitute the required twelve-file complete set.
No successful target from this run may be substituted for another source revision's missing target.

The Windows ASAR issue was reproduced using the real ASAR filesystem implementation with isolated Windows path semantics.
Lookups now normalize paths for the host API while retaining portable archive-entry keys.
Content fixtures use a filesystem-compatible format; a dedicated POSIX permission test remains enforced on Linux/macOS and explicitly reports unsupported NTFS modeling on Windows.
The Linux package naming contract now matches builder's format-specific `x86_64` spelling for x64 AppImages, with regression coverage for both naming and staging.
These are local fixes, not a claim that a subsequent CI run has passed.

### Second merged GitHub Actions run: Windows compiler-version check

[Run 39438547388](https://github.com/dpokluda/folio/actions/runs/39438547388) built revision `2370d89b518af8e7b45d615a40d044d28bc11ebb`.
Linux and macOS passed on both architectures, confirming the prior ASAR/fixture/AppImage naming corrections.
Both Windows jobs passed their contract tests but failed compiler provisioning with `Expected compiler 6.7.3; installed compiler reports 0.0.0.0`.
The affected jobs were `118681970094` (x64) and `118681969939` (arm64).
They did not reach actual installer compilation.

The pinned Inno source separates the CUI launcher from the compiler engine.
Its PE version resources are zeroed in the tagged source, while the compiler exposes the real engine version during compilation.
The `/?` help path is not a suitable substitute: it exits nonzero and does not print the engine-version report.
The fix replaces both PE-property checks with one shared, successful no-output compilation probe, using the pinned compiler's supported `/O-` and standard-input script mode.
It retains the installer SHA-256 and publisher-signature checks and rejects mismatched engine versions or failed probes.
The regression for a `0.0.0.0` launcher was observed failing before this change.

These changes were initially left local and uncommitted for the user's review.
The user subsequently pushed them; the native results are recorded below.

### Third merged GitHub Actions run: Windows installed integration check

[Run 39450119144](https://github.com/dpokluda/folio/actions/runs/39450119144) built revision `e0d7035c7bf2d2d63212d633903ba93081f7dcda`.
All six jobs finished; the overall conclusion was `failure`.
Linux and macOS passed on both architectures, including package inspection, native runtime probes, source immutability, and upload.
Both Windows jobs passed the shared compiler-engine check and built their ZIP archives and Inno Setup EXEs.
The compiler-version correction is therefore confirmed on both native Windows targets.

| Target | Job ID | Result |
| ------ | ------ | ------ |
| Windows x64 | `118722387063` | Built both packages; failed installed shell-integration verification before upload. |
| Windows arm64 | `118722387061` | Same verification failure after successful archive and installer builds. |
| Linux x64 | `118722387383` | Passed and uploaded the validated package pair. |
| Linux arm64 | `118722387123` | Passed and uploaded the validated package pair. |
| macOS x64 | `118722387044` | Passed and uploaded the validated package pair. |
| macOS arm64 | `118722386899` | Passed and uploaded the validated package pair. |

The exact Windows error was `Installed per-user Markdown registration, icon or Start menu shortcut is incomplete.`
It originates from the compound integration assertion in `scripts/verify-packages.js`, after temporary installation and uninstall-identity checks.
The captured logs do not identify which individual registration, icon, or shortcut comparison failed.
No specific root cause or corrective implementation is claimed from that message alone.
Windows uploads were correctly skipped, so the run does not provide Windows downloads.

The artifact API confirmed four unexpired bundles, all attributed to the exact revision above:

| Target | Artifact ID |
| ------ | ----------- |
| Linux x64 | `12278421194` |
| Linux arm64 | `12279215771` |
| macOS x64 | `12278177116` |
| macOS arm64 | `12278621301` |

The four bundles are not the required complete six-target set.
They were not downloaded during this monitoring pass.
Tasks T031 through T037 remain unchecked; no application, installer, verifier, or workflow code was changed during monitoring.

### Local correction after the third run

The integration assertion compared the shortcut's resolved target with a path rooted in `os.tmpdir()`.
Windows can report that temporary directory using an 8.3 alias while shell links report its expanded path.
`path.resolve()` alone does not resolve filesystem aliases.
The verifier now calls `fs.realpathSync.native()` on the temporary parent before creating its owned directory.
Registry values, installation identity, payload probes, and shortcut expectations therefore use the same canonical installation path.
The existing-installation refusal, protected-default checks, and owned-uninstall safeguards remain in place.

A filesystem-alias regression failed before this correction.
It now covers a real directory alias, a shell-expanded executable target, and a destination containing spaces.
The integration assertion also reports all mismatched fields with expected and actual values rather than one combined error.
It explicitly requires the shortcut and all five extension registrations, and retains quoted executable/document-argument checks.
An additional native Windows regression obtains an actual 8.3 path through Windows Script Host.
It reports an explicit skip on non-Windows hosts or volumes without an 8.3 alias; the cross-platform alias regression still runs.

Under Node 24.22.0, 36 focused checks passed and the native Windows 8.3 check was explicitly skipped on macOS.
The native regression's PowerShell probe passed syntax parsing.
An initial check of the older local macOS packages correctly failed because their consumer guide no longer matched source.
After rebuilding with `npm run dist:mac -- --arm64 --publish never`, both fresh macOS arm64 packages passed the actual verifier.
That included native runtime and resource checks, signatures, DMG mounting/copying/detachment, and two-file staging with the canonical temporary root.
Snapshots confirmed that packaging left the product manifests, authored guide, and license unchanged.

These changes remain local; no commit, push, or CI rerun was performed.
The latest hosted run still tests `e0d7035c7bf2d2d63212d633903ba93081f7dcda`, not this correction.
The original compound error did not expose its mismatched field, so a new native Windows run is required to confirm the correction resolves that failure.
Tasks T031 through T037 remain unchecked.
