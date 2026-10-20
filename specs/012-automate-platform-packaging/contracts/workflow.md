# Contract: Automated Cross-Platform Packaging

**Feature**: [spec.md](../spec.md), User Story 3 | **Plan**: [plan.md](../plan.md)

## Trigger and Checkout

Workflow: `.github/workflows/package.yml`.
Trigger: a push updating `main`, whether direct or caused by a merge.
Build the triggering full commit, not a later moving branch tip.
Do not trigger package publication for pull requests, feature branches, tags, or GitHub Releases.
GitHub's ordinary rerun capability is sufficient; no manual release or version-selection input is introduced.

The workflow is added after the source-version and consumer-guide deliverables work locally.
Read product version from source using the metadata validator.
Never invoke `npm version`, generate the guide, change metadata with a builder override, commit, tag, push, or call a release-upload API.
Pass `--publish never` to electron-builder.

## Required Matrix

| Platform argument | Architecture | Runner | npm packaging invocation |
| ----------------- | ------------ | ------ | ------------------------ |
| `windows` | `x64` | `windows-2022` | `dist:win -- --x64 --publish never` |
| `windows` | `arm64` | `windows-11-arm` | `dist:win -- --arm64 --publish never` |
| `linux` | `x64` | `ubuntu-24.04` | `dist:linux -- AppImage tar.gz --x64 --publish never` |
| `linux` | `arm64` | `ubuntu-24.04-arm` | `dist:linux -- AppImage tar.gz --arm64 --publish never` |
| `macos` | `x64` | `macos-15-intel` | `dist:mac -- --x64 --publish never` |
| `macos` | `arm64` | `macos-15` | `dist:mac -- --arm64 --publish never` |

Each invocation is prefixed with `npm run`.
Each job installs Node 24 for the target architecture and checks both Node's architecture and the runner's reported architecture.
Use exact reviewed action commit pins from [research.md](../research.md), not unpinned marketplace helpers.

## Job Lifecycle

1. Check out the triggering revision with persisted checkout credentials disabled and `contents: read`.
2. Set up native Node 24, cache npm downloads, and run `npm ci`.
3. Validate source metadata and guide, and run the focused built-in Node tests.
4. On Windows only, provision verified Inno Setup 6.7.3 and expose its exact compiler path.
5. Package the target using the existing local npm command.
6. Validate both real output packages and their extracted/installed payloads; on Linux, pass `--fedora 44` so both Fedora probes and the FUSE library check occur before extraction cleanup.
7. Verify that source manifests and the authored guide were not modified.
8. Upload exactly the validated pair and report target, source version/commit, runner image, and artifact identity.

Use native command status checking, not shell constructs that swallow a failing command before a successful upload.
Do not share `node_modules`, unpacked builds, or release output between OS/architecture jobs.

## Compiler Provisioning

`.github/scripts/setup-inno.ps1` is CI provisioning only.
Download the version-specific official asset and verify the SHA-256 and vendor signature recorded in research.
Use a current-user runner-temporary installation, no elevation, and the pinned compiler version.
Set `ISCC_PATH` for later steps; do not change the product source or a persistent machine-wide PATH.
Fail clearly on download, digest, signature, install, or version mismatch.
Do not fall back to a different preinstalled compiler or an unsigned download.

## Fedora Evidence

Use the release-pinned `fedora:44` image on each native Linux runner.
Use Docker platform `linux/amd64` for target `x64` and `linux/arm64` for target `arm64`.
Record the actual image digest and install the desktop/runtime libraries needed by the actual Electron payload.
Verify the documented FUSE provider exposes `libfuse.so.2`.
Mount prepared test payloads read-only and run the actual target binary in Node mode to check native runtime loading and architecture.

The verifier owns each temporary container and removes only its recorded container on failure or timeout.
The check does not launch the GUI or prove FUSE mounting, desktop registration, source editing, PDF export, or AppImage sandbox behavior.
Those require the real Fedora desktop acceptance in the quickstart.
Do not add `--no-sandbox` or change host security settings to manufacture a green check.

## Artifact Contract

Each target has one ordinary ZIP-wrapped artifact containing its two [required payload filenames](./packaging.md).
Name:

```text
Folio-<source-version>-<platform>-<arch>-<sha12>-<run-id>-a<run-attempt>
```

Include the full commit in the run/job summary; the name's shortened commit is only a human-readable label.
Use the immutable artifact ID returned by the upload when linking the exact upload.
Staging contains exactly two nonempty validated package files, not an unpacked tree.
Use no overwrite, no unwrapped single-file upload mode, compression level zero for already-compressed payloads, and `if-no-files-found: error`.
Omit a hardcoded retention override so repository policy applies.

The source version is not necessarily `1.0.0`: future source versions flow through the same workflow.
Source commit and run/attempt identity distinguish builds that legitimately share a product version.
Rerunning only failed jobs may retain earlier successful target artifacts from the same source revision.
Do not require those successful jobs to be rebuilt solely to give every artifact the same attempt number.

## Failure and Completion

All six targets are required.
Set `fail-fast: false` so another target can still finish and provide diagnostics.
Set a 45-minute job timeout, with no `continue-on-error` or success-producing catch.
Do not configure branch-wide latest-only concurrency or cancel older pushes intentionally.

Any source validation, dependency install, build, compiler, extraction, package check, Fedora check, or required upload failure makes its target and the workflow unsuccessful.
Successful target bundles may remain visible when another target fails.
Only six successful target jobs establish the complete twelve-package result.
Unavailable runners or tools are actionable failures, not permission to skip an architecture, relabel an emulated payload, or publish another revision's output.

Actions artifacts are authenticated, retention-limited downloads, not permanent anonymous releases.
Root README instructions must explain how to find the run and choose a target bundle, including GitHub sign-in/access requirements and the extra transport-ZIP layer.
