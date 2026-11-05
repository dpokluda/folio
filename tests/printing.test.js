const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { buildMenu } = require('../src/menu');

const root = path.resolve(__dirname, '..');

async function probeOutput(directory) {
  const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
  const url = (file) => pathToFileURL(path.join(root, file)).href;
  const image = path.join(directory, 'image.svg');
  fs.writeFileSync(image, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="green"/></svg>');
  const markdown = [
    '# PRINT_START', '',
    'A **rendered** document with a [link](https://example.com) and $x^2$.', '',
    '![Local image](image.svg)', '',
    '- [x] Checked task', '- [ ] Open task', '',
    '```mermaid', 'flowchart LR', '  Start --> Finish', '```', '',
    ...Array.from({ length: 70 }, (_, i) => `Paragraph ${i}: ${'Complete document content. '.repeat(12)}\n`),
    '```text', ...Array.from({ length: 110 }, (_, i) => `Code line ${i}`), '```', '',
    '## PRINT_END', '',
  ].join('\n');
  let window;
  let latestState;
  let dirty = false;
  let nextId = 1;
  const pending = new Map();
  const request = (kind) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error(`Request timed out: ${kind}`)), 20000);
    pending.set(id, { resolve, reject, timer });
    window.webContents.send('folio-request', { id, kind });
  });
  ipcMain.on('folio-response', (_event, { id, value, error }) => {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    if (error) entry.reject(new Error(error));
    else entry.resolve(value);
  });
  ipcMain.on('state-changed', (_event, value) => { latestState = value; });
  ipcMain.on('dirty-changed', (_event, value) => { dirty = value; });
  ipcMain.handle('get-init', () => ({
    themesBaseUrl: url('themes') + '/',
    themeFiles: ['base.css', 'fluent/a4.css'],
    settings: { sourceMode: true, zoom: 5, outlineVisible: true, lineNumbers: true },
    document: { path: path.join(directory, 'document.md'), baseUrl: pathToFileURL(path.join(directory, 'document.md')).href, content: markdown },
  }));

  try {
    await app.whenReady();
    nativeTheme.themeSource = 'light';
    window = new BrowserWindow({ show: false, width: 720, height: 600,
      webPreferences: { preload: path.join(root, 'src', 'preload.js'), backgroundThrottling: false } });
    const initialized = new Promise((resolve) => ipcMain.once('state-changed', resolve));
    await window.loadFile(path.join(root, 'src', 'renderer', 'index.html'));
    await initialized;
    await request('content');
    await window.webContents.executeJavaScript("document.querySelector('.cm-content').focus()");
    window.webContents.insertText('UNSAVED_EDIT\n');
    const text = await request('content');
    assert.ok(text.includes('UNSAVED_EDIT'));
    assert.equal(dirty, true);
    const editorState = () => window.webContents.executeJavaScript(`(() => {
      const selection = getSelection();
      return { focus: document.activeElement.className, anchor: selection.anchorOffset,
        extent: selection.focusOffset, zoom: document.getElementById('folio-root').style.zoom };
    })()`);
    const before = await editorState();

    const results = [];
    for (const family of ['fluent', 'github', 'word']) {
      for (const width of ['dynamic', 'a4', 'us-letter']) {
        const files = ['base.css', ...(family === 'fluent' ? [] : [`${family}/${family}.css`]), `${family}/${width}.css`];
        window.webContents.send('set-theme', { files });
        const html = await request('prepare-export');
        assert.equal(typeof html, 'string', 'Export must return a document-only HTML snapshot, not permission to print the app');
        assert.equal(latestState.sourceMode, true, 'Export must not change the editor mode');
        assert.equal(await request('content'), text, 'Export must preserve unsaved edits');
        assert.equal(dirty, true);
        assert.deepEqual(await editorState(), before, 'Export must preserve selection, focus, and display zoom');
        const { withPrintDocument, pdfOptions } = require('../src/printing');
        const result = await withPrintDocument(window, html, async (output) => {
          output.webContents.debugger.attach('1.3');
          await output.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
          const layout = await output.webContents.executeJavaScript(`(() => {
            const write = document.getElementById('write');
            const rect = write.getBoundingClientRect();
            return {
              text: write.textContent,
              chrome: !!document.querySelector('#folio-root, #folio-statusbar, #folio-outline, #typora-source, .folio-copy'),
              overflow: getComputedStyle(document.body).overflow,
              background: getComputedStyle(document.body).backgroundColor,
              padding: getComputedStyle(write).padding,
              shadow: getComputedStyle(write).boxShadow,
              width: rect.width,
              viewport: innerWidth,
              images: [...document.images].map(image => image.complete && image.naturalWidth > 0),
              diagrams: document.querySelectorAll('.folio-mermaid > svg').length,
              math: document.querySelectorAll('.katex').length,
              code: write.querySelector('pre.md-fences').textContent,
            };
          })()`);
          const pdf = await output.webContents.printToPDF(pdfOptions(width === 'us-letter' ? 'Letter' : 'A4'));
          fs.writeFileSync(path.join(directory, `${family}-${width}.pdf`), pdf);
          return { ...layout, pages: (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length };
        });
        assert.equal(result.chrome, false);
        assert.ok(result.text.includes('PRINT_START') && result.text.includes('PRINT_END') && result.text.includes('UNSAVED_EDIT'));
        assert.equal(result.overflow, 'visible');
        assert.equal(result.background, 'rgba(0, 0, 0, 0)', 'Output must not include the app backdrop');
        assert.equal(result.padding, '0px');
        assert.equal(result.shadow, 'none');
        assert.ok(result.width <= result.viewport, `${family}/${width}: content exceeds the page width`);
        assert.deepEqual(result.images, [true]);
        assert.equal(result.diagrams, 1);
        assert.equal(result.math, 1);
        assert.ok(result.code.includes('Code line 109'));
        assert.ok(result.pages > 2, `${family}/${width}: expected a multipage document`);
        results.push({ family, width, pages: result.pages });
      }
    }

    const sourceHTML = await request('prepare-print');
    assert.equal(typeof sourceHTML, 'string', 'Print must prepare the current source view');
    assert.match(sourceHTML, /id="folio-print-source"/);
    const { withPrintDocument, pdfOptions } = require('../src/printing');
    await withPrintDocument(window, sourceHTML, async (output) => {
      const source = await output.webContents.executeJavaScript("document.getElementById('folio-print-source').textContent");
      assert.equal(source, text, 'Source printing must include the full editor text, not only the virtualized viewport');
      const pdf = await output.webContents.printToPDF(pdfOptions('A4'));
      fs.writeFileSync(path.join(directory, 'source.pdf'), pdf);
      assert.ok((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length > 2);
    });
    assert.equal(latestState.sourceMode, true);
    window.webContents.send('command', { name: 'toggle-source' });
    await request('content');
    await request('prepare-export');
    assert.equal(latestState.sourceMode, false);
    const previewHTML = await request('prepare-print');
    assert.match(previewHTML, /id="write"/, 'The same Print request must prepare rendered content in preview mode');
    assert.doesNotMatch(previewHTML, /id="folio-print-source"/);
    assert.equal(latestState.sourceMode, false);

    const selectionBefore = await window.webContents.executeJavaScript(`(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#write h1'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      return getSelection().toString();
    })()`);
    await request('prepare-print');
    assert.equal(await window.webContents.executeJavaScript('getSelection().toString()'), selectionBefore);

    nativeTheme.themeSource = 'dark';
    window.webContents.send('appearance-changed');
    const darkHTML = await request('prepare-export');
    await withPrintDocument(window, darkHTML, async (output) => {
      const colors = await output.webContents.executeJavaScript(`(() => {
        const style = getComputedStyle(document.getElementById('write'));
        return [style.color, style.backgroundColor];
      })()`);
      assert.notEqual(colors[0], colors[1], 'Dark document text must remain visible on its themed background');
    });
    window.webContents.send('command', { name: 'toggle-source' });
    await request('content');
    const sourceAgainHTML = await request('prepare-print');
    await withPrintDocument(window, sourceAgainHTML, async (output) => {
      assert.equal(await output.webContents.executeJavaScript("document.getElementById('folio-print-source').textContent"), text,
        'Printing must use the current source view again rather than a cached preview choice');
      const colors = await output.webContents.executeJavaScript(`(() => {
        const style = getComputedStyle(document.getElementById('folio-print-source'));
        return [style.color, style.backgroundColor];
      })()`);
      assert.deepEqual(colors, ['rgb(0, 0, 0)', 'rgb(255, 255, 255)']);
    });
    assert.equal(latestState.sourceMode, true);

    const { printDocument } = require('../src/printing');
    for (const [success, reason, expected] of [
      [true, '', true], [false, 'Print job canceled', false], [false, 'Printer unavailable', null],
    ]) {
      const contents = new EventEmitter();
      contents.print = (options, callback) => {
        assert.equal(options.silent, false, 'Printing must show the native settings dialog');
        assert.equal(options.pageSize, 'Letter');
        assert.equal(options.printBackground, true);
        setImmediate(() => callback(success, reason));
      };
      if (expected === null) await assert.rejects(printDocument(contents, 'Letter'), /Printer unavailable/);
      else assert.equal(await printDocument(contents, 'Letter'), expected);
      assert.equal(contents.listenerCount('destroyed'), 0);
    }
    const closed = new EventEmitter();
    closed.print = () => setImmediate(() => closed.emit('destroyed'));
    await assert.rejects(printDocument(closed, 'A4'), /closed before printing finished/);

    let temporaryFile;
    let failedWindow;
    await assert.rejects(withPrintDocument(window, sourceHTML, async (output) => {
      failedWindow = output;
      temporaryFile = require('node:url').fileURLToPath(output.webContents.getURL());
      throw new Error('Output failed');
    }), /Output failed/);
    assert.equal(failedWindow.isDestroyed(), true);
    assert.equal(fs.existsSync(path.dirname(temporaryFile)), false, 'Failed output must remove its temporary document');
    await assert.rejects(withPrintDocument(window, sourceHTML.replace('print.css', 'missing-print.css'), () => {
      throw new Error('Output must not begin with a missing stylesheet');
    }), /Cannot load print stylesheet/);
    process.stdout.write(JSON.stringify(results));
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    app.quit();
  }
}

if (process.versions.electron) {
  probeOutput(process.argv[2]).catch((error) => {
    console.error(error);
    require('electron').app.exit(1);
  });
} else {
  test('File menu has one current-view Print action with the standard shortcut', () => {
    const calls = [];
    const menu = buildMenu({ actions: { print: () => calls.push('print') } });
    const file = menu.find(item => item.label === 'File').submenu;
    const print = file.find(item => item.label === 'Print…');
    assert.ok(print);
    assert.equal(file.filter(item => item.label?.startsWith('Print')).length, 1);
    assert.equal(file.find(item => item.label === 'Print Source…'), undefined);
    assert.equal(print.accelerator, 'CmdOrCtrl+P');
    print.click();
    assert.deepEqual(calls, ['print']);
  });

  test('PDF export and current-view printing contain the full document and preserve editing state', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-print-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(require('electron'), [__filename, directory], { env, encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, [result.error?.message, result.stderr].filter(Boolean).join('\n'));
    assert.equal(JSON.parse(result.stdout).length, 9);
  });
}
