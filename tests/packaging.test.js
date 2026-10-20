const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { readMetadata, packageNames, readArchitecture } = require('../scripts/package-metadata');

const source = path.resolve(__dirname, '..');
const themeFiles = ['base.css', ...['fluent', 'github', 'word'].flatMap((family) => [
  `${family}/dynamic.css`, `${family}/a4.css`, `${family}/us-letter.css`,
  ...(family === 'fluent' ? [] : [`${family}/${family}.css`]),
])];

function write(root, file, content) {
  const destination = path.join(root, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
  return destination;
}

function fixture(t, version = '1.0.0') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-packaging-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pkg = {
    name: 'folio', version, devDependencies: { electron: '^43.2.0' },
    build: { appId: 'com.dpokluda.folio', productName: 'Folio', directories: { output: 'release' } },
  };
  const lock = {
    version, lockfileVersion: 3,
    packages: { '': { version }, 'node_modules/electron': { version: '43.8.1' } },
  };
  write(root, 'package.json', JSON.stringify(pkg));
  write(root, 'package-lock.json', JSON.stringify(lock));
  for (const file of ['docs/user/README.md', 'LICENSE', 'samples/welcome.md', 'samples/formatting-tour.md',
    'src/main.js', 'src/preload.js', 'src/menu.js', 'src/renderer/index.html',
    'build/icons/icon.png', 'build/icons/icon.ico', 'build/icons/icon.icns',
    'build/icons/document.ico', 'build/icons/document.icns']) {
    write(root, file, `Fixture ${file}\n`);
  }
  for (const file of themeFiles) write(root, `themes/${file}`, 'body { color: black; }\n');
  return { root, pkg, lock };
}

function updateFixture(f) {
  write(f.root, 'package.json', JSON.stringify(f.pkg));
  write(f.root, 'package-lock.json', JSON.stringify(f.lock));
}

function binary(platform, arch) {
  const buffer = Buffer.alloc(128);
  if (platform === 'windows') {
    buffer.write('MZ');
    buffer.writeUInt32LE(64, 0x3c);
    buffer.write('PE\0\0', 64);
    buffer.writeUInt16LE(arch === 'x64' ? 0x8664 : 0xaa64, 68);
  } else if (platform === 'linux') {
    buffer.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]);
    buffer.writeUInt16LE(arch === 'x64' ? 62 : 183, 18);
  } else {
    buffer.writeUInt32LE(0xfeedfacf, 0);
    buffer.writeUInt32LE(arch === 'x64' ? 0x01000007 : 0x0100000c, 4);
  }
  return buffer;
}

test('metadata preserves the source version, identity and source files', (t) => {
  const f = fixture(t);
  const before = ['package.json', 'package-lock.json', 'docs/user/README.md']
    .map((file) => fs.readFileSync(path.join(f.root, file)));
  const result = readMetadata(f.root);
  assert.equal(result.version, '1.0.0');
  assert.equal(result.name, 'folio');
  assert.equal(result.productName, 'Folio');
  assert.equal(result.appId, 'com.dpokluda.folio');
  assert.equal(result.windowsVersion, '1.0.0.0');
  assert.equal(result.electronVersion, '43.8.1');
  ['package.json', 'package-lock.json', 'docs/user/README.md'].forEach((file, index) => {
    assert.deepEqual(fs.readFileSync(path.join(f.root, file)), before[index]);
  });
});

test('metadata accepts subsequent versions and preserves prerelease/build text', (t) => {
  for (const version of ['1.1.0', '2.3.4-rc.1+build.5']) {
    assert.equal(readMetadata(fixture(t, version).root).version, version);
  }
});

test('metadata rejects mismatched lockfile product versions rather than the format number', (t) => {
  for (const location of ['root', 'package']) {
    const f = fixture(t);
    if (location === 'root') f.lock.version = '0.1.0';
    else f.lock.packages[''].version = '0.1.0';
    updateFixture(f);
    assert.throws(() => readMetadata(f.root), /lock.*version|version.*lock/i);
  }
});

