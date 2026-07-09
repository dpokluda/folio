// Tiny JSON-file settings store in Electron's userData dir.
// Avoids an extra native/ESM dependency (electron-store is ESM-only in v9+).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  theme: 'fluent.css',
  recentFiles: [],
  window: { width: 1100, height: 820 },
  sourceMode: false,
  outlineVisible: false,
  zoom: 0,
};

const MAX_RECENT = 10;

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'folio-settings.json');
    this.data = { ...DEFAULTS };
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data = { ...DEFAULTS, ...parsed };
        this.data.window = { ...DEFAULTS.window, ...(parsed.window || {}) };
      }
    } catch (err) {
      console.error('[folio] failed to read settings, using defaults:', err);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this._flush();
  }

  addRecent(filePath) {
    if (!filePath) return;
    const list = (this.data.recentFiles || []).filter((p) => p !== filePath);
    list.unshift(filePath);
    this.data.recentFiles = list.slice(0, MAX_RECENT);
    this._flush();
  }

  clearRecent() {
    this.data.recentFiles = [];
    this._flush();
  }

  _flush() {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[folio] failed to persist settings:', err);
    }
  }
}

module.exports = { Store };
