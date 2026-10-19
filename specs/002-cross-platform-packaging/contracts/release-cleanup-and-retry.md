# Contract: Release cleanup and lock-aware packaging

**Feature**: [../spec.md](../spec.md) (User Story 5) | **Data model**: [../data-model.md](../data-model.md) §3, §8, §9 | **Since**: 002f2bb (both scripts, unchanged since)

## A. `scripts/clean-release.js` (`npm run clean:release`)

The script runs as the third stage of every `dist*` chain, after the runtime check and the renderer build and before the packager.

| Situation | Behavior | Output | Exit |
|---|---|---|---|
| No `release/` folder | Nothing | `[clean-release] no release/ directory — nothing to clean.` | 0 |
| No `release/*-unpacked` folder | Nothing | `[clean-release] no *-unpacked directory to remove.` | 0 |
| Unpacked folders present | `rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })` for each | `[clean-release] removed <relative path>` for each | 0 |
| Deletion fails with `EBUSY`, `EPERM`, `ENOTEMPTY` or `EACCES` | Stop | Four lines on stderr: `Could not delete <dir>`, `A file there is locked — most likely a running Folio.`, then an instruction to close any open Folio window (including a previously packaged build) and run the command again | 1 |
| Any other error | Rethrown | Node error output | non-zero |

**Scope**: The script only deletes directories directly under `release/` whose names end in `-unpacked`, such as `win-unpacked` and `linux-unpacked`. Installers, DMGs, AppImages, .deb files and the macOS app folder (for example `mac-arm64/`) are kept.

**Why**: A running `release/win-unpacked/Folio.exe` locks the file. The packager's executable-editing step (rcedit) would then fail on every retry with the cryptic "Unable to commit changes". Deleting the folder first turns that case into a clear message before the packager starts.

## B. `scripts/run-electron-builder.js` (the last stage of `dist*`)

**Invocation**: `node scripts/run-electron-builder.js [electron-builder args…]`. The `dist` scripts pass nothing, `--win`, `--mac` or `--linux`.

| Constant | Value |
|---|---|
| `MAX_ATTEMPTS` | `3` |
| `RETRY_DELAY_MS` | `4000` |
| `LOCK_SIGNATURES` | `Unable to commit changes`, `rcedit-x64.exe`, `rcedit-ia32.exe` |
| Packager binary | `node_modules/.bin/electron-builder` (`electron-builder.cmd`, spawned with `shell: true`, on Windows) |

**Algorithm** (per attempt `k = 1..3`):

1. Spawn the packager with the forwarded arguments. Stream its stdout and stderr live and accumulate both.
2. If the exit code is `0`, exit `0`.
3. If the accumulated output contains a lock signature and `k < 3`:
   1. Print `[dist] electron-builder hit the transient rcedit file lock (attempt k/3). Retrying in 4s…`.
   2. Wait 4000 ms.
   3. Start the next attempt.
4. If it contains a lock signature and `k = 3`:
   1. Print guidance: the lock persisted after 3 attempts, it is usually antivirus or a running Folio, and the fix is to close any open Folio and/or add the project's `release\` folder to the antivirus exclusions, then retry.
   2. Exit with the packager's code.
5. For any other failure, exit immediately with the packager's code, without retrying.

Special cases:

- If the packager can't be launched, the script prints `[dist] failed to launch electron-builder: <message>` and exits with code `1`.
- If the packager is killed by a signal, the script exits with code `1`.

**Guarantees**:

- Arguments are forwarded unchanged.
- Real errors are never masked or repeated.
- The worst-case added delay is 2 × 4 s.
- The retry is driven only by the output signatures, so it costs nothing on platforms where the lock can't occur.