test('metadata rejects invalid and Windows-unrepresentable source versions', (t) => {
  for (const version of ['v1.0.0', '1.0', '1.0.0\n', '../1.0.0', '01.0.0', '65536.0.0']) {
    assert.throws(() => readMetadata(fixture(t, version).root), /version|SemVer/i);
  }
});

test('metadata rejects missing guide and incomplete source assets', (t) => {
  for (const file of ['docs/user/README.md', 'LICENSE', 'build/icons/icon.ico']) {
    const f = fixture(t);
    fs.unlinkSync(path.join(f.root, file));
    assert.throws(() => readMetadata(f.root), new RegExp(path.basename(file).replace('.', '\\.')));
  }
});

test('metadata accepts source paths with spaces and non-ASCII characters', (t) => {
  const f = fixture(t);
  const moved = `${f.root} with spaces \u010d`;
  fs.renameSync(f.root, moved);
  t.after(() => fs.rmSync(moved, { recursive: true, force: true }));
  assert.equal(readMetadata(moved).version, '1.0.0');
});

test('package names cover exactly six native targets and twelve distinct files', () => {
  const names = [];
  for (const platform of ['windows', 'linux', 'macos']) {
    for (const arch of ['x64', 'arm64']) {
      const pair = packageNames('1.1.0', platform, arch);
      assert.equal(pair.length, 2);
      assert.ok(pair[0].startsWith(`Folio-1.1.0-${platform}-${arch}`));
      const imageArch = platform === 'linux' && arch === 'x64' ? 'x86_64' : arch;
      assert.ok(pair[1].startsWith(`Folio-1.1.0-${platform}-${imageArch}`));
      names.push(...pair);
    }
  }
  assert.equal(new Set(names).size, 12);
  assert.deepEqual(packageNames('1.0.0', 'windows', 'arm64'),
    ['Folio-1.0.0-windows-arm64.zip', 'Folio-1.0.0-windows-arm64-setup.exe']);
});

test('AppImage uses the builder x86_64 spelling while the archive target stays x64', () => {
  assert.deepEqual(packageNames('1.0.0', 'linux', 'x64'),
    ['Folio-1.0.0-linux-x64.tar.gz', 'Folio-1.0.0-linux-x86_64.AppImage']);
});

test('package names reject unknown targets, unsafe versions and excessive filenames', () => {
  for (const [platform, arch] of [['windows', 'ia32'], ['macos', 'universal'], ['toString', 'x64']]) {
    assert.throws(() => packageNames('1.0.0', platform, arch), /target|architecture/i);
  }
  assert.throws(() => packageNames('../bad', 'linux', 'x64'), /version|SemVer/i);
  assert.throws(() => packageNames(`1.0.0+${'a'.repeat(230)}`, 'windows', 'arm64'), /length|filename|version/i);
});

test('architecture checks identify PE, ELF and Mach-O native application payloads', (t) => {
  const f = fixture(t);
  for (const platform of ['windows', 'linux', 'macos']) {
    for (const arch of ['x64', 'arm64']) {
      const file = write(f.root, `${platform}-${arch}`, binary(platform, arch));
      assert.equal(readArchitecture(file), arch);
    }
  }
});

test('architecture checks reject truncated, unsupported and invalid binary headers', (t) => {
  const f = fixture(t);
  for (const bytes of [Buffer.from('bad'), Buffer.alloc(128), (() => {
    const data = binary('windows', 'x64');
    data.writeUInt32LE(1000, 0x3c);
    return data;
  })()]) {
    const file = write(f.root, 'invalid', bytes);
    assert.throws(() => readArchitecture(file), /binary|header|architecture|format|truncated/i);
  }
});

