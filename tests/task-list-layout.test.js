const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const MarkdownIt = require('markdown-it');
const taskLists = require('markdown-it-task-lists');

const root = path.resolve(__dirname, '..');
const markdown = new MarkdownIt().use(taskLists, { enabled: true });
const content = markdown.render([
  '# Tight task list',
  '',
  '- [ ] Plain text',
  '- [x] Checked **bold** text',
  '- [ ] Parent task',
  '  - [ ] Nested task',
  '- [ ] ' + 'A long task that wraps onto several lines without moving its checkbox away from the first line. '.repeat(3),
  '',
  '# Loose task list',
  '',
  '- [ ] First paragraph',
  '',
  '  Second paragraph stays below the first.',
  '',
  '- [x] Another loose task',
  '',
].join('\n'));

async function measureLayout(fixture) {
  const { app, BrowserWindow, nativeTheme } = require('electron');
  const url = (file) => pathToFileURL(path.join(root, file)).href;
  let window;

  try {
    fs.writeFileSync(fixture, `<!doctype html><html><head>
      <link rel="stylesheet" href="${url(path.join('src', 'renderer', 'app.css'))}">
      <link rel="stylesheet" href="${url(path.join('themes', 'base.css'))}">
      <link id="family" rel="stylesheet">
      <link id="width" rel="stylesheet">
      </head><body><div id="folio-root"><main id="folio-main"><div id="folio-content">
      <div id="folio-preview"><div id="write">${content}</div></div>
      </div></main></div></body></html>`);

    await app.whenReady();
    nativeTheme.themeSource = 'light';
    window = new BrowserWindow({ show: false, width: 800, height: 900,
      webPreferences: { sandbox: true, backgroundThrottling: false } });
    await window.loadFile(fixture);
    window.webContents.debugger.attach('1.3');
    const results = [];

    for (const family of ['fluent', 'github', 'word']) {
      for (const width of ['dynamic', 'a4', 'us-letter']) {
        const styles = {
          family: family === 'fluent' ? null : url(path.join('themes', family, `${family}.css`)),
          width: url(path.join('themes', family, `${width}.css`)),
        };
        await window.webContents.executeJavaScript(`Promise.all(
          Object.entries(${JSON.stringify(styles)}).map(([id, href]) => new Promise((resolve, reject) => {
            const link = document.getElementById(id);
            if (!href) { link.removeAttribute('href'); resolve(); return; }
            if (link.getAttribute('href') === href) { resolve(); return; }
            link.onload = resolve;
            link.onerror = () => reject(new Error('Cannot load stylesheet: ' + href));
            link.href = href;
          }))
        )`);

        for (const media of ['screen', 'print']) {
          await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media });
          for (const zoom of [1, 1.5]) {
            const items = await window.webContents.executeJavaScript(`(async () => {
              document.getElementById('folio-root').style.zoom = ${zoom};
              await document.fonts.ready;
              return [...document.querySelectorAll('.task-list-item-checkbox')].map(input => {
                const range = document.createRange();
                range.selectNodeContents(input.nextSibling);
                const lines = [...range.getClientRects()];
                const text = lines[0];
                const box = input.getBoundingClientRect();
                return {
                  text: input.parentElement.textContent.trim().slice(0, 50),
                  offset: (box.top + box.bottom - text.top - text.bottom) / 2,
                  width: box.width,
                  height: box.height,
                  lines: lines.length,
                  background: getComputedStyle(input).backgroundImage,
                  checked: input.checked,
                };
              });
            })()`);
            results.push({ family, width, media, zoom, items });
          }
        }
      }
    }
    process.stdout.write(JSON.stringify(results));
  } finally {
    if (window) window.destroy();
    fs.rmSync(fixture, { force: true });
    app.quit();
  }
}

if (process.versions.electron) {
  measureLayout(process.argv[2]).catch((error) => {
    console.error(error);
    require('electron').app.exit(1);
  });
} else {
  test('task checkboxes stay centered on the first text line across themes, zoom and print', (t) => {
    const fixture = path.join(os.tmpdir(), `folio-task-list-${process.pid}.html`);
    t.after(() => fs.rmSync(fixture, { force: true }));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(require('electron'), [__filename, fixture], { env, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, [result.error?.message, result.stderr].filter(Boolean).join('\n'));
    const layouts = JSON.parse(result.stdout);
    assert.equal(layouts.length, 36);

    for (const { family, width, media, zoom, items } of layouts) {
      const context = `${family}/${width}, ${media}, zoom ${zoom}`;
      assert.equal(items.length, 7, context);
      assert.ok(items.some(item => item.lines > 1), `Expected wrapped text: ${context}`);
      assert.notEqual(items.find(item => item.checked).background, items.find(item => !item.checked).background, context);
      for (const item of items) {
        assert.ok(Math.abs(item.offset) <= 3 * zoom,
          `${context}, "${item.text}": checkbox center is ${item.offset.toFixed(2)}px from the first text line`);
        assert.equal(item.width, 24 * zoom, context);
        assert.equal(item.height, 24 * zoom, context);
      }
    }
  });
}
