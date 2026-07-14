// Removes the previous `*-unpacked` output before electron-builder repackages.
//
// Why: on Windows, electron-builder edits the freshly-copied `Folio.exe`
// (version strings + icon) with `rcedit`. If a stale `release/win-unpacked/
// Folio.exe` from an earlier build is still *running* — e.g. you launched the
// packaged app to test it — the file is locked and rcedit fails every retry
// with the cryptic:
//
//     ⨯ cannot execute  cause=exit status 1
//       errorOut=Fatal error: Unable to commit changes  (rcedit-x64.exe …)
//
// Deleting the old unpacked dir up front removes that class of failure. If the
// directory can't be deleted because the app is open, we stop with a clear,
// actionable message instead of the confusing rcedit error later.
//
// Safe/no-op when there is no prior unpacked output (any platform).
const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[clean-release] ${msg}`);
}

const releaseDir = path.join(__dirname, '..', 'release');

if (!fs.existsSync(releaseDir)) {
  log('no release/ directory — nothing to clean.');
  process.exit(0);
}

const unpacked = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.endsWith('-unpacked'))
  .map((e) => path.join(releaseDir, e.name));

if (!unpacked.length) {
  log('no *-unpacked directory to remove.');
  process.exit(0);
}

for (const dir of unpacked) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    log(`removed ${path.relative(process.cwd(), dir)}`);
  } catch (err) {
    if (['EBUSY', 'EPERM', 'ENOTEMPTY', 'EACCES'].includes(err.code)) {
      console.error(
        `\n[clean-release] Could not delete ${dir}\n` +
          `[clean-release] A file there is locked — most likely a running Folio.\n` +
          `[clean-release] Close any open Folio window (including a previously\n` +
          `[clean-release] packaged build) and run the command again.\n`
      );
      process.exit(1);
    }
    throw err;
  }
}