test('builder preflight rejects missing guide before launching the builder', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, 'docs/user/README.md'));
  for (const file of ['run-electron-builder.js', 'package-metadata.js']) {
    fs.copyFileSync(path.join(source, 'scripts', file), write(f.root, `scripts/${file}`, ''));
  }
  fs.mkdirSync(path.join(f.root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('semver/package.json')),
    path.join(f.root, 'node_modules', 'semver'), process.platform === 'win32' ? 'junction' : 'dir');
  write(f.root, 'node_modules/electron-builder/cli.js', 'process.stderr.write("BUILDER_WAS_LAUNCHED");process.exit(5);');
  const result = spawnSync(process.execPath, [path.join(f.root, 'scripts/run-electron-builder.js')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /README\.md/);
  assert.doesNotMatch(result.stderr, /BUILDER_WAS_LAUNCHED/);
});

test('builder propagates real errors without the rcedit retry', (t) => {
  const f = fixture(t);
  for (const file of ['run-electron-builder.js', 'package-metadata.js']) {
    fs.copyFileSync(path.join(source, 'scripts', file), write(f.root, `scripts/${file}`, ''));
  }
  fs.mkdirSync(path.join(f.root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('semver/package.json')),
    path.join(f.root, 'node_modules', 'semver'), process.platform === 'win32' ? 'junction' : 'dir');
  write(f.root, 'node_modules/electron-builder/cli.js', 'console.error("deliberate builder failure");process.exit(7);');
  const result = spawnSync(process.execPath, [path.join(f.root, 'scripts/run-electron-builder.js')], { encoding: 'utf8' });
  assert.equal(result.status, 7);
  assert.match(result.stderr, /deliberate builder failure/);
  assert.doesNotMatch(result.stderr, /Retrying/);
});

function compilerFixture(t, version = '1.0.0') {
  const f = fixture(t, version);
  const output = path.join(f.root, 'release');
  const zip = write(output, packageNames(version, 'windows', 'x64')[0], 'ZIP fixture');
  write(output, 'win-unpacked/Folio.exe', binary('windows', 'x64'));
  write(f.root, 'build/windows/folio.iss', 'Compiler fixture');
  const compiler = write(f.root, 'tools with spaces/ISCC.exe', 'Compiler fixture');
  return { ...f, compiler, context: { outDir: output, artifactPaths: [zip] } };
}

function TestCompiler(f, {
  version = '6.7.3', peVersion = '0.0.0.0', probeStatus = 0, probeError = '',
  status = 0, omitOutput = false,
} = {}) {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'pwsh') return { status: 0, stdout: peVersion, stderr: '' };
    assert.equal(command, f.compiler);
    if (args.includes('-')) {
      return {
        status: probeStatus,
        stdout: `Inno Setup 6 Command-Line Compiler\nCompiler engine version: Inno Setup ${version} (u)\n`,
        stderr: probeError,
      };
    }
    if (status === 0 && !omitOutput) {
      write(f.context.outDir, packageNames(f.pkg.version, 'windows', 'x64')[1], 'New compiled setup');
    }
    return { status, stdout: '', stderr: status ? 'deliberate compiler failure' : '' };
  };
  return { run, calls };
}

test('Inno builds only current Windows ZIP outputs and passes the source version', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t);
  const compiler = TestCompiler(f);
  const result = await build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler }, run: compiler.run,
  });
  assert.deepEqual(result, [path.join(f.context.outDir, packageNames('1.0.0', 'windows', 'x64')[1])]);
  const args = compiler.calls.find((call) => call.args.some((arg) => arg.startsWith('/DProductVersion='))).args;
  assert.ok(args.includes('/DProductVersion=1.0.0'));
  assert.ok(args.includes('/DProductNumericVersion=1.0.0.0'));
  assert.ok(args.includes('/DTargetArch=x64'));
  assert.ok(args.some((arg) => arg.startsWith('/DPayloadDir=') && arg.includes(f.root)));
});

test('Inno does nothing for an unpacked-only or non-Windows invocation', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = fixture(t);
  const result = await build({ outDir: path.join(f.root, 'release'), artifactPaths: [] }, {
    root: f.root, platform: 'darwin', env: {}, run: () => assert.fail('Compiler must not run'),
  });
  assert.deepEqual(result, []);
});

