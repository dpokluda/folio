# Contract: Electron runtime self-heal (`scripts/ensure-electron.js`)

**Feature**: [../spec.md](../spec.md) (User Story 4) | **Data model**: [../data-model.md](../data-model.md) §7 | **Since**: 6bf8c90 (unchanged since)

## Invocation

| Trigger | How |
|---|---|
| After `npm install` | the `postinstall` script |
| On demand | `npm run ensure:electron` |
| Before running from source | the first stage of `npm start` |
| Before packaging | the first stage of `npm run dist`, `dist:win`, `dist:mac` and `dist:linux` |

The script takes no command-line arguments.

## Inputs

| Input | Use |
|---|---|
| `node_modules/electron/package.json` → `version` | Expected version. If the file is missing, the script does nothing and exits 0 |
| `node_modules/electron/dist/version` | Installed version (a leading `v` is ignored) |
| `node_modules/electron/path.txt` | Recorded executable path |
| `process.platform` | Selects the platform executable path and the unzip tool |
| `npm_config_arch`, `process.arch`, `sysctl -in sysctl.proc_translated` (macOS) | Architecture; Rosetta-translated x64 selects `arm64` unless `npm_config_arch` is set |
| `electron_config_cache`, `ELECTRON_CACHE` | Additional cache roots, searched first |
| `LOCALAPPDATA` (Windows), `XDG_CACHE_HOME` (Linux) | Default cache roots |

## Health check

The installation is healthy when all three conditions hold:

- `dist/version`, with the `v` stripped, equals `version`.
- `path.txt` equals the platform executable path.
- `dist/<platform executable path>` exists.

| `process.platform` | Platform executable path |
|---|---|
| `darwin`, `mas` | `Electron.app/Contents/MacOS/Electron` |
| `linux`, `freebsd`, `openbsd` | `electron` |
| `win32` | `electron.exe` |
| anything else | error `Electron builds are not available on platform: <platform>` |

## Repair (only when unhealthy)

1. Archive name: `electron-v<version>-<process.platform>-<arch>.zip`.
2. Search the cache roots recursively and take the first match. The roots are, in order: `electron_config_cache`, `ELECTRON_CACHE`, then `~/Library/Caches/electron` (macOS), `%LOCALAPPDATA%\electron\Cache` (Windows), or `$XDG_CACHE_HOME` (else `~/.cache/electron`) on Linux and other platforms.
3. If nothing is found, run `node node_modules/electron/install.js` (Electron's own downloader, output inherited), then search again.
4. If there is still no archive, fail.
5. Delete and recreate `node_modules/electron/dist/`, then extract with the native tool:

   | OS | Command |
   |---|---|
   | macOS | `ditto -x -k <zip> <dist>` (preserves the `.app` bundle's symlinks and permissions) |
   | Windows | `powershell -NoProfile -Command "Expand-Archive -LiteralPath '<zip>' -DestinationPath '<dist>' -Force"` |
   | Other | `unzip -o -q <zip> -d <dist>` |

6. Move `dist/electron.d.ts` (if present) to `node_modules/electron/electron.d.ts` and write `path.txt`.
7. Re-run the health check. If it fails, fail.

## Messages and exit codes

All lines are prefixed with `[ensure-electron]`.

| Situation | Message | Exit |
|---|---|---|
| Electron package absent | `electron is not installed (run \`npm install\` first) — nothing to do.` | 0 |
| Healthy | `electron <version> already installed — nothing to do.` | 0 |
| Repair started | `electron <version> binary missing; looking for <zip> in the cache…` | none (in progress) |
| Not cached | `not cached — running electron installer to download it…` | none (in progress) |
| Extracting | `extracting <zip> → dist/ with the native unzip tool…` | none (in progress) |
| Repaired | `ready: electron <version> unpacked.` | 0 |
| Unsupported platform | `Electron builds are not available on platform: <platform>` | 1 |
| Not found and not downloadable | `Could not find or download <zip>. Check your network connection and re-run.` | 1 |
| Native unzip failed (including a missing `unzip` on Linux) | `Native unzip failed (exit <status>). <spawn error>` | 1 |
| Extraction incomplete | `Extraction did not produce dist/<platform executable path>.` | 1 |

A non-zero exit fails `npm install` (`postinstall`) and stops the `start` and `dist*` chains before they build or package anything.

## Guarantees

- **Healthy installs**: no network access, no writes, and only a handful of file reads.
- **Writes**: only `node_modules/electron/dist/`, `node_modules/electron/path.txt` and `node_modules/electron/electron.d.ts`. The Electron download cache is written only by Electron's own `install.js`.
- **Platforms**: the decision logic is identical on every platform; only the unzip tool differs.
- **Architecture**: the archive choice follows Electron's official installer, including `npm_config_arch` and the Rosetta → `arm64` rule.
