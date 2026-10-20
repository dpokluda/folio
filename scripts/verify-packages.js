const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs, isDeepStrictEqual } = require('node:util');
const { spawnSync } = require('node:child_process');
const asar = require('@electron/asar');
const { readMetadata, packageNames, readArchitecture } = require('./package-metadata');

const USAGE = 'Usage: node scripts/verify-packages.js --platform windows|linux|macos --arch x64|arm64 --directory release [--fedora 44]';
const INNO_KEY = 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\com.dpokluda.folio_is1';
const LEGACY_KEY = 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\9f5ff8db-51b6-575b-9468-75de01a1e384';
const PROBE = 'JSON.stringify({arch:process.arch,electron:process.versions.electron})';
const THEME_FILES = ['base.css', ...['fluent', 'github', 'word'].flatMap((family) => [
  `${family}/dynamic.css`, `${family}/a4.css`, `${family}/us-letter.css`,
  ...(family === 'fluent' ? [] : [`${family}/${family}.css`]),
])];

function parseArguments(args) {
  const { values } = parseArgs({
    args, strict: true, allowPositionals: false,
    options: {
      platform: { type: 'string' }, arch: { type: 'string' },
      directory: { type: 'string' }, fedora: { type: 'string' },
    },
  });
  if (!values.platform || !values.arch || !values.directory) throw new Error(USAGE);
  if (!/^(windows|linux|macos)$/.test(values.platform) || !['x64', 'arm64'].includes(values.arch)) {
    throw new Error(`Unsupported native target ${values.platform}-${values.arch}. ${USAGE}`);
  }
  if (values.fedora !== undefined && (values.platform !== 'linux' || values.fedora !== '44')) {
    throw new Error('Fedora validation supports only --platform linux --fedora 44.');
  }
  return { ...values, directory: path.resolve(values.directory) };
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024, ...options,
  });
  if (result.error) throw new Error(`Cannot launch ${command}: ${result.error.message}`, { cause: result.error });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status} ${result.signal || ''}:\n${result.stderr || ''}${result.stdout || ''}`);
  }
  return result.stdout;
}

function requireFile(file) {
  if (!fs.statSync(file).isFile() || fs.statSync(file).size === 0) {
    throw new Error(`Required package file is missing or empty: ${file}`);
  }
}

function sameBytes(actual, expected, description) {
  requireFile(actual);
  if (!fs.readFileSync(actual).equals(fs.readFileSync(expected))) {
    throw new Error(`${description} does not match the checked-out source: ${actual}`);
  }
}

function rejectFonts(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Bundled themes must not depend on a symbolic link: ${file}`);
    if (entry.isDirectory()) rejectFonts(file);
    else if (/(?:^|[\\/])word[\\/]fonts[\\/].*\.ttf$/i.test(file)) {
      throw new Error(`Restricted font found in packaged themes: ${file}`);
    }
  }
}

