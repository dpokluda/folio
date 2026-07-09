// Pre-populates electron-builder's winCodeSign cache on Windows.
//
// Why: electron-builder downloads `winCodeSign-*.7z`, whose archive contains
// macOS `.dylib` *symlinks*. Extracting symlinks on Windows requires
// Administrator rights or "Developer Mode"; without them 7-Zip aborts with
// "Cannot create symbolic link : A required privilege is not held by the
// client", which fails the whole build — even though those darwin symlinks are
// never needed for a Windows package.
//
// Fix: extract the archive ourselves with symlink creation disabled (`-snl-`)
// into the exact cache folder electron-builder looks for. If that folder
// already exists (with the Windows signing tools), electron-builder skips its
// own broken extraction. No admin / Developer Mode required.
//
// No-op on macOS and Linux.
const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const WINCODESIGN_VERSION = '2.6.0';
const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${WINCODESIGN_VERSION}/winCodeSign-${WINCODESIGN_VERSION}.7z`;

function log(msg) {
  console.log(`[prepare-wincodesign] ${msg}`);
}

function cacheRoot() {
  const local =
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(local, 'electron-builder', 'Cache', 'winCodeSign');
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.rmSync(dest, { force: true });
          return resolve(download(res.headers.location, dest, redirects + 1));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.rmSync(dest, { force: true });
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        file.close();
        fs.rmSync(dest, { force: true });
        reject(err);
      });
  });
}

async function main() {
  if (process.platform !== 'win32') {
    log('non-Windows platform — nothing to do.');
    return;
  }

  const root = cacheRoot();
  const finalDir = path.join(root, `winCodeSign-${WINCODESIGN_VERSION}`);
  const signtool = path.join(finalDir, 'windows-10', 'x64', 'signtool.exe');

  if (fs.existsSync(signtool)) {
    log(`cache already present at ${finalDir} — skipping.`);
    return;
  }

  // Resolve the bundled 7-Zip binary (dependency of electron-builder).
  let path7za;
  try {
    path7za = require('7zip-bin').path7za;
  } catch (_) {
    throw new Error(
      "Cannot find '7zip-bin'. Run `npm install` first (it ships with electron-builder)."
    );
  }

  fs.mkdirSync(root, { recursive: true });
  const archive = path.join(root, 'winCodeSign-prepare.7z');

  log(`downloading winCodeSign ${WINCODESIGN_VERSION}…`);
  await download(URL, archive);
  log(`downloaded ${fs.statSync(archive).size} bytes.`);

  if (fs.existsSync(finalDir)) fs.rmSync(finalDir, { recursive: true, force: true });

  log('extracting (symlinks disabled)…');
  // -snl- disables symbolic-link extraction so the darwin .dylib symlinks are
  // written as regular files / skipped instead of failing the extraction.
  const res = spawnSync(
    path7za,
    ['x', '-bd', '-snl-', '-y', `-o${finalDir}`, archive],
    { stdio: 'inherit' }
  );
  fs.rmSync(archive, { force: true });

  if (res.status !== 0 || !fs.existsSync(signtool)) {
    throw new Error(
      `Extraction did not produce the expected Windows tools at ${signtool} (7za exit ${res.status}).`
    );
  }

  log(`ready: ${finalDir}`);
}

main().catch((err) => {
  console.error(`[prepare-wincodesign] ${err.message}`);
  process.exit(1);
});
