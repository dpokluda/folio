// Bridges the isolated preload world to the renderer (main world) over IPC.
const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel, cb) => {
  ipcRenderer.on(channel, (_event, payload) => cb(payload));
};

contextBridge.exposeInMainWorld('folioAPI', {
  // main -> renderer events
  onCommand: (cb) => listen('command', cb),
  onLoadDocument: (cb) => listen('load-document', cb),
  onOpenFolder: (cb) => listen('open-folder', cb),
  onSetTheme: (cb) => listen('set-theme', cb),
  onSaved: (cb) => listen('saved', cb),
  onDocumentPathChanged: (cb) => listen('document-path-changed', cb),

  // main -> renderer request/response. The renderer registers a single handler;
  // for each incoming { id, kind } it returns a value (sync or Promise) that is
  // sent back to main on the paired response channel, keyed by the same id.
  onRequest: (handler) => {
    ipcRenderer.on('folio-request', async (_event, { id, kind }) => {
      let value = null;
      try {
        value = await handler(kind);
      } catch (_) {
        value = null;
      }
      ipcRenderer.send('folio-response', { id, value });
    });
  },

  // renderer -> main
  getInit: () => ipcRenderer.invoke('get-init'),
  navigate: (payload) => ipcRenderer.invoke('navigate', payload),
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  setDirty: (value) => ipcRenderer.send('dirty-changed', value),
  setState: (state) => ipcRenderer.send('state-changed', state),
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