/** Inspect actual extracted app bytes; launching and platform integration are checked separately. */
function inspectPayload(app, metadata, platform, arch) {
  packageNames(metadata.version, platform, arch);
  const resources = path.join(app, platform === 'macos' ? 'Contents/Resources' : 'resources');
  const executable = path.join(app, platform === 'macos' ? 'Contents/MacOS/Folio' :
    platform === 'windows' ? 'Folio.exe' : 'folio');
  requireFile(executable);
  const actual = readArchitecture(executable);
  if (actual !== arch) throw new Error(`Application architecture ${actual} does not match ${arch}: ${executable}`);
  if (platform !== 'windows' && (fs.statSync(executable).mode & 0o111) === 0) {
    throw new Error(`Archive lost application executable permissions: ${executable}`);
  }
  sameBytes(path.join(resources, 'README.md'), metadata.guidePath, 'Consumer guide');
  sameBytes(path.join(resources, 'LICENSE'), metadata.licensePath, 'Product license');
  for (const file of THEME_FILES) {
    sameBytes(path.join(resources, 'themes', file), path.join(metadata.root, 'themes', file), `Theme ${file}`);
  }
  rejectFonts(path.join(resources, 'themes'));
  if (platform !== 'linux') requireFile(path.join(resources, platform === 'windows' ? 'document.ico' : 'document.icns'));
  const archive = path.join(resources, 'app.asar');
  requireFile(archive);
  const entries = new Set(asar.listPackage(archive).map((file) => file.replaceAll('\\', '/').replace(/^\/+/, '')));
  // ASAR lookup APIs split directories using the host separator, unlike our portable entry keys.
  const statEntry = (file) => asar.statFile(archive, path.normalize(file));
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  if (packaged.version !== metadata.version || packaged.name !== metadata.name) {
    throw new Error(`Packaged application metadata does not match source version ${metadata.version}.`);
  }
  for (const file of ['src/main.js', 'src/preload.js', 'src/menu.js', 'src/renderer/index.html',
    'src/renderer/bundle.js', 'src/renderer/katex/katex.min.css',
    'samples/welcome.md', 'samples/formatting-tour.md', 'build/icons/icon.png',
    ...(platform === 'windows' ? ['build/icons/icon.ico'] : [])]) {
    if (!entries.has(file) || !(statEntry(file).size > 0)) {
      throw new Error(`Required application asset is missing or empty: ${file}`);
    }
  }
  const katexCss = asar.extractFile(archive, path.normalize('src/renderer/katex/katex.min.css')).toString('utf8');
  const fonts = [...katexCss.matchAll(/url\(["']?(fonts\/[^)"']+\.woff2)["']?\)/g)].map((match) => `src/renderer/katex/${match[1]}`);
  if (!fonts.length || fonts.some((file) => !entries.has(file) || !(statEntry(file).size > 0))) {
    throw new Error('Packaged offline KaTeX fonts referenced by its stylesheet are missing or empty.');
  }
  if (![...entries].some((file) => /^node_modules\/.+\/(licen[cs]e|copying)(?:[-.]|$)/i.test(file))) {
    throw new Error('Production dependency license notices are missing.');
  }
  if ([...entries].some((file) => /^themes\/word\/fonts\/.*\.ttf$/i.test(file))) {
    throw new Error('Restricted font found in the ASAR theme copy.');
  }
  return { resources, executable };
}

function locateApp(directory, platform) {
  const found = [];
  const queue = [{ directory, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    const resources = path.join(current.directory, platform === 'macos' ? 'Contents/Resources' : 'resources');
    if (fs.existsSync(path.join(resources, 'app.asar'))) {
      found.push(current.directory);
      continue;
    }
    if (current.depth >= 4) continue;
    for (const entry of fs.readdirSync(current.directory, { withFileTypes: true })) {
      if (entry.isDirectory()) queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
    }
  }
  if (found.length !== 1) throw new Error(`Expected exactly one application payload in ${directory}; found ${found.length}.`);
  return found[0];
}

function validateProbe(output, metadata, arch) {
  const line = output.trim().split(/\r?\n/).at(-1);
  let result;
  try {
    result = JSON.parse(line);
  } catch (error) {
    throw new Error('Native runtime probe did not return its expected JSON record.', { cause: error });
  }
  if (result.arch !== arch || result.electron !== metadata.electronVersion) {
    throw new Error(`Native runtime probe mismatch: expected ${arch} / Electron ${metadata.electronVersion}, received ${line}.`);
  }
}

function probePayload(app, metadata, platform, arch) {
  const inspected = inspectPayload(app, metadata, platform, arch);
  validateProbe(runCommand(inspected.executable, ['-p', PROBE], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  }), metadata, arch);
  return inspected;
}

