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
      assert.ok(pair.every((name) => name.startsWith(`Folio-1.1.0-${platform}-${arch}`)));
      names.push(...pair);
    }
  }
  assert.equal(new Set(names).size, 12);
  assert.deepEqual(packageNames('1.0.0', 'windows', 'arm64'),
    ['Folio-1.0.0-windows-arm64.zip', 'Folio-1.0.0-windows-arm64-setup.exe']);
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

function TestCompiler(f, { version = '6.7.3.0', status = 0, omitOutput = false } = {}) {
  const calls = [];
  const run = (command, args) => {
    calls.push({ command, args });
    if (command === 'pwsh') return { status: 0, stdout: version, stderr: '' };
    assert.equal(command, f.compiler);
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
  const args = compiler.calls.find((call) => call.command === f.compiler).args;
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
      if (command === f.compiler) {
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

async function payloadFixture(t, { platform = 'macos', arch = 'arm64', asarFont = false } = {}) {
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
  return { ...f, app, resources, executable, metadata: readMetadata(f.root) };
}

test('verifier inspects complete payload bytes and target architecture, not filenames alone', async (t) => {
  const { inspectPayload } = require('../scripts/verify-packages');
  for (const platform of ['windows', 'linux', 'macos']) {
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
  assert.throws(() => inspectPayload(restricted.app, restricted.metadata, 'macos', 'arm64'), /font|ttf/i);
  const f = await payloadFixture(t);
  write(f.resources, 'themes/word/fonts/nested/Aptos.ttf', 'Not a real font');
  assert.throws(() => inspectPayload(f.app, f.metadata, 'macos', 'arm64'), /font|ttf/i);
  fs.unlinkSync(path.join(f.resources, 'themes/word/fonts/nested/Aptos.ttf'));
  fs.unlinkSync(path.join(f.resources, 'themes/word/word.css'));
  assert.throws(() => inspectPayload(f.app, f.metadata, 'macos', 'arm64'), /word\.css/);
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

test('builder configuration preserves all formats and source-derived filename conventions', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  assert.equal(pkg.build.win.target, 'zip');
  assert.deepEqual(pkg.build.mac.target, ['dmg', 'tar.gz']);
  assert.deepEqual(pkg.build.linux.target, ['AppImage', 'tar.gz', 'deb']);
  for (const [platform, key, extension] of [['windows', 'win', 'zip'], ['linux', 'linux', 'tar.gz'], ['macos', 'mac', 'tar.gz']]) {
    for (const arch of ['x64', 'arm64']) {
      const name = pkg.build[key].artifactName.replace('${productName}', 'Folio')
        .replace('${version}', '1.1.0').replace('${arch}', arch).replace('${ext}', extension);
      assert.equal(name, packageNames('1.1.0', platform, arch)[0]);
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
