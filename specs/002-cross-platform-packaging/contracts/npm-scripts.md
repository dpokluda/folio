# Contract: Maintainer npm scripts

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md) §2

**Scope**: These are the npm scripts in `package.json` that this feature added or rewired. `build:renderer` and `watch:renderer` belong to [001](../../001-markdown-viewer-editor/spec.md) and appear here only as a stage of the chains.

## Scripts as shipped

| Script | Command | Introduced / changed |
|---|---|---|
| `postinstall` | `node scripts/ensure-electron.js` | 6bf8c90 |
| `ensure:electron` | `node scripts/ensure-electron.js` | 6bf8c90 |
| `start` | `npm run ensure:electron && npm run build:renderer && electron .` | bd8f5ef; `ensure:electron` stage added in 6bf8c90 |
| `icons` | `node scripts/generate-icons.js` | c5171da |
| `clean:release` | `node scripts/clean-release.js` | 002f2bb |
| `dist` | `npm run ensure:electron && npm run build:renderer && npm run clean:release && node scripts/run-electron-builder.js` | bd8f5ef → dd44537 → 6bf8c90 → 002f2bb → 5f9a8a0 |
| `dist:win` | `dist` chain with `node scripts/run-electron-builder.js --win` | bd8f5ef → dd44537 → 6bf8c90 → 002f2bb → 5f9a8a0 |
| `dist:mac` | `dist` chain with `node scripts/run-electron-builder.js --mac` | bd8f5ef → 6bf8c90 → 002f2bb |
| `dist:linux` | `dist` chain with `node scripts/run-electron-builder.js --linux` | bd8f5ef → 6bf8c90 → 002f2bb |
| `prepare:wincodesign` (removed) | `node scripts/prepare-wincodesign.js` | Added in dd44537 to `dist` and `dist:win`; removed in 5f9a8a0 |

## Semantics

- **Fail-fast chaining**: stages are joined with `&&`. The first non-zero exit stops the chain and becomes the script's exit code.
- **Stage order** for every `dist*` script:
  1. Ensure the Electron runtime ([ensure-electron.md](./ensure-electron.md)).
  2. Build the renderer bundle.
  3. Remove `release/*-unpacked` ([release-cleanup-and-retry.md](./release-cleanup-and-retry.md)).
  4. Run the packager with lock retry.
- **Target selection**:
  - `dist` passes no target, so electron-builder packages for the host.
  - `dist:win`, `dist:mac` and `dist:linux` forward `--win`, `--mac` and `--linux` unchanged.
  - On the host, the matching variant is equivalent to `dist`. Any other target is cross-targeting and needs extra tooling, for example Wine for NSIS on macOS or Linux (README).
- **`postinstall`** runs after `npm install`. A self-heal failure makes the install fail.
- **`icons`** is never part of `dist*`. Generated icons are committed ([icon-pipeline.md](./icon-pipeline.md)), and `scripts/build.ps1` runs `npm run icons` before packaging unless `-SkipIcons` is given ([build-ps1.md](./build-ps1.md)).
- **Log prefixes**: `[ensure-electron]`, `[clean-release]`, `[dist]` (the packaging wrapper) and `[icons]`.

## Outputs

| Script | Writes |
|---|---|
| `postinstall`, `ensure:electron` | `node_modules/electron/dist/`, `path.txt` and `electron.d.ts`, only when a repair is needed |
| `clean:release` | Deletes `release/*-unpacked/` |
| `dist*` | Artifacts in `release/` ([packaging-targets.md](./packaging-targets.md)) |
| `icons` | `build/icons/{icon,document}.{png,ico,icns}` |

## Exit codes

| Script | 0 | Non-zero |
|---|---|---|
| `postinstall`, `ensure:electron` | Runtime healthy or repaired, or Electron not installed at all | 1 on any repair failure |
| `clean:release` | Nothing to clean, or everything removed | 1 for a locked folder; other errors propagate |
| `dist*` | Packaged | The first failing stage's code; after retries, the packager's code |
| `icons` | All six files written | 1 for a missing source or a failed conversion |