/** Replace only one target's generated staging directory, after validating the complete pair. */
function stagePackages(files, destination) {
  destination = path.resolve(destination);
  const match = path.basename(destination).match(/^(windows|linux|macos)-(x64|arm64)$/);
  if (!match || path.basename(path.dirname(destination)) !== 'artifacts') {
    throw new Error('Staging must target an artifacts/<platform>-<arch> directory.');
  }
  if (files.length !== 2) throw new Error('Staging requires exactly two package files.');
  const [, platform, arch] = match;
  const suffix = platform === 'windows' ? '.zip' : '.tar.gz';
  const tail = `-${platform}-${arch}${suffix}`;
  const archive = files.map((file) => path.basename(file)).find((name) => name.startsWith('Folio-') && name.endsWith(tail));
  if (!archive) throw new Error('Staging package pair has no matching target archive.');
  const version = archive.slice('Folio-'.length, -tail.length);
  const expected = packageNames(version, platform, arch).sort();
  if (JSON.stringify(files.map((file) => path.basename(file)).sort()) !== JSON.stringify(expected)) {
    throw new Error('Staging accepts only the expected target package pair.');
  }
  for (const file of files) requireFile(file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = fs.mkdtempSync(path.join(path.dirname(destination), `.${path.basename(destination)}-`));
  let primary;
  try {
    for (const file of files) fs.copyFileSync(file, path.join(temporary, path.basename(file)));
    fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(temporary, destination);
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try {
      fs.rmSync(temporary, { recursive: true, force: true });
    } catch (error) {
      if (primary) throw new AggregateError([primary, error], 'Package staging and cleanup failed.');
      throw error;
    }
  }
  return expected.map((name) => path.join(destination, name));
}

function windowsState() {
  const script = `
$ErrorActionPreference = 'Stop'
$installations = @()
$registrations = @()
foreach ($hiveName in @('CurrentUser', 'LocalMachine')) {
  foreach ($viewName in @('Registry32', 'Registry64')) {
    $hive = [Enum]::Parse([Microsoft.Win32.RegistryHive], $hiveName)
    $view = [Enum]::Parse([Microsoft.Win32.RegistryView], $viewName)
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    try {
      foreach ($name in @('${INNO_KEY}', '${LEGACY_KEY}')) {
        $key = $base.OpenSubKey($name)
        if ($null -ne $key) {
          try {
            $installations += [pscustomobject]@{
              hive = $hiveName; view = $viewName; key = $name
              location = $key.GetValue('InstallLocation'); version = $key.GetValue('DisplayVersion')
            }
          } finally { $key.Dispose() }
        }
      }
      if ($hiveName -eq 'CurrentUser') {
        foreach ($name in @('Software\\Classes\\Folio.Markdown', 'Software\\com.dpokluda.folio\\Capabilities')) {
          $key = $base.OpenSubKey($name)
          if ($null -ne $key) { $registrations += $name; $key.Dispose() }
        }
      }
    } finally { $base.Dispose() }
  }
}
$base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
  [Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Registry64)
try {
  $choices = @{}
  $extensions = @{}
  foreach ($ext in @('.md', '.markdown', '.mdown', '.mkd', '.mkdn')) {
    $key = $base.OpenSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\' + $ext + '\\UserChoice')
    try {
      $choices[$ext] = if ($null -eq $key) { $null } else {
        @{ progId = $key.GetValue('ProgId'); hash = $key.GetValue('Hash') }
      }
    } finally { if ($null -ne $key) { $key.Dispose() } }
    $key = $base.OpenSubKey('Software\\Classes\\' + $ext + '\\OpenWithProgids')
    try {
      $extensions[$ext] = $null -ne $key -and $key.GetValueNames() -contains 'Folio.Markdown'
    } finally { if ($null -ne $key) { $key.Dispose() } }
  }
  $key = $base.OpenSubKey('Software\\Classes\\Folio.Markdown\\shell\\open\\command')
  try { $command = if ($null -eq $key) { $null } else { $key.GetValue('') } }
  finally { if ($null -ne $key) { $key.Dispose() } }
  $key = $base.OpenSubKey('Software\\Classes\\Folio.Markdown\\DefaultIcon')
  try { $icon = if ($null -eq $key) { $null } else { $key.GetValue('') } }
  finally { if ($null -ne $key) { $key.Dispose() } }
  $key = $base.OpenSubKey('Software\\RegisteredApplications')
  try { $registered = if ($null -eq $key) { $null } else { $key.GetValue('com.dpokluda.folio') } }
  finally { if ($null -ne $key) { $key.Dispose() } }
} finally { $base.Dispose() }
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Folio.lnk'
$shortcutExists = Test-Path -LiteralPath $shortcut
$shortcutTarget = if ($shortcutExists) {
  (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut).TargetPath
} else { $null }
@{
  installations = @($installations); registrations = @($registrations)
  choices = $choices; extensions = $extensions; command = $command; icon = $icon
  registered = $registered; shortcutExists = $shortcutExists; shortcutTarget = $shortcutTarget
} | ConvertTo-Json -Depth 8 -Compress
`;
  return JSON.parse(runCommand('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script]));
}

function hasWindowsRegistration(state) {
  return state.installations.length > 0 || state.registrations.length > 0 || state.shortcutExists ||
    state.registered !== null || Object.values(state.extensions).some(Boolean) ||
    Object.values(state.choices).some((choice) => choice?.progId === 'Folio.Markdown');
}

function normalizedWindowsPath(value) {
  if (typeof value !== 'string' || !value) throw new Error('Windows installation did not report its owned path.');
  return path.resolve(value).replace(/[\\/]$/, '').toLowerCase();
}

async function verifyWindowsInstaller(setup, metadata, arch, temporary, cleanup) {
  const before = windowsState();
  if (hasWindowsRegistration(before)) {
    throw new Error('Stateful package verification requires a clean test account: an existing Folio installation, handler or shortcut is present.');
  }
  const destination = path.join(temporary, 'installed Folio');
  const log = path.join(temporary, 'inno.log');
  let attempted = false;
  cleanup.push(async () => {
    if (attempted) {
      const state = windowsState();
      const installed = state.installations.filter((entry) => entry.key === INNO_KEY);
      if (installed.some((entry) => entry.hive !== 'CurrentUser' ||
          normalizedWindowsPath(entry.location) !== normalizedWindowsPath(destination))) {
        throw new Error('Refusing to uninstall an unexpected or concurrently replaced Folio installation.');
      }
      const uninstallers = fs.existsSync(destination)
        ? fs.readdirSync(destination).filter((file) => /^unins\d+\.exe$/i.test(file)) : [];
      if (installed.length && uninstallers.length !== 1) throw new Error('Owned test installation has no unique uninstaller.');
      if (uninstallers.length === 1) {
        if (!installed.length && hasWindowsRegistration(state)) {
          throw new Error('Refusing ambiguous partial-install cleanup; test files are retained for inspection.');
        }
        runCommand(path.join(destination, uninstallers[0]), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']);
        const deadline = Date.now() + 30000;
        while (fs.existsSync(path.join(destination, 'Folio.exe')) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      const after = windowsState();
      if (hasWindowsRegistration(after) || !isDeepStrictEqual(after.choices, before.choices) ||
          fs.existsSync(path.join(destination, 'Folio.exe'))) {
        throw new Error('Test uninstall did not clean its owned registration or changed a protected default.');
      }
    }
  });
  attempted = true;
  runCommand(setup, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CURRENTUSER',
    `/DIR=${destination}`, `/LOG=${log}`], { timeout: 300000 });
  const state = windowsState();
  const owned = state.installations.filter((entry) => entry.key === INNO_KEY);
  if (!owned.length || owned.some((entry) => entry.hive !== 'CurrentUser' ||
      normalizedWindowsPath(entry.location) !== normalizedWindowsPath(destination) || entry.version !== metadata.version)) {
    throw new Error('Installer did not create the expected current-user uninstall identity and product version.');
  }
  if (!isDeepStrictEqual(state.choices, before.choices)) {
    throw new Error('Installation changed an existing protected file-handler choice.');
  }
  if (state.command !== `"${path.join(destination, 'Folio.exe')}" "%1"` ||
      state.icon !== `"${path.join(destination, 'resources/document.ico')}"` ||
      !Object.values(state.extensions).every(Boolean) ||
      state.registered !== 'Software\\com.dpokluda.folio\\Capabilities' ||
      normalizedWindowsPath(state.shortcutTarget) !== normalizedWindowsPath(path.join(destination, 'Folio.exe'))) {
    throw new Error('Installed per-user Markdown registration, icon or Start menu shortcut is incomplete.');
  }
  probePayload(destination, metadata, 'windows', arch);
}

function verifyMacApp(app, metadata, arch) {
  const inspected = probePayload(app, metadata, 'macos', arch);
  runCommand('codesign', ['--verify', '--deep', '--strict', app]);
  const plist = path.join(app, 'Contents/Info.plist');
  const value = (key) => runCommand('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]).trim();
  if (value('CFBundleIdentifier') !== metadata.appId ||
      ![metadata.version, metadata.windowsVersion.split('.').slice(0, 3).join('.')].includes(value('CFBundleShortVersionString')) ||
      value('CFBundleDocumentTypes:0:CFBundleTypeIconFile') !== 'document.icns' ||
      value('CFBundleDocumentTypes:0:LSHandlerRank') !== 'Alternate' ||
      value('CFBundleDocumentTypes:1:LSHandlerRank') !== 'None') {
    throw new Error('macOS bundle identity, product version or document declarations changed unexpectedly.');
  }
  return inspected;
}

function mountedAt(mount, parent) {
  return fs.existsSync(mount) && fs.statSync(mount).dev !== fs.statSync(parent).dev;
}

function verifyDmg(file, metadata, arch, temporary, cleanup) {
  const mount = path.join(temporary, 'dmg-mount');
  fs.mkdirSync(mount);
  let attached = false;
  cleanup.push(() => {
    if (attached || mountedAt(mount, temporary)) runCommand('hdiutil', ['detach', mount]);
  });
  runCommand('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, file]);
  attached = true;
  const app = locateApp(mount, 'macos');
  verifyMacApp(app, metadata, arch);
  const copy = path.join(temporary, 'copied-dmg', 'Folio.app');
  runCommand('ditto', [app, copy]);
  runCommand('hdiutil', ['detach', mount]);
  attached = false;
  verifyMacApp(copy, metadata, arch);
}

function verifyFedora(app, metadata, arch, temporary, cleanup) {
  const image = 'fedora:44';
  const platform = arch === 'x64' ? 'linux/amd64' : 'linux/arm64';
  runCommand('docker', ['pull', '--platform', platform, image], { timeout: 300000 });
  const digest = runCommand('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', image]).trim();
  const digests = JSON.parse(digest);
  if (!Array.isArray(digests) || !digests.length || !digests.every((value) => /@sha256:[a-f0-9]{64}$/.test(value))) {
    throw new Error('Fedora image inspection did not return its resolved content digest.');
  }
  console.log(`[verify] Fedora ${arch} image: ${digest}`);
  const cidFile = path.join(temporary, `fedora-${crypto.randomUUID()}.cid`);
  cleanup.push(() => {
    if (!fs.existsSync(cidFile)) return;
    const id = fs.readFileSync(cidFile, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error(`Invalid owned Docker container ID: ${cidFile}`);
    const result = spawnSync('docker', ['rm', '--force', id], { encoding: 'utf8', timeout: 30000 });
    if (result.error || (result.status !== 0 && !/No such container/i.test(result.stderr || ''))) {
      throw new Error(`Cannot remove owned Fedora probe container ${id}: ${result.error?.message || result.stderr}`);
    }
  });
  const script = `set -euo pipefail
dnf -q -y install gtk3 nss alsa-lib mesa-libgbm libdrm libxkbcommon libXScrnSaver fuse fuse-libs
ldconfig -p | grep -F 'libfuse.so.2'
export ELECTRON_RUN_AS_NODE=1
exec /app/folio -p '${PROBE}'
`;
  const output = runCommand('docker', ['run', '--rm', '--platform', platform, '--cidfile', cidFile,
    '--mount', `type=bind,source=${app},target=/app,readonly`, image, 'bash', '-lc', script], { timeout: 300000 });
  validateProbe(output, metadata, arch);
}

async function verifyPackages(options) {
  const metadata = readMetadata();
  const platform = { win32: 'windows', linux: 'linux', darwin: 'macos' }[process.platform];
  const machine = os.machine().toLowerCase();
  const physicalArch = ['x86_64', 'amd64', 'x64'].includes(machine) ? 'x64' :
    ['arm64', 'aarch64'].includes(machine) ? 'arm64' : null;
  if (platform !== options.platform || process.arch !== options.arch || physicalArch !== options.arch) {
    throw new Error(`Native verification requires a matching OS and architecture, not emulation: ${options.platform}-${options.arch}.`);
  }
  const files = packageNames(metadata.version, options.platform, options.arch).map((name) => path.join(options.directory, name));
  for (const file of files) requireFile(file);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-verify-'));
  const cleanup = [];
  let primary;
  try {
    const archiveDirectory = path.join(temporary, 'archive');
    fs.mkdirSync(archiveDirectory);
    if (platform === 'windows') {
      runCommand('pwsh', ['-NoProfile', '-NonInteractive', '-Command',
        'Expand-Archive -LiteralPath $env:FOLIO_ARCHIVE -DestinationPath $env:FOLIO_EXTRACT'], {
        env: { ...process.env, FOLIO_ARCHIVE: files[0], FOLIO_EXTRACT: archiveDirectory },
      });
    } else {
      runCommand('tar', ['-xzf', files[0], '-C', archiveDirectory]);
    }
    const archivedApp = locateApp(archiveDirectory, platform);
    if (platform === 'macos') {
      verifyMacApp(archivedApp, metadata, options.arch);
      verifyDmg(files[1], metadata, options.arch, temporary, cleanup);
    } else if (platform === 'windows') {
      probePayload(archivedApp, metadata, platform, options.arch);
      await verifyWindowsInstaller(files[1], metadata, options.arch, temporary, cleanup);
    } else {
      probePayload(archivedApp, metadata, platform, options.arch);
      if (readArchitecture(files[1]) !== options.arch) throw new Error('AppImage runtime architecture does not match the target.');
      if ((fs.statSync(files[1]).mode & 0o111) === 0) throw new Error('AppImage must be executable before verification (chmod +x).');
      const imageDirectory = path.join(temporary, 'appimage');
      fs.mkdirSync(imageDirectory);
      runCommand(files[1], ['--appimage-extract'], { cwd: imageDirectory });
      const imageApp = locateApp(path.join(imageDirectory, 'squashfs-root'), 'linux');
      probePayload(imageApp, metadata, platform, options.arch);
      if (options.fedora) {
        verifyFedora(archivedApp, metadata, options.arch, temporary, cleanup);
        verifyFedora(imageApp, metadata, options.arch, temporary, cleanup);
      } else {
        console.log('[verify] Fedora compatibility probes were not requested; Fedora qualification is not implied.');
      }
    }
  } catch (error) {
    primary = error;
  } finally {
    const errors = [];
    for (const dispose of cleanup.reverse()) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length === 0) {
      try { fs.rmSync(temporary, { recursive: true, force: true }); } catch (error) { errors.push(error); }
    }
    if (errors.length) {
      primary = new AggregateError(primary ? [primary, ...errors] : errors, `Package verification cleanup failed; inspect ${temporary}.`);
    }
  }
  if (primary) throw primary;
  const staged = stagePackages(files, path.join(options.directory, 'artifacts', `${options.platform}-${options.arch}`));
  return {
    target: `${options.platform}-${options.arch}`, version: metadata.version, electronVersion: metadata.electronVersion,
    fedora: options.fedora || 'Not run', desktopAcceptance: 'Not run', files: staged,
  };
}

module.exports = { parseArguments, runCommand, inspectPayload, stagePackages, hasWindowsRegistration, verifyPackages };

if (require.main === module) {
  Promise.resolve().then(() => verifyPackages(parseArguments(process.argv.slice(2)))).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error('[verify-packages]', error);
    process.exitCode = 1;
  });
}
