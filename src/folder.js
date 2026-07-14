// Folder-mode helpers: scanning a directory into an explorer tree, choosing a
// folder's entry document, and resolving an in-document link / explorer click
// into a concrete navigation target. Pure (fs + path + url) so it can be unit
// tested without booting Electron.
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const MD_EXTS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.markdn', '.mdtext', '.mdtxt']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.obsidian', '.vscode', '.idea']);
const MAX_TREE_DEPTH = 16;

function isMarkdownFile(p) {
  return MD_EXTS.has(path.extname(p).toLowerCase());
}

// Recursively build a tree of subfolders + markdown files under `dir`. Folders
// are included only if they (transitively) contain markdown, so the explorer
// stays focused on navigable content. Hidden entries and heavy/asset dirs are
// skipped; a depth cap guards against pathological trees / symlink loops.
function scanFolder(dir, depth = 0) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const dirs = [];
  const files = [];
  for (const ent of entries) {
    const name = ent.name;
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(name) || depth >= MAX_TREE_DEPTH) continue;
      const children = scanFolder(full, depth + 1);
      if (children.length) dirs.push({ name, path: full, type: 'dir', children });
    } else if (ent.isFile() && isMarkdownFile(name)) {
      files.push({ name, path: full, type: 'file' });
    }
  }
  const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  dirs.sort(cmp);
  files.sort(cmp);
  return [...dirs, ...files];
}

// Canonical set of "folder entry document" filenames, in preference order,
// compared case-insensitively. Both entryDocFor (explorer tree) and
// folderIndexDoc (on-disk lookup) are driven from this single list.
const INDEX_DOC_NAMES = ['_index.md', 'readme.md', 'index.md'];

function firstMarkdownIn(nodes) {
  for (const n of nodes) if (n.type === 'file') return n.path;
  for (const n of nodes) {
    if (n.type === 'dir') {
      const hit = firstMarkdownIn(n.children);
      if (hit) return hit;
    }
  }
  return null;
}

// First markdown file to show when a folder is opened: a directory index
// (_index.md / README.md / index.md) at the top level, else the first
// markdown file found walking the tree depth-first.
function entryDocFor(tree) {
  for (const pref of INDEX_DOC_NAMES) {
    const hit = tree.find((n) => n.type === 'file' && n.name.toLowerCase() === pref);
    if (hit) return hit.path;
  }
  return firstMarkdownIn(tree);
}

// The markdown file that represents a folder link target (a folder "renders"
// its index document). Case-insensitive on all platforms. Returns null if the
// folder has no index doc.
function folderIndexDoc(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return null;
  }
  const files = entries.filter((e) => e.isFile());
  for (const pref of INDEX_DOC_NAMES) {
    const hit = files.find((e) => e.name.toLowerCase() === pref);
    if (hit) return path.join(dir, hit.name);
  }
  return null;
}