test('Inno consumes later source versions and verifies every installed payload file', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t, '1.1.0-rc.1+fixture');
  const compiler = TestCompiler(f);
  let checks;
  const result = await build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler },
    run(command, args, options) {
      if (command === f.compiler && args.some((arg) => arg.startsWith('/DPayloadChecks='))) {
        const include = args.find((arg) => arg.startsWith('/DPayloadChecks=')).slice('/DPayloadChecks='.length);
        checks = fs.readFileSync(include, 'utf8');
      }
      return compiler.run(command, args, options);
    },
  });
  assert.ok(result[0].includes('1.1.0-rc.1+fixture'));
  assert.match(checks, /VerifyPayloadFile\('Folio\.exe', '[a-f0-9]{64}'\)/);
  assert.match(checks, /CanReplacePayloadFile\('Folio\.exe'\)/);
  assert.equal(fs.readdirSync(f.context.outDir).some((name) => name.startsWith('.inno-')), false);
});

test('Inno accepts the pinned engine when the launcher PE version is 0.0.0.0', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t);
  const compiler = TestCompiler(f, { peVersion: '0.0.0.0' });
  const result = await build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler }, run: compiler.run,
  });
  assert.equal(result.length, 1);
  assert.equal(compiler.calls.some((call) => call.command === 'pwsh'), false);
  const probe = compiler.calls.find((call) => call.args.includes('-'));
  assert.ok(probe.args.includes('/O-'));
  assert.match(probe.options.input, /Output=no/);
});

test('Inno rejects the wrong engine even when the PE version claims the pinned version', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t);
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler },
    run: TestCompiler(f, { peVersion: '6.7.3.0', version: '6.7.1' }).run,
  }), /6\.7\.3.*6\.7\.1|6\.7\.1.*6\.7\.3/s);
});

test('Inno rejects failed probes instead of trusting a matching version banner', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t);
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler },
    run: TestCompiler(f, { probeStatus: 7, probeError: 'deliberate probe failure' }).run,
  }), /7.*deliberate probe failure|deliberate probe failure.*7/s);
});

test('Inno rejects an invalid compiler override, wrong version and wrong payload CPU', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t);
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: path.join(f.root, 'missing.exe') },
    run: () => assert.fail('Missing compiler must not execute'),
  }), /ISCC|compiler/i);
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler }, run: TestCompiler(f, { version: '6.7.1.0' }).run,
  }), /6\.7\.3/);
  write(f.context.outDir, 'win-unpacked/Folio.exe', binary('windows', 'arm64'));
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler }, run: TestCompiler(f).run,
  }), /architecture|x64/i);
});

test('Inno preserves compiler failure diagnostics and never returns stale setup output', async (t) => {
  const build = require('../scripts/build-inno-installer');
  const f = compilerFixture(t);
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler }, run: TestCompiler(f, { status: 7 }).run,
  }), /7.*deliberate compiler failure|deliberate compiler failure.*7/s);
  write(f.context.outDir, packageNames('1.0.0', 'windows', 'x64')[1], 'Stale setup');
  await assert.rejects(build(f.context, {
    root: f.root, platform: 'win32', env: { ISCC_PATH: f.compiler }, run: TestCompiler(f, { omitOutput: true }).run,
  }), /output|produce/i);
});

test('verifier CLI accepts only native targets and the explicit Linux Fedora reference', () => {
  const { parseArguments } = require('../scripts/verify-packages');
  const result = parseArguments(['--platform', 'linux', '--arch', 'arm64', '--directory', 'release', '--fedora', '44']);
  assert.equal(result.platform, 'linux');
  assert.equal(result.arch, 'arm64');
  assert.equal(result.fedora, '44');
  for (const args of [
    [], ['--platform', 'windows', '--arch', 'ia32', '--directory', 'release'],
    ['--platform', 'macos', '--arch', 'arm64', '--directory', 'release', '--fedora', '44'],
    ['--platform', 'linux', '--arch', 'x64', '--directory', 'release', '--fedora', 'latest'],
  ]) assert.throws(() => parseArguments(args), /Usage|target|architecture|Fedora|fedora/i);
});

