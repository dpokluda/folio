# Contract: One-shot rebuild (`scripts/build.ps1`)

**Feature**: [../spec.md](../spec.md) (User Story 6) | **Data model**: [../data-model.md](../data-model.md) §10 | **Since**: 59f97be

## Synopsis

```sh
pwsh scripts/build.ps1 [-Platform current|win|mac|linux] [-Install] [-Clean] [-SkipIcons]
pwsh scripts/build.ps1 -?          # comment-based help (synopsis, parameters, examples)
```

The script needs PowerShell 7 or later (`pwsh`) and runs on Windows, macOS and Linux. It is orchestration only: every real step is an npm script, and the npm scripts remain usable on their own.

## Parameters

| Name | Type | Default | Validation | Meaning |
|---|---|---|---|---|
| `-Platform` | string | `current` | `current`, `win`, `mac`, `linux` | `current` runs `npm run dist`, which packages for the host. Any other value runs `npm run dist:<Platform>`, which is cross-targeting unless it names the host |
| `-Install` | switch | off | none | Runs `npm install` first, after dependency changes |
| `-Clean` | switch | off | none | Deletes the whole `release/` folder first. Without it, `npm run dist` still removes `release/*-unpacked` but keeps older installers |
| `-SkipIcons` | switch | off | none | Skips `npm run icons`, which is fine because the generated icons are committed |

## Execution order

Each step prints a cyan `==> <step>` header and echoes the npm command it runs.

1. Version guard: when `$PSVersionTable.PSVersion.Major -lt 7`, the script throws `This script needs PowerShell 7+ (pwsh); found <version>.`
2. It changes directory to the repository root (the parent of `scripts/`) and restores the previous location in a `finally` block.
3. **Clean**, with `-Clean`: if `release/` exists, `Remove-Item -Recurse -Force` deletes it and the script prints `removed.`; otherwise it prints `nothing to clean.`. If deletion fails, it throws `Could not delete release/ — a file there is locked, most likely a running Folio. Close it and retry. (<reason>)`.
4. **Install**, with `-Install`: runs `npm install`.
5. **Icons**, unless `-SkipIcons`: runs `npm run icons`.
6. **Packaging**: runs `npm run dist`, or `npm run dist:<Platform>`.
7. **Done**: lists at most the 10 largest top-level files in `release/`, largest first, one per line, as `'{0,10:N1} MB  {1}'`.

## Errors and exit status

- `$ErrorActionPreference = 'Stop'` applies throughout.
- Every npm call goes through `Invoke-Npm`, which throws `npm <args> failed with exit code <n>.` on a non-zero `$LASTEXITCODE`.
- The first failing step therefore ends the script with a non-zero exit status, and later steps don't run.
- An invalid `-Platform` value is rejected by PowerShell parameter validation before any step runs.

## Examples (from the script's help)

| Command | Effect |
|---|---|
| `pwsh scripts/build.ps1` | Regenerate the icons and package for the current platform |
| `pwsh scripts/build.ps1 -Clean -Install` | Full rebuild from a clean `release/` after a dependency change |
| `pwsh scripts/build.ps1 -Platform linux` | Cross-target a Linux AppImage and .deb |
