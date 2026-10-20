# Data Model: Product Metadata and Distribution Outputs

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

These are source and build-output concepts, not new application database tables or a release-management service.
Existing document and settings models do not change.

## Product Metadata

| Field | Source and rule |
| ----- | --------------- |
| `name` | Existing npm name `folio`; preserve it so settings identity does not move. |
| `productName` | Existing build product name `Folio`. |
| `appId` | Existing application ID `com.dpokluda.folio`. |
| `version` | Valid product SemVer from root `package.json`; initially changed once to `1.0.0`. |
| `lockRootProductVersion` | Root `package-lock.json.version`; must equal `version`, not the unrelated lockfile format number. |
| `lockPackageProductVersion` | Lockfile `packages[""].version`; must equal `version`. |
| `electronVersion` | Locked `node_modules/electron` package version, not the product version. |

The workflow treats all fields as read-only inputs.
A later maintainer-authored product version is valid without workflow edits.
Missing, invalid, inconsistent, or platform-unrepresentable version data is an error, never a fallback to `1.0.0`.
Windows numeric file-version fields may use the normal equivalent four-part representation; product display versions retain the declared SemVer.

## Consumer Guide

| Field | Rule |
| ----- | ---- |
| Source | `docs/user/README.md`, authored before automation. |
| Installed name | `README.md` in the application's ordinary resources directory. |
| Integrity | Packaged bytes match the guide read from that checked-out source. |
| Access | `Help > User Guide`, offline, through the guarded built-in document path. |
| Editing state | Untitled buffer; saving requires Save As and cannot overwrite the shipped guide. |

The guide has no generation state or pipeline-owned version.
The existing root MIT `LICENSE` accompanies it as a separate ordinary resource.

## Target

| Key | Platform | Architecture | Formats |
| --- | -------- | ------------ | ------- |
| `windows-x64` | Windows | `x64` | `zip`, `setup.exe` |
| `windows-arm64` | Windows | `arm64` | `zip`, `setup.exe` |
| `linux-x64` | Linux/Fedora | `x64` | `tar.gz`, `AppImage` |
| `linux-arm64` | Linux/Fedora | `arm64` | `tar.gz`, `AppImage` |
| `macos-x64` | macOS | `x64` | `tar.gz`, `dmg` |
| `macos-arm64` | macOS | `arm64` | `tar.gz`, `dmg` |

Only these target keys are accepted by the new verifier.
Native machine identifiers are normalized explicitly: PE AMD64/ARM64, ELF x86-64/AArch64, and Mach-O x86_64/arm64.
The primary application payload must match the requested target; a bootstrap installer's architecture is not that payload's architecture.
Docker's `amd64` platform name corresponds to target `x64`.

## Workflow Run and Target Attempt

A run is identified by repository, workflow, numeric run ID, and full source commit.
Each execution attempt also has `run_attempt`.
Each target job has a target key, actual runner architecture/image, product version, and result.

The lifecycle is:

```text
queued -> dependencies-ready -> source-validated -> packaged
       -> payloads-validated -> staged -> uploaded
```

Any required step can instead terminate as failed or cancelled.
Only an uploaded, validated pair completes its target.
The whole run succeeds only when all six target jobs succeed.
No previous source revision supplies missing output.
For Linux CI, validation includes the requested Fedora 44 probes before extraction directories are cleaned up or packages staged.

Rerunning failed jobs can leave successful artifacts from an earlier attempt of the same run.
Those outputs remain valid for that exact source commit; do not confuse "same revision" with "all jobs had the same attempt number."

## Package and Artifact Bundle

A package has product version, target key, format, filename, source commit/run provenance, and validation result.
Naming follows [the packaging contract](./contracts/packaging.md).
A target bundle contains exactly its two validated package payloads and is named according to [the workflow contract](./contracts/workflow.md).

Staging is generated under `release/artifacts/<target>/`.
It does not contain logs, dependency caches, update metadata, unpacked directories, or files from another target.
Artifact IDs are assigned by GitHub; names are unique for source/run/attempt/target.
Retention and access follow repository policy rather than a new release lifecycle.

## Windows Installation Identity

| Field | Rule |
| ----- | ---- |
| Inno application ID | `com.dpokluda.folio`, stable across versions and both architectures. |
| Install scope | Current user only. |
| Default destination | `%LOCALAPPDATA%\Programs\Folio`. |
| Uninstall key | Inno-owned `com.dpokluda.folio_is1` registration; no adoption of an NSIS uninstall record. |
| Legacy NSIS key | `9f5ff8db-51b6-575b-9468-75de01a1e384`, checked in relevant user/machine registry views. |
| Document class | Existing `Folio.Markdown`; preserve the five declared extensions and document icon. |
| User data | Existing Electron `userData` and user documents; never installer-owned cleanup targets. |

Transitions are fresh installation, same-version replacement, later-version upgrade, and removal.
A detected legacy NSIS installation blocks the transition until the user deliberately removes it.
Running Folio must close gracefully or installation stops; force-closing is not a valid state transition.