test('verifier command runner propagates native status, stderr and spawn errors', () => {
  const { runCommand } = require('../scripts/verify-packages');
  assert.equal(runCommand(process.execPath, ['-p', 'JSON.stringify("hello")']).trim(), '"hello"');
  assert.throws(() => runCommand(process.execPath, ['-e', 'console.error("deliberate native failure");process.exit(7)']),
    /7.*deliberate native failure|deliberate native failure.*7/s);
  assert.throws(() => runCommand('/folio-test/nonexistent', []), /ENOENT|spawn|launch/i);
});

test('Windows stateful verification guard refuses existing installations, handlers and shortcuts', () => {
  const { hasWindowsRegistration } = require('../scripts/verify-packages');
  const clean = {
    installations: [], registrations: [], registered: null, shortcutExists: false,
    extensions: { '.md': false }, choices: { '.md': { progId: 'Another.Editor', hash: 'unchanged' } },
  };
  assert.equal(hasWindowsRegistration(clean), false);
  for (const changed of [
    { installations: [{ key: 'Existing Folio' }] }, { registrations: ['Folio.Markdown'] },
    { registered: 'Software\\com.dpokluda.folio\\Capabilities' }, { shortcutExists: true },
    { extensions: { '.md': true } }, { choices: { '.md': { progId: 'Folio.Markdown' } } },
  ]) assert.equal(hasWindowsRegistration({ ...clean, ...changed }), true);
});

function windowsIntegrationFixture(destination) {
  const extensions = require('../package.json').build.win.fileAssociations[0].ext;
  return {
    command: `"${path.join(destination, 'Folio.exe')}" "%1"`,
    icon: `"${path.join(destination, 'resources/document.ico')}"`,
    extensions: Object.fromEntries(extensions.map((ext) => [`.${ext}`, true])),
    registered: 'Software\\com.dpokluda.folio\\Capabilities',
    shortcutExists: true, shortcutTarget: path.join(destination, 'Folio.exe'),
  };
}

