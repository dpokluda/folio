const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { createGunzip, createGzip } = require('node:zlib');
const { ROOT, readMetadata, packageNames } = require('./package-metadata');

/** Add the authored guide beside the signed app in a completed macOS tarball, leaving other targets untouched. */
async function addMacArchiveReadme(event, options = {}) {
  if (event.target?.name !== 'tar.gz' || event.packager?.platform?.nodeName !== 'darwin') return;
  if ((options.platform || process.platform) !== 'darwin') {
    throw new Error('Adding the macOS archive guide requires native macOS tar.');
  }
  const metadata = readMetadata(options.root || ROOT);
  const archive = path.resolve(event.file);
  if (!['x64', 'arm64'].some((arch) => path.basename(archive) === packageNames(metadata.version, 'macos', arch)[0])) {
    throw new Error(`Unexpected macOS archive filename: ${archive}`);
  }
  const run = options.run || execFileSync;
  const commandOptions = {
    encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  };
  const temporary = fs.mkdtempSync(path.join(path.dirname(archive), '.mac-readme-'));
  let primaryError;
  try {
    const tar = path.join(temporary, 'application.tar');
    await pipeline(fs.createReadStream(archive), createGunzip(), fs.createWriteStream(tar));
    const entries = run('/usr/bin/tar', ['-tf', tar], commandOptions).trim().split(/\r?\n/).filter(Boolean)
      .map((entry) => entry.replace(/^\.\//, ''));
    if (!entries.includes('Folio.app/') ||
        entries.some((entry) => entry !== 'README.md' && !entry.startsWith('Folio.app/'))) {
      throw new Error('The macOS archive must contain only Folio.app and its optional root README.md.');
    }
    const readmes = entries.filter((entry) => entry === 'README.md');
    if (readmes.length > 1) throw new Error('The macOS archive contains duplicate root README.md entries.');
    if (readmes.length === 1) {
      const existing = run('/usr/bin/tar', ['-xOf', tar, 'README.md'], { ...commandOptions, encoding: null });
      if (!existing.equals(fs.readFileSync(metadata.guidePath))) {
        throw new Error('The macOS archive already contains a root README.md that differs from the authored guide.');
      }
      return;
    }
    // Append without extracting or rewriting signed app files, framework symlinks, or executable modes.
    run('/usr/bin/tar', ['--uid', '0', '--gid', '0', '--uname', 'root', '--gname', 'root',
      '-rf', tar, '-C', path.dirname(metadata.guidePath), 'README.md'], commandOptions);
    const updated = path.join(temporary, path.basename(archive));
    await pipeline(fs.createReadStream(tar), createGzip({ level: 9 }), fs.createWriteStream(updated));
    fs.renameSync(updated, archive);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      fs.rmSync(temporary, { recursive: true, force: true });
    } catch (error) {
      if (primaryError) throw new AggregateError([primaryError, error], 'macOS archive guide packaging and cleanup failed.');
      throw error;
    }
  }
}

module.exports = addMacArchiveReadme;
