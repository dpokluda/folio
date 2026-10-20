const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const ROOT = path.resolve(__dirname, '..');
const ARCHITECTURES = ['x64', 'arm64'];
const FORMATS = {
  windows: ['.zip', '-setup.exe'],
  linux: ['.tar.gz', '.AppImage'],
  macos: ['.tar.gz', '.dmg'],
};
const SOURCE_ASSETS = [
  'docs/user/README.md', 'LICENSE',
  'src/main.js', 'src/preload.js', 'src/menu.js', 'src/renderer/index.html',
  'samples/welcome.md', 'samples/formatting-tour.md', 'themes/base.css',
  'build/icons/icon.png', 'build/icons/icon.ico', 'build/icons/icon.icns',
  'build/icons/document.ico', 'build/icons/document.icns',
];

function parseVersion(version) {
  if (typeof version !== 'string' ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) ||
      !semver.valid(version)) {
    throw new Error(`Invalid product SemVer: ${JSON.stringify(version)}.`);
  }
  const parsed = semver.parse(version);
  if ([parsed.major, parsed.minor, parsed.patch].some((part) => part > 65535)) {
    throw new Error(`Product version ${version} cannot be represented in Windows file-version fields.`);
  }
  return parsed;
}

function requireFile(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Required packaging file is missing or empty: ${file}`);
  }
}

/** Read and validate source metadata without changing the product or its guide. */
function readMetadata(root = ROOT) {
  root = path.resolve(root);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const parsed = parseVersion(pkg.version);
  if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('Lockfile product versions must match package.json.version (not lockfileVersion).');
  }
  if (pkg.name !== 'folio' || pkg.build?.productName !== 'Folio' ||
      pkg.build?.appId !== 'com.dpokluda.folio') {
    throw new Error('Packaging must preserve identity: folio / Folio / com.dpokluda.folio.');
  }
  const electronVersion = lock.packages?.['node_modules/electron']?.version;
  const electronRange = pkg.devDependencies?.electron;
  if (typeof electronVersion !== 'string' || !semver.valid(electronVersion) ||
      typeof electronRange !== 'string' || !semver.satisfies(electronVersion, electronRange)) {
    throw new Error('Locked Electron runtime version must satisfy the declared development dependency.');
  }
  const output = pkg.build.directories?.output;
  if (typeof output !== 'string' || output.length === 0) {
    throw new Error('A packaging output directory must be declared in package.json.');
  }
  for (const file of SOURCE_ASSETS) requireFile(path.join(root, file));
  for (const platform of Object.keys(FORMATS)) {
    for (const arch of ARCHITECTURES) packageNames(pkg.version, platform, arch);
  }
  return Object.freeze({
    root, name: pkg.name, productName: pkg.build.productName, appId: pkg.build.appId,
    version: pkg.version, electronVersion,
    windowsVersion: `${parsed.major}.${parsed.minor}.${parsed.patch}.0`,
    guidePath: path.join(root, 'docs/user/README.md'),
    licensePath: path.join(root, 'LICENSE'),
    outputDir: path.resolve(root, output),
  });
}

/** Return the two package filenames for one native target and declared version. */
function packageNames(version, platform, arch) {
  parseVersion(version);
  if (!Object.hasOwn(FORMATS, platform) || !ARCHITECTURES.includes(arch)) {
    throw new Error(`Unsupported package target: ${platform}-${arch}.`);
  }
  return FORMATS[platform].map((suffix) => {
    const artifactArch = platform === 'linux' && suffix === '.AppImage' && arch === 'x64' ? 'x86_64' : arch;
    const name = `Folio-${version}-${platform}-${artifactArch}${suffix}`;
    if (name.length > 255) throw new Error(`Package filename exceeds the supported length: ${name}`);
    return name;
  });
}

/** Inspect the native application header, not a potentially different installer bootstrap. */
function readArchitecture(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(64);
    const size = fs.fstatSync(descriptor).size;
    if (fs.readSync(descriptor, header, 0, header.length, 0) !== header.length) {
      throw new Error(`Truncated native binary header: ${file}`);
    }
    let machine;
    if (header.toString('ascii', 0, 2) === 'MZ') {
      const offset = header.readUInt32LE(0x3c);
      const coff = Buffer.alloc(6);
      if (offset < 64 || offset + coff.length > size ||
          fs.readSync(descriptor, coff, 0, coff.length, offset) !== coff.length ||
          coff.readUInt32LE(0) !== 0x00004550) {
        throw new Error(`Invalid PE binary header: ${file}`);
      }
      machine = { 0x8664: 'x64', 0xaa64: 'arm64' }[coff.readUInt16LE(4)];
    } else if (header.readUInt32BE(0) === 0x7f454c46 && header[4] === 2) {
      if (header[5] !== 1 && header[5] !== 2) throw new Error(`Invalid ELF byte order: ${file}`);
      const cpu = header[5] === 1 ? header.readUInt16LE(18) : header.readUInt16BE(18);
      machine = { 62: 'x64', 183: 'arm64' }[cpu];
    } else if (header.readUInt32LE(0) === 0xfeedfacf) {
      machine = { 0x01000007: 'x64', 0x0100000c: 'arm64' }[header.readUInt32LE(4)];
    } else if (header.readUInt32BE(0) === 0xfeedfacf) {
      machine = { 0x01000007: 'x64', 0x0100000c: 'arm64' }[header.readUInt32BE(4)];
    }
    if (!machine) throw new Error(`Unsupported native binary format or architecture: ${file}`);
    return machine;
  } finally {
    fs.closeSync(descriptor);
  }
}

module.exports = { ROOT, readMetadata, packageNames, readArchitecture };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--version')) {
      throw new Error('Usage: node scripts/package-metadata.js [--version]');
    }
    const { name, productName, appId, version, electronVersion, windowsVersion } = readMetadata();
    console.log(args[0] === '--version' ? version :
      JSON.stringify({ name, productName, appId, version, electronVersion, windowsVersion }, null, 2));
  } catch (error) {
    console.error(`[package-metadata] ${error.message}`);
    process.exitCode = 1;
  }
}
