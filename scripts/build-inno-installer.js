const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { ROOT, readMetadata, packageNames, readArchitecture } = require('./package-metadata');

const INNO_VERSION = '6.7.3';

function failure(command, result) {
  if (result.error) return new Error(`Cannot launch ${command}: ${result.error.message}`, { cause: result.error });
  return new Error(`${command} failed with exit code ${result.status} ${result.signal || ''}: ${result.stderr || ''}`);
}

function resolveCompiler(env, run) {
  const candidates = env.ISCC_PATH ? [env.ISCC_PATH] : [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Inno Setup 6', 'ISCC.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Inno Setup 6', 'ISCC.exe'),
  ].filter(Boolean);
  let compiler = candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!compiler && !env.ISCC_PATH) {
    const found = run('where.exe', ['ISCC.exe'], { encoding: 'utf8', windowsHide: true });
    if (found.status === 0) compiler = found.stdout.trim().split(/\r?\n/)[0];
  }
  if (!compiler) {
    throw new Error(`Inno Setup ${INNO_VERSION} compiler not found. Install it locally or set ISCC_PATH to ISCC.exe.`);
  }
  compiler = path.resolve(compiler);
  const result = run('pwsh', ['-NoProfile', '-NonInteractive', '-Command',
    '(Get-Item -LiteralPath $env:FOLIO_ISCC_PATH).VersionInfo.FileVersion'], {
    encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...env, FOLIO_ISCC_PATH: compiler },
  });
  if (result.error || result.status !== 0) throw failure('Inno compiler version check', result);
  if (!/^6\.7\.3(?:\.0)?$/.test(result.stdout.trim())) {
    throw new Error(`Inno Setup ${INNO_VERSION} is required; ${compiler} reports ${result.stdout.trim()}.`);
  }
  return compiler;
}

async function payloadChecks(directory, relative = '') {
  const lines = [];
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Windows installer payload must not contain a symbolic link: ${name}`);
    if (entry.isDirectory()) {
      lines.push(...await payloadChecks(directory, name));
    } else if (entry.isFile()) {
      const hash = crypto.createHash('sha256');
      for await (const chunk of fs.createReadStream(path.join(directory, name))) hash.update(chunk);
      const windowsName = name.split(path.sep).join('\\').replaceAll("'", "''");
      lines.push({ file: windowsName, hash: hash.digest('hex') });
    } else {
      throw new Error(`Unsupported Windows payload entry: ${name}`);
    }
  }
  return lines;
}

/** Compile only Windows ZIP payloads reported by this completed builder invocation. */
async function buildInstallers(context, options = {}) {
  const metadata = readMetadata(options.root || ROOT);
  const output = path.resolve(context.outDir);
  const reported = new Set(context.artifactPaths.map((file) => path.resolve(file)));
  const targets = ['x64', 'arm64'].filter((arch) =>
    reported.has(path.join(output, packageNames(metadata.version, 'windows', arch)[0])));
  if (targets.length === 0) return [];
  if ((options.platform || process.platform) !== 'win32') {
    throw new Error('Inno Setup distribution builds require Windows; cross-host Inno compilation is not configured.');
  }
  const run = options.run || spawnSync;
  const env = options.env || process.env;
  for (const arch of targets) {
    const payload = path.join(output, arch === 'x64' ? 'win-unpacked' : 'win-arm64-unpacked');
    const actual = readArchitecture(path.join(payload, 'Folio.exe'));
    if (actual !== arch) throw new Error(`Windows payload architecture ${actual} does not match ${arch}.`);
  }
  const compiler = resolveCompiler(env, run);
  const script = path.join(metadata.root, 'build/windows/folio.iss');
  if (!fs.statSync(script).isFile()) throw new Error(`Inno Setup definition is missing: ${script}`);
  const produced = [];
  for (const arch of targets) {
    const payload = path.join(output, arch === 'x64' ? 'win-unpacked' : 'win-arm64-unpacked');
    const setup = path.join(output, packageNames(metadata.version, 'windows', arch)[1]);
    const temporary = fs.mkdtempSync(path.join(output, '.inno-'));
    let primaryError;
    try {
      const include = path.join(temporary, 'payload-checks.iss');
      const checks = await payloadChecks(payload);
      const locks = checks.map(({ file }) =>
        `  if not CanReplacePayloadFile('${file}') then\n  begin\n    Result := '${file}';\n    Exit;\n  end;`);
      const hashes = checks.map(({ file, hash }) => `  VerifyPayloadFile('${file}', '${hash}');`);
      fs.writeFileSync(include,
        '\ufefffunction LockedPayloadFile: String;\nbegin\n  Result := \'\';\n' + locks.join('\n') +
        '\nend;\n\nprocedure VerifyInstalledPayload;\nbegin\n' + hashes.join('\n') + '\nend;\n', 'utf8');
      fs.rmSync(setup, { force: true });
      const result = run(compiler, [
        `/DProductVersion=${metadata.version}`, `/DProductNumericVersion=${metadata.windowsVersion}`,
        `/DTargetArch=${arch}`, `/DPayloadDir=${payload}`, `/DOutputDir=${output}`, `/DPayloadChecks=${include}`,
        `/O${output}`, `/F${path.basename(setup, '.exe')}`, script,
      ], { stdio: 'inherit', windowsHide: true, timeout: 600000, env });
      if (result.error || result.status !== 0) throw failure('Inno compiler', result);
      if (!fs.existsSync(setup) || !fs.statSync(setup).isFile() || fs.statSync(setup).size === 0) {
        throw new Error(`Inno compiler did not produce the expected setup output: ${setup}`);
      }
      produced.push(setup);
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        fs.rmSync(temporary, { recursive: true, force: true });
      } catch (cleanupError) {
        if (primaryError) throw new AggregateError([primaryError, cleanupError], 'Inno compilation and temporary cleanup failed.');
        throw cleanupError;
      }
    }
  }
  return produced;
}

module.exports = buildInstallers;