// Resolve a navigation request into a concrete action. `payload` is either
// { path } (an explorer click, absolute) or { href, fromPath } (a clicked
// in-document link, relative to the source doc). Returns an object with a
// `kind`: 'markdown' | 'folder-empty' | 'external' | 'missing', or null when
// there is nothing to do (e.g. a pure "#anchor" or an unresolvable relative
// link from an untitled document).
function resolveNavTarget(payload = {}) {
  let targetPath = null;
  let anchor = null;

  if (payload.path) {
    targetPath = payload.path;
  } else if (payload.href != null) {
    let href = String(payload.href);
    const hashIdx = href.indexOf('#');
    if (hashIdx >= 0) {
      anchor = href.slice(hashIdx + 1);
      href = href.slice(0, hashIdx);
    }
    if (!href) return null; // pure "#anchor" — handled entirely in the renderer
    if (/^file:\/\//i.test(href)) {
      try {
        targetPath = fileURLToPath(href);
      } catch (_) {
        return null;
      }
    } else {
      let decoded = href;
      try {
        decoded = decodeURIComponent(href);
      } catch (_) {
        /* use raw */
      }
      decoded = decoded.replace(/\//g, path.sep);
      if (path.isAbsolute(decoded)) targetPath = decoded;
      else if (payload.fromPath) targetPath = path.resolve(path.dirname(payload.fromPath), decoded);
      else return null;
    }
  } else {
    return null;
  }

  let st;
  try {
    st = fs.statSync(targetPath);
  } catch (_) {
    return { kind: 'missing', path: targetPath };
  }
  if (st.isDirectory()) {
    const idx = folderIndexDoc(targetPath);
    return idx ? { kind: 'markdown', path: idx, anchor } : { kind: 'folder-empty', path: targetPath };
  }
  if (isMarkdownFile(targetPath)) return { kind: 'markdown', path: targetPath, anchor };
  return { kind: 'external', path: targetPath };
}

// Flatten an explorer tree (from scanFolder) into a list of markdown file paths.
function collectMarkdownFiles(tree, out = []) {
  for (const n of tree) {
    if (n.type === 'file') out.push(n.path);
    else if (n.type === 'dir') collectMarkdownFiles(n.children, out);
  }
  return out;
}

const SEARCH_MAX_MATCHES_PER_FILE = 50;
const SEARCH_MAX_TOTAL_MATCHES = 1000;
const SEARCH_MAX_FILES = 500;
const FILE_LIST_TTL_MS = 4000;

// Per-folder caches so a burst of keystrokes doesn't re-walk the tree and
// re-read every file on each query. The file list is cached per folder with a
// short TTL; file contents are cached per path and revalidated by mtime, so an
// edited file is re-read but unchanged ones are reused.
let _fileListCache = { dir: null, at: 0, files: [] };
const _contentCache = new Map(); // path -> { mtimeMs, lines }

// Discard cached search state. Called when the open folder changes.
function invalidateSearchCache() {
  _fileListCache = { dir: null, at: 0, files: [] };
  _contentCache.clear();
}

function markdownFilesFor(dir) {
  const now = Date.now();
  if (_fileListCache.dir === dir && now - _fileListCache.at < FILE_LIST_TTL_MS) {
    return _fileListCache.files;
  }
  if (_fileListCache.dir !== dir) _contentCache.clear();
  const files = collectMarkdownFiles(scanFolder(dir));
  _fileListCache = { dir, at: now, files };
  return files;
}

function linesFor(file) {
  let mtimeMs;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch (_) {
    return null;
  }
  const cached = _contentCache.get(file);
  if (cached && cached.mtimeMs === mtimeMs) return cached.lines;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return null;
  }
  const lines = content.split(/\r?\n/);
  _contentCache.set(file, { mtimeMs, lines });
  return lines;
}

// Case-insensitive substring search across every markdown file under `dir`.
// Returns { query, files: [{ path, name, matches: [{ line, text }] }], truncated }.
// Uses cached file lists / contents (see above) so repeated queries are cheap.
function searchInFolder(dir, query) {
  const q = String(query == null ? '' : query).toLowerCase();
  if (!q.trim()) return { query, files: [], truncated: false };
  const files = markdownFilesFor(dir);
  const results = [];
  let total = 0;
  for (const file of files) {
    const lines = linesFor(file);
    if (lines == null) continue;
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({ line: i + 1, text: lines[i].trim().slice(0, 240) });
        total++;
        if (matches.length >= SEARCH_MAX_MATCHES_PER_FILE || total >= SEARCH_MAX_TOTAL_MATCHES) break;
      }
    }
    if (matches.length) results.push({ path: file, name: path.relative(dir, file), matches });
    if (total >= SEARCH_MAX_TOTAL_MATCHES || results.length >= SEARCH_MAX_FILES) break;
  }
  return { query, files: results, truncated: total >= SEARCH_MAX_TOTAL_MATCHES };
}

module.exports = {
  MD_EXTS,
  INDEX_DOC_NAMES,
  isMarkdownFile,
  scanFolder,
  entryDocFor,
  folderIndexDoc,
  resolveNavTarget,
  collectMarkdownFiles,
  searchInFolder,
  invalidateSearchCache,
};