test('verifier uses canonical installation paths when the shell expands a temporary directory alias', (t) => {
  const { createVerificationDirectory, verifyWindowsIntegration } = require('../scripts/verify-packages');
  const f = fixture(t);
  const parent = path.join(f.root, 'temporary folder');
  const alias = path.join(f.root, 'temporary alias');
  fs.mkdirSync(parent);
  fs.symlinkSync(parent, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const temporary = createVerificationDirectory(alias);
  assert.equal(temporary, fs.realpathSync.native(temporary));
  assert.equal(path.dirname(temporary), fs.realpathSync.native(parent));
  assert.match(path.basename(temporary), /^folio-verify-/);
  const destination = path.join(temporary, 'installed Folio');
  const executable = write(destination, 'Folio.exe', binary('windows', 'x64'));
  const shortcutTarget = fs.realpathSync.native(executable);
  const aliasedDestination = path.join(alias, path.basename(temporary), 'installed Folio');
  assert.throws(() => verifyWindowsIntegration({
    ...windowsIntegrationFixture(aliasedDestination), shortcutTarget,
  }, aliasedDestination), /Start menu shortcut target/);
  assert.doesNotThrow(() => verifyWindowsIntegration({
    ...windowsIntegrationFixture(destination), shortcutTarget,
  }, destination));
});

test('Windows verifier expands an actual 8.3 temporary path before installation', {
  skip: process.platform !== 'win32' ? 'Windows 8.3 paths require a native Windows filesystem.' : false,
}, (t) => {
  const { createVerificationDirectory, runCommand } = require('../scripts/verify-packages');
  const f = fixture(t);
  const parent = path.join(f.root, 'long temporary folder');
  fs.mkdirSync(parent);
  const shortPath = JSON.parse(runCommand('pwsh', ['-NoProfile', '-NonInteractive', '-Command', `
$ErrorActionPreference = 'Stop'
(New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:FOLIO_TEST_PARENT).ShortPath |
  ConvertTo-Json -Compress
`], { env: { ...process.env, FOLIO_TEST_PARENT: parent } }));
  assert.equal(typeof shortPath, 'string', 'The native filesystem probe must report a path.');
  const canonicalParent = fs.realpathSync.native(parent);
  if (shortPath.toLowerCase() === canonicalParent.toLowerCase()) {
    t.skip('The fixture volume does not expose an 8.3 alias; the junction regression still applies.');
    return;
  }
  const temporary = createVerificationDirectory(shortPath);
  assert.equal(path.dirname(temporary), canonicalParent);
  assert.equal(temporary, fs.realpathSync.native(temporary));
});

test('Windows integration verification accepts the complete quoted per-user registration', (t) => {
  const { verifyWindowsIntegration } = require('../scripts/verify-packages');
  const f = fixture(t);
  const destination = path.join(f.root, 'installed Folio');
  assert.doesNotThrow(() => verifyWindowsIntegration(windowsIntegrationFixture(destination), destination));
});

test('Windows integration verification reports every mismatched field with its actual value', (t) => {
  const { verifyWindowsIntegration } = require('../scripts/verify-packages');
  const f = fixture(t);
  const destination = path.join(f.root, 'installed Folio');
  const state = windowsIntegrationFixture(destination);
  state.command = 'unquoted wrong command';
  state.icon = null;
  state.extensions['.markdown'] = false;
  state.registered = 'Software\\Another.Application\\Capabilities';
  state.shortcutTarget = path.join(f.root, 'another Folio', 'Folio.exe');
  assert.throws(() => verifyWindowsIntegration(state, destination), (error) => {
    for (const pattern of [/Markdown open command.*unquoted wrong command/, /Document icon.*null/,
      /\.markdown.*false/, /Registered application.*Another/, /Start menu shortcut target.*another Folio/]) {
      assert.match(error.message, pattern);
    }
    return true;
  });
});

test('Windows integration verification rejects missing shortcuts and incomplete extension records', (t) => {
  const { verifyWindowsIntegration } = require('../scripts/verify-packages');
  const f = fixture(t);
  const destination = path.join(f.root, 'installed Folio');
  assert.throws(() => verifyWindowsIntegration({
    ...windowsIntegrationFixture(destination), shortcutExists: false,
  }, destination), /Start menu shortcut.*false/);
  assert.throws(() => verifyWindowsIntegration({
    ...windowsIntegrationFixture(destination), shortcutTarget: null,
  }, destination), /Start menu shortcut target.*null/);
  assert.throws(() => verifyWindowsIntegration({
    ...windowsIntegrationFixture(destination), extensions: {},
  }, destination), /OpenWithProgids.*\.md/);
  for (const extension of Object.keys(windowsIntegrationFixture(destination).extensions)) {
    const state = windowsIntegrationFixture(destination);
    delete state.extensions[extension];
    assert.throws(() => verifyWindowsIntegration(state, destination), (error) => {
      assert.ok(error.message.includes(`OpenWithProgids ${extension}: expected true, received undefined.`));
      return true;
    });
  }
});

test('Windows integration verification still requires the quoted executable and document argument', (t) => {
  const { verifyWindowsIntegration } = require('../scripts/verify-packages');
  const f = fixture(t);
  const destination = path.join(f.root, 'installed Folio');
  const executable = path.join(destination, 'Folio.exe');
  for (const command of [`${executable} "%1"`, `"${executable}" %1`, `"${executable}" "%1" --extra`]) {
    assert.throws(() => verifyWindowsIntegration({
      ...windowsIntegrationFixture(destination), command,
    }, destination), /Markdown open command/);
  }
});

async function payloadFixture(t, { platform = process.platform === 'win32' ? 'windows' : 'macos', arch = 'arm64', asarFont = false } = {}) {
  const asar = require('@electron/asar');
  const f = fixture(t);
  const app = path.join(f.root, platform === 'macos' ? 'Folio.app' : 'application');
  const resources = path.join(app, platform === 'macos' ? 'Contents/Resources' : 'resources');
  const executable = path.join(app, platform === 'macos' ? 'Contents/MacOS/Folio' :
    platform === 'windows' ? 'Folio.exe' : 'folio');
  write(path.dirname(executable), path.basename(executable), binary(platform, arch));
  fs.chmodSync(executable, 0o755);
  fs.mkdirSync(resources, { recursive: true });
  fs.copyFileSync(path.join(f.root, 'docs/user/README.md'), path.join(resources, 'README.md'));
  fs.copyFileSync(path.join(f.root, 'LICENSE'), path.join(resources, 'LICENSE'));
  for (const file of themeFiles) {
    write(resources, `themes/${file}`, fs.readFileSync(path.join(f.root, 'themes', file)));
  }
  write(resources, platform === 'windows' ? 'document.ico' : 'document.icns', 'Document icon');
  const content = path.join(f.root, 'asar-input');
  write(content, 'package.json', JSON.stringify({ name: 'folio', version: '1.0.0' }));
  for (const file of ['src/main.js', 'src/preload.js', 'src/menu.js', 'src/renderer/index.html',
    'src/renderer/bundle.js', 'src/renderer/katex/katex.min.css', 'src/renderer/katex/fonts/fixture.woff2',
    'samples/welcome.md', 'samples/formatting-tour.md', 'build/icons/icon.png', 'build/icons/icon.ico',
    'node_modules/fixture/LICENSE']) write(content, file, 'Fixture content');
  write(content, 'src/renderer/katex/katex.min.css', '@font-face { src: url(fonts/fixture.woff2) format("woff2"); }');
  if (asarFont) write(content, 'themes/word/fonts/nested/Aptos.ttf', 'Not a real font');
  await asar.createPackage(content, path.join(resources, 'app.asar'));
  return { ...f, platform, app, resources, executable, metadata: readMetadata(f.root) };
}

test('verifier inspects complete payload bytes and target architecture, not filenames alone', async (t) => {
  const { inspectPayload } = require('../scripts/verify-packages');
  // NTFS cannot model POSIX executable bits; Linux/macOS CI exercise those payloads natively.
  const platforms = process.platform === 'win32' ? ['windows'] : ['windows', 'linux', 'macos'];
  for (const platform of platforms) {
    const f = await payloadFixture(t, { platform });
    const result = inspectPayload(f.app, f.metadata, platform, 'arm64');
    assert.equal(result.executable, f.executable);
    assert.throws(() => inspectPayload(f.app, f.metadata, platform, 'x64'), /architecture|x64/i);
    fs.writeFileSync(path.join(f.resources, 'README.md'), 'Changed guide');
    assert.throws(() => inspectPayload(f.app, f.metadata, platform, 'arm64'), /guide|README/i);
  }
});

test('verifier rejects missing assets and restricted fonts in either packaged theme copy', async (t) => {
  const { inspectPayload } = require('../scripts/verify-packages');
  const restricted = await payloadFixture(t, { asarFont: true });
  assert.throws(() => inspectPayload(restricted.app, restricted.metadata, restricted.platform, 'arm64'), /font|ttf/i);
  const f = await payloadFixture(t);
  write(f.resources, 'themes/word/fonts/nested/Aptos.ttf', 'Not a real font');
  assert.throws(() => inspectPayload(f.app, f.metadata, f.platform, 'arm64'), /font|ttf/i);
  fs.unlinkSync(path.join(f.resources, 'themes/word/fonts/nested/Aptos.ttf'));
  fs.unlinkSync(path.join(f.resources, 'themes/word/word.css'));
  assert.throws(() => inspectPayload(f.app, f.metadata, f.platform, 'arm64'), /word\.css/);
});

test('verifier rejects POSIX payloads without executable permissions', {
  skip: process.platform === 'win32' ? 'Windows cannot represent POSIX executable permission bits.' : false,
}, async (t) => {
  const { inspectPayload } = require('../scripts/verify-packages');
  for (const platform of ['linux', 'macos']) {
    const f = await payloadFixture(t, { platform });
    fs.chmodSync(f.executable, 0o644);
    assert.throws(() => inspectPayload(f.app, f.metadata, platform, 'arm64'), /executable permissions/);
  }
});

test('verifier stages exactly one valid pair and does not destroy prior output on an invalid pair', (t) => {
  const { stagePackages } = require('../scripts/verify-packages');
  const f = fixture(t);
  const names = packageNames('1.0.0', 'macos', 'arm64');
  const files = names.map((name) => write(f.root, `release/${name}`, 'Valid package fixture'));
  const destination = path.join(f.root, 'release/artifacts/macos-arm64');
  stagePackages(files, destination);
  assert.deepEqual(fs.readdirSync(destination).sort(), names.sort());
  assert.throws(() => stagePackages([files[0], path.join(f.root, 'missing.dmg')], destination), /missing|ENOENT|pair|file/i);
  assert.deepEqual(fs.readdirSync(destination).sort(), names.sort());
  assert.throws(() => stagePackages([files[0]], destination), /two|pair/i);
  assert.throws(() => stagePackages(files, f.root), /staging|target|artifacts/i);
});

test('verifier stages the native x64 archive with its x86_64-named AppImage', (t) => {
  const { stagePackages } = require('../scripts/verify-packages');
  const f = fixture(t);
  const names = ['Folio-1.0.0-linux-x64.tar.gz', 'Folio-1.0.0-linux-x86_64.AppImage'];
  const files = names.map((name) => write(f.root, `release/${name}`, 'Valid package fixture'));
  const destination = path.join(f.root, 'release/artifacts/linux-x64');
  stagePackages(files, destination);
  assert.deepEqual(fs.readdirSync(destination).sort(), names.sort());
});

test('builder configuration preserves all formats and source-derived filename conventions', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  assert.equal(pkg.build.win.target, 'zip');
  assert.deepEqual(pkg.build.mac.target, ['dmg', 'tar.gz']);
  assert.deepEqual(pkg.build.linux.target, ['AppImage', 'tar.gz', 'deb']);
  for (const [platform, key, extension, index] of [
    ['windows', 'win', 'zip', 0], ['linux', 'linux', 'tar.gz', 0], ['linux', 'linux', 'AppImage', 1],
    ['macos', 'mac', 'tar.gz', 0], ['macos', 'mac', 'dmg', 1],
  ]) {
    for (const arch of ['x64', 'arm64']) {
      const expandedArch = extension === 'AppImage' && arch === 'x64' ? 'x86_64' : arch;
      const name = pkg.build[key].artifactName.replace('${productName}', 'Folio')
        .replace('${version}', '1.1.0').replace('${arch}', expandedArch).replace('${ext}', extension);
      assert.equal(name, packageNames('1.1.0', platform, arch)[index]);
    }
  }
  const iss = fs.readFileSync(path.join(source, 'build/windows/folio.iss'), 'utf8');
  for (const ext of pkg.build.win.fileAssociations[0].ext) {
    assert.ok(iss.includes(`Software\\Classes\\.${ext}\\OpenWithProgids`));
  }
  assert.match(iss, /PrivilegesRequired=lowest/);
  assert.match(iss, /CloseApplications=no/);
  assert.doesNotMatch(iss, /CloseApplications=force|Subkey:.*\\UserChoice/);
});

test('CI compiler provisioning delegates to the same engine checker as local builds', () => {
  const provisioning = fs.readFileSync(path.join(source, '.github/scripts/setup-inno.ps1'), 'utf8');
  assert.match(provisioning, /scripts\/build-inno-installer\.js/);
  assert.match(provisioning, /& node \$checker --check-compiler \$compiler/);
  assert.doesNotMatch(provisioning, /VersionInfo\.FileVersion/);
  assert.match(provisioning, /Get-FileHash -LiteralPath \$download -Algorithm SHA256/);
  assert.match(provisioning, /Get-AuthenticodeSignature -LiteralPath \$download/);
});
