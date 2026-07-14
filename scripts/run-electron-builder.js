// Runs electron-builder, retrying only when it fails on the transient Windows
// `rcedit` file-lock ("Unable to commit changes").
//
// Why: after copying the ~180 MB `Folio.exe`, electron-builder edits it with
// rcedit. On Windows, Defender's real-time scan (or a shell thumbnailer) can
// hold that fresh file open for a second, so rcedit — and all of
// electron-builder's own rapid in-process retries — fail. Waiting a moment and
// re-running the whole package step clears it.
//
// Any argv passed through (e.g. --win) is forwarded to electron-builder. On a
// failure that is NOT the rcedit lock, we exit immediately with its code so
// real errors aren't masked or retried.
const path = require('path');
const { spawn } = require('child_process');

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;
const LOCK_SIGNATURES = ['Unable to commit changes', 'rcedit-x64.exe', 'rcedit-ia32.exe'];

const forwarded = process.argv.slice(2);
const isWin = process.platform === 'win32';
const builderBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  isWin ? 'electron-builder.cmd' : 'electron-builder'
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runOnce() {
  return new Promise((resolve) => {
    // shell:true so the .cmd shim resolves on Windows.
    const child = spawn(builderBin, forwarded, { shell: isWin });
    let combined = '';

    const tee = (stream, out) => {
      stream.on('data', (chunk) => {
        out.write(chunk);
        combined += chunk.toString();
      });
    };
    tee(child.stdout, process.stdout);
    tee(child.stderr, process.stderr);

    child.on('error', (err) => {
      console.error(`[dist] failed to launch electron-builder: ${err.message}`);
      resolve({ code: 1, output: combined });
    });
    child.on('close', (code) => resolve({ code: code == null ? 1 : code, output: combined }));
  });
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { code, output } = await runOnce();
    if (code === 0) process.exit(0);

    const isLock = LOCK_SIGNATURES.some((sig) => output.includes(sig));
    if (!isLock || attempt === MAX_ATTEMPTS) {
      if (isLock) {
        console.error(
          `\n[dist] electron-builder kept failing on the Windows rcedit file lock ` +
            `after ${MAX_ATTEMPTS} attempts.\n` +
            `[dist] This is usually antivirus locking the freshly-built Folio.exe, ` +
            `or a running Folio.\n` +
            `[dist] Close any open Folio, and/or add the project's release\\ folder ` +
            `to your antivirus exclusions, then retry.\n`
        );
      }
      process.exit(code);
    }

    console.error(
      `\n[dist] electron-builder hit the transient rcedit file lock ` +
        `(attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${RETRY_DELAY_MS / 1000}s…\n`
    );
    await sleep(RETRY_DELAY_MS);
  }
}

main();
