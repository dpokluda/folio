// Owns the temporary, document-only window shared by PDF export and printing.
const { BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function withPrintDocument(parent, html, output) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-print-'));
  let window;
  let timer;
  try {
    const file = path.join(directory, 'document.html');
    fs.writeFileSync(file, html, 'utf8');
    window = new BrowserWindow({
      parent,
      show: false,
      width: 800,
      height: 1000,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());

    await Promise.race([
      (async () => {
        await window.loadFile(file);
        // This isolated page has no application bridge or scripts. Wait for its
        // actual assets and font layout before Chromium paginates the document.
        await window.webContents.executeJavaScript(`(async () => {
          // A failed stylesheet can still expose an empty CSSStyleSheet.
          // Reload the cached links with explicit load/error listeners.
          await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
            new Promise((resolve, reject) => {
              const loaded = link.cloneNode();
              loaded.onload = resolve;
              loaded.onerror = () => reject(new Error('Cannot load print stylesheet: ' + link.href));
              link.replaceWith(loaded);
            })
          ));
          await document.fonts.ready;
          await Promise.all([...document.images].map(async image => {
            await image.decode();
          }));
        })()`);
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out loading the document for printing.')), 20000);
      }),
    ]);
    clearTimeout(timer);
    return await output(window);
  } finally {
    clearTimeout(timer);
    if (window && !window.isDestroyed()) window.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function pdfOptions(pageSize) {
  return {
    pageSize,
    printBackground: true,
    margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 },
  };
}

// Native printing completes through a callback, not a Promise. Keep the
// document window alive until submission, cancellation, or failure.
function printDocument(webContents, pageSize) {
  return new Promise((resolve, reject) => {
    const destroyed = () => reject(new Error('The document window closed before printing finished.'));
    webContents.once('destroyed', destroyed);
    try {
      webContents.print({ silent: false, printBackground: true, pageSize, margins: { marginType: 'default' } },
        (success, reason) => {
          webContents.removeListener('destroyed', destroyed);
          if (success) resolve(true);
          else if (reason === 'Print job canceled') resolve(false);
          else reject(new Error(reason || 'The printer could not print the document.'));
        });
    } catch (error) {
      webContents.removeListener('destroyed', destroyed);
      reject(error);
    }
  });
}

module.exports = { withPrintDocument, pdfOptions, printDocument };
