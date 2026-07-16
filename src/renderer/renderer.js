// Folio renderer: markdown-it preview into #write + CodeMirror 6 source editor
// under #typora-source, with Typora-compatible theme swapping.

import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import { full as emojiPlugin } from 'markdown-it-emoji';
import katexPlugin from '@vscode/markdown-it-katex';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

import { EditorState, EditorSelection, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap, highlightSpecialChars, drawSelection, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
  search,
  searchKeymap,
  highlightSelectionMatches,
  openSearchPanel,
} from '@codemirror/search';

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="md-fences hljs"><code class="hljs language-${lang}">${out}</code></pre>`;
      } catch (_) {
        /* fall through */
      }
    }
    return `<pre class="md-fences hljs"><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  },
})
  .use(taskLists, { enabled: true })
  .use(footnote)
  .use(emojiPlugin)
  // TeX math: `$...$` inline and `$$...$$` display, rendered to HTML+MathML by
  // KaTeX. throwOnError:false shows the offending source in red instead of
  // aborting the whole render on a typo.
  .use(katexPlugin, { throwOnError: false });

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  docText: '',
  savedText: '',
  path: null,
  sourceMode: false,
  outlineVisible: false,
  zoom: 0, // integer steps of 10%
  dirty: false,
  themesBaseUrl: '',
  themeFiles: [],
  baseUrl: null, // file:// URL of the open document, used to resolve relative assets
  folder: null, // { root, name } of the open folder, or null
  tree: [], // file-explorer tree nodes
  expanded: new Set(), // paths of expanded dirs
  filesVisible: false,
  lineNumbers: false, // optional gutter line numbers in the source editor
  pendingAnchor: null, // heading to scroll to after the next preview render
  find: { open: false, query: '', matches: [], index: -1 }, // in-preview find
  pendingFindQuery: '', // term to auto-highlight after a Find-in-Files navigation
};

let editor = null;
const editableCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();

// DOM
const $write = document.getElementById('write');
const $preview = document.getElementById('folio-preview');
const $source = document.getElementById('typora-source');
const $outline = document.getElementById('folio-outline');
const $outlineList = document.getElementById('folio-outline-list');
const $files = document.getElementById('folio-files');
const $filesTree = document.getElementById('folio-files-tree');
const $filesTitle = document.getElementById('folio-files-title');
const $filesSearch = document.getElementById('folio-files-search');
const $filesResults = document.getElementById('folio-files-results');
const $stats = document.getElementById('folio-stats');
const $btnOutline = document.getElementById('btn-outline');
const $btnFiles = document.getElementById('btn-files');
const $btnSource = document.getElementById('btn-source');
const $btnSourceLabel = document.getElementById('btn-source-label');
const $find = document.getElementById('folio-find');
const $findInput = document.getElementById('folio-find-input');
const $findCount = document.getElementById('folio-find-count');
const $findPrev = document.getElementById('folio-find-prev');
const $findNext = document.getElementById('folio-find-next');
const $findClose = document.getElementById('folio-find-close');
const $linkHint = document.getElementById('folio-link-hint');
const $toast = document.getElementById('folio-toast');

// ---------------------------------------------------------------------------
// CodeMirror editor
// ---------------------------------------------------------------------------
function createEditor(initialText) {
  const updateListener = EditorView.updateListener.of((v) => {
    if (v.docChanged && state.sourceMode) {
      state.docText = v.state.doc.toString();
      recomputeDirty();
      updateStats();
    }
  });

  const startState = EditorState.create({
    doc: initialText,
    extensions: [
      history(),
      drawSelection(),
      highlightSpecialChars(),
      // Optional gutter line numbers (View > Show Line Numbers). Held in a
      // compartment so the toggle reconfigures without rebuilding the editor.
      lineNumbersCompartment.of(state.lineNumbers ? lineNumbers() : []),
      bracketMatching(),
      highlightSelectionMatches(),
      search({ top: true }),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown({ base: markdownLanguage, codeLanguages: [] }),
      // Formatting shortcuts win over CodeMirror defaults and the browser's own
      // Ctrl+B/I/U editing commands, so they behave consistently in the editor.
      Prec.highest(keymap.of(formattingKeymap)),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      // Legacy compat class so themes' `#typora-source .CodeMirror` rules apply.
      EditorView.editorAttributes.of({ class: 'CodeMirror' }),
      editableCompartment.of(EditorView.editable.of(true)),
      updateListener,
    ],
  });

  editor = new EditorView({ state: startState, parent: $source });
}

function setEditorText(text) {
  if (!editor) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: text },
  });
}

// ---------------------------------------------------------------------------
// Markdown formatting commands (source-mode editor)
// ---------------------------------------------------------------------------
// Drive the Format menu / keyboard shortcuts. Formatting edits markdown text,
// so these only act while the CodeMirror source editor is active; in the
// read-only rendered preview they no-op (with a hint the first time).

// Inline markers for the wrap-style commands. Underline has no native markdown,
// so — like Typora — it falls back to inline <u></u> HTML.
const INLINE_FORMATS = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  underline: ['<u>', '</u>'],
  strikethrough: ['~~', '~~'],
  code: ['`', '`'],
  math: ['$', '$'], // inline TeX math
};

function applyFormat(kind) {
  if (!state.sourceMode || !editor) {
    showToast('Switch to Source mode (Ctrl/Cmd+/) to format text');
    return;
  }
  if (INLINE_FORMATS[kind]) {
    toggleWrap(editor, INLINE_FORMATS[kind][0], INLINE_FORMATS[kind][1]);
  } else if (kind === 'link') {
    insertLink(editor);
  } else if (kind === 'codeblock') {
    insertFencedBlock(editor, '```', '```');
  } else if (kind === 'mathblock') {
    insertFencedBlock(editor, '$$', '$$');
  } else if (/^h[1-6]$/.test(kind)) {
    setHeading(editor, Number(kind.slice(1)));
  }
  editor.focus();
}

// Wrap each selection in `before`/`after`, or drop empty markers with the caret
// between them when nothing is selected. Toggles: if the selection is already
// wrapped (markers just outside, or included inside the selection), unwrap it.
function toggleWrap(view, before, after) {
  const bLen = before.length;
  const aLen = after.length;
  const docLen = view.state.doc.length;
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range;
      const selected = view.state.sliceDoc(from, to);
      const outerBefore = view.state.sliceDoc(Math.max(0, from - bLen), from);
      const outerAfter = view.state.sliceDoc(to, Math.min(docLen, to + aLen));

      // Markers sit just outside the selection -> unwrap.
      if (from !== to && outerBefore === before && outerAfter === after) {
        return {
          changes: [
            { from: from - bLen, to: from, insert: '' },
            { from: to, to: to + aLen, insert: '' },
          ],
          range: EditorSelection.range(from - bLen, to - bLen),
        };
      }
      // Markers are inside the selection -> unwrap.
      if (selected.length >= bLen + aLen && selected.startsWith(before) && selected.endsWith(after)) {
        const inner = selected.slice(bLen, selected.length - aLen);
        return {
          changes: { from, to, insert: inner },
          range: EditorSelection.range(from, from + inner.length),
        };
      }
      // Otherwise wrap.
      return {
        changes: [
          { from, insert: before },
          { from: to, insert: after },
        ],
        range:
          from === to
            ? EditorSelection.cursor(from + bLen)
            : EditorSelection.range(from + bLen, to + bLen),
      };
    })
  );
  return true;
}

// Set (or toggle off) the ATX heading level of every line the selection touches.
// Pressing the level a line already has strips the heading.
function setHeading(view, level) {
  const doc = view.state.doc;
  const lineNums = new Set();
  for (const range of view.state.selection.ranges) {
    const start = doc.lineAt(range.from).number;
    const end = doc.lineAt(range.to).number;
    for (let n = start; n <= end; n++) lineNums.add(n);
  }
  const changes = [];
  for (const n of lineNums) {
    const line = doc.line(n);
    const m = /^(#{1,6})[ \t]+/.exec(line.text);
    const currentLevel = m ? m[1].length : 0;
    const prefixLen = m ? m[0].length : 0;
    const newPrefix = currentLevel === level ? '' : '#'.repeat(level) + ' ';
    changes.push({ from: line.from, to: line.from + prefixLen, insert: newPrefix });
  }
  view.dispatch({ changes, scrollIntoView: true });
  return true;
}

// Insert a markdown link. With a selection: `[selected]()` with the caret in the
// URL parens. Without one: `[]()` with the caret in the link-text brackets.
function insertLink(view) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range;
      if (from === to) {
        return { changes: { from, insert: '[]()' }, range: EditorSelection.cursor(from + 1) };
      }
      const selected = view.state.sliceDoc(from, to);
      return {
        changes: { from, to, insert: `[${selected}]()` },
        range: EditorSelection.cursor(from + selected.length + 3),
      };
    })
  );
  return true;
}

// Insert a fenced block (code ``` ``` ``` ``` or math `$$`) on its own lines.
// With a selection the selected text becomes the block body; with none, an empty
// body line is created with the caret on it. A leading newline is added when the
// caret isn't already at the start of a line so the fence isn't glued to text.
function insertFencedBlock(view, open, close) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range;
      const body = view.state.sliceDoc(from, to);
      const lead = from === view.state.doc.lineAt(from).from ? '' : '\n';
      const insert = `${lead}${open}\n${body}\n${close}`;
      const bodyStart = from + lead.length + open.length + 1;
      return {
        changes: { from, to, insert },
        range: EditorSelection.range(bodyStart, bodyStart + body.length),
      };
    })
  );
  return true;
}

// CodeMirror keybindings for the formatting commands. These are the real
// keyboard handlers (the Format menu accelerators are display-only, via
// registerAccelerator:false, so they don't swallow the keys). Each returns true
// so CodeMirror stops the event, preventing the browser's native Ctrl+B/I/U.
const formattingKeymap = [
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**', '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*', '*') },
  { key: 'Mod-u', run: (v) => toggleWrap(v, '<u>', '</u>') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~', '~~') },
  { key: 'Mod-e', run: (v) => toggleWrap(v, '`', '`') },
  { key: 'Mod-Shift-e', run: (v) => insertFencedBlock(v, '```', '```') },
  { key: 'Mod-m', run: (v) => toggleWrap(v, '$', '$') },
  { key: 'Mod-Shift-m', run: (v) => insertFencedBlock(v, '$$', '$$') },
  { key: 'Mod-k', run: (v) => insertLink(v) },
  { key: 'Mod-1', run: (v) => setHeading(v, 1) },
  { key: 'Mod-2', run: (v) => setHeading(v, 2) },
  { key: 'Mod-3', run: (v) => setHeading(v, 3) },
  { key: 'Mod-4', run: (v) => setHeading(v, 4) },
  { key: 'Mod-5', run: (v) => setHeading(v, 5) },
  { key: 'Mod-6', run: (v) => setHeading(v, 6) },
];

// ---------------------------------------------------------------------------
// Rendering / preview
// ---------------------------------------------------------------------------
function currentText() {
  return state.sourceMode && editor ? editor.state.doc.toString() : state.docText;
}

// ---------------------------------------------------------------------------
// YAML front matter
// ---------------------------------------------------------------------------
// A leading `--- ... ---` block would otherwise be mis-parsed (the closing
// `---` turns the metadata into a giant setext H1). Strip it and render it as
// a subtle metadata box, the way Typora shows document front matter.
function splitFrontMatter(text) {
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { frontMatter: null, body: text };
  return { frontMatter: m[1], body: text.slice(m[0].length) };
}

function renderFrontMatter(fm) {
  return `<pre class="md-front-matter">${md.utils.escapeHtml(fm)}</pre>`;
}

function renderPreview() {
  const { frontMatter, body } = splitFrontMatter(currentText() || '');
  let html = md.render(body);
  if (frontMatter != null) html = renderFrontMatter(frontMatter) + html;
  // markdown-it runs with html:true so documents may contain raw HTML. Opened
  // files are untrusted, so sanitize before injection to strip scripts and
  // inline event handlers (e.g. <img onerror=…>) that would otherwise run.
  $write.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  hideLinkHint();
  resolveLocalAssets();
  wireLinks();
  buildOutline();
  updateStats();
  // Old match ranges point into the replaced DOM; recompute if find is open.
  if (state.find.open) runFind(state.find.query);
}

// Rewrite relative asset URLs (e.g. `docs/folio.png`) so they resolve against
// the *opened document's* folder rather than the app's renderer directory.
// Without this, relative <img> paths 404 because the window is loaded from
// src/renderer/index.html. Absolute, remote (http/https), data:, blob:, and
// already-file: URLs are left untouched.
function resolveLocalAssets() {
  if (!state.baseUrl) return;
  $write.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    // Skip anchors and anything that already carries a URL scheme or is
    // protocol-relative (`//host/...`).
    if (!src || src.startsWith('#') || src.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(src)) {
      return;
    }
    try {
      img.setAttribute('src', new URL(src, state.baseUrl).href);
    } catch (_) {
      /* leave the original src in place */
    }
  });
}

function wireLinks() {
  $write.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    if (/^(https?:|mailto:)/i.test(href)) {
      // External links open in the OS browser / mail client.
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.folioAPI.openExternal(href);
      });
      return;
    }
    if (href.startsWith('#')) {
      // In-page anchor: scroll within the current document.
      a.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToAnchor(href.slice(1));
      });
      return;
    }
    // Relative / internal link (another doc or a folder). Let main resolve it
    // against the current document and navigate (with an unsaved-changes check).
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo({ href, fromPath: state.path });
    });
  });
}

// Ask main to open a target: either { path } (explorer click) or
// { href, fromPath } (in-document link). Main handles the dirty prompt and,
// on success, sends back a load-document that updates the view + explorer.
function navigateTo(payload) {
  Promise.resolve(window.folioAPI.navigate(payload)).catch((err) => console.error(err));
}

// --- Link hover hint -------------------------------------------------------
// Browser-style status hint: while the pointer is over a link in the rendered
// preview, show its target in a small overlay pinned to the bottom-left.
// Wired once via event delegation on #write so it survives re-renders.
function linkHintText(a) {
  const href = a.getAttribute('href') || '';
  if (!href) return '';
  if (href.startsWith('#')) return href; // in-page anchor
  // Resolve relative targets against the open document so the hint shows where
  // the link actually points, mirroring how clicks are resolved.
  if (state.baseUrl && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('//')) {
    try {
      const resolved = new URL(href, state.baseUrl);
      if (resolved.protocol === 'file:') {
        try {
          return decodeURIComponent(resolved.pathname);
        } catch (_) {
          return resolved.pathname;
        }
      }
      return resolved.href;
    } catch (_) {
      /* fall through to raw href */
    }
  }
  try {
    return decodeURI(href);
  } catch (_) {
    return href;
  }
}

function showLinkHint(a) {
  const text = linkHintText(a);
  if (!text) return;
  $linkHint.textContent = text;
  $linkHint.hidden = false;
}

function hideLinkHint() {
  $linkHint.hidden = true;
  $linkHint.textContent = '';
}

function setupLinkHint() {
  $write.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a[href]');
    if (a && $write.contains(a)) showLinkHint(a);
  });
  $write.addEventListener('mouseout', (e) => {
    const a = e.target.closest('a[href]');
    if (a && !a.contains(e.relatedTarget)) hideLinkHint();
  });
  // Safety net: leaving the preview entirely (e.g. onto the status bar) clears it.
  $preview.addEventListener('mouseleave', hideLinkHint);
}

// GitHub-style heading slug so both the outline and `#anchor` links resolve to
// the same ids.
function githubSlug(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function scrollToAnchor(rawId) {
  if (!rawId) return;
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch (_) {
    /* use raw */
  }
  const slug = githubSlug(id);
  let el = document.getElementById(id) || (slug && document.getElementById(slug));
  if (!el) {
    el = [...$write.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(
      (h) => githubSlug(h.textContent || '') === slug
    );
  }
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------
// Assign GitHub-style ids to headings (deduping collisions) so both the
// outline and in-document `#anchor` links resolve to the same targets.
function assignHeadingIds(headings) {
  const seen = Object.create(null);
  headings.forEach((h) => {
    if (h.id) return;
    let base = githubSlug(h.textContent || '') || 'section';
    let id = base;
    if (seen[base] != null) {
      seen[base] += 1;
      id = `${base}-${seen[base]}`;
    } else {
      seen[base] = 0;
    }
    h.id = id;
  });
}

function buildOutline() {
  const headings = $write.querySelectorAll('h1, h2, h3, h4, h5, h6');
  assignHeadingIds(headings);
  $outlineList.innerHTML = '';
  headings.forEach((h) => {
    const item = document.createElement('a');
    item.className = `outline-item outline-${h.tagName.toLowerCase()}`;
    item.textContent = h.textContent || '';
    item.href = `#${h.id}`;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $outlineList.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// File explorer (folder mode)
// ---------------------------------------------------------------------------
function normPath(p) {
  return (p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function samePath(a, b) {
  return !!a && !!b && normPath(a) === normPath(b);
}

// Set (or clear) the open folder and render its tree. `show` controls whether
// the pane becomes visible (true for an explicit Open Folder, driven by the
// stored preference at boot).
function setFolder(payload, show) {
  if (!payload) {
    state.folder = null;
    state.tree = [];
    state.expanded = new Set();
  } else {
    state.folder = { root: payload.root, name: payload.name };
    state.tree = payload.tree || [];
    state.expanded = new Set();
    // Start collapsed; only expand the path down to the active file so it stays visible.
    expandAncestorsOf(state.path);
  }
  $filesTitle.textContent = state.folder ? state.folder.name : 'Files';
  hideFileSearch();
  renderFileTree();
  if (show != null) setFilesVisible(show);
}

function expandAncestorsOf(filePath) {
  if (!filePath) return;
  const target = normPath(filePath);
  const walk = (nodes) => {
    nodes.forEach((n) => {
      if (n.type === 'dir') {
        if (target.startsWith(normPath(n.path) + '/')) state.expanded.add(n.path);
        walk(n.children);
      }
    });
  };
  walk(state.tree);
}

function renderFileTree() {
  $filesTree.innerHTML = '';
  if (!state.tree.length) {
    const empty = document.createElement('div');
    empty.className = 'folio-files-empty';
    empty.textContent = state.folder ? 'No markdown files' : 'No folder open';
    $filesTree.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  state.tree.forEach((node) => frag.appendChild(renderTreeNode(node, 0)));
  $filesTree.appendChild(frag);
  const active = $filesTree.querySelector('.files-file.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function renderTreeNode(node, depth) {
  const indent = 8 + depth * 14;
  if (node.type === 'dir') {
    const wrap = document.createElement('div');
    const open = state.expanded.has(node.path);
    const row = document.createElement('div');
    row.className = 'files-row files-dir';
    row.style.paddingLeft = `${indent}px`;
    const twisty = document.createElement('span');
    twisty.className = 'files-twisty';
    twisty.textContent = open ? '\u25be' : '\u25b8'; // ▾ / ▸
    const ico = document.createElement('span');
    ico.className = 'files-ico';
    ico.textContent = open ? '\u{1f4c2}' : '\u{1f4c1}'; // open/closed folder
    const name = document.createElement('span');
    name.className = 'files-name';
    name.textContent = node.name;
    row.append(twisty, ico, name);
    row.addEventListener('click', () => {
      if (state.expanded.has(node.path)) state.expanded.delete(node.path);
      else state.expanded.add(node.path);
      renderFileTree();
    });
    wrap.appendChild(row);
    if (open) {
      node.children.forEach((c) => wrap.appendChild(renderTreeNode(c, depth + 1)));
    }
    return wrap;
  }
  // File
  const row = document.createElement('div');
  row.className = 'files-row files-file';
  if (samePath(node.path, state.path)) row.classList.add('active');
  row.style.paddingLeft = `${indent + 14}px`; // align past the folder twisty
  row.title = node.path;
  const ico = document.createElement('span');
  ico.className = 'files-ico';
  ico.textContent = '\u{1f4c4}'; // 📄
  const name = document.createElement('span');
  name.className = 'files-name';
  name.textContent = node.name;
  row.append(ico, name);
  row.addEventListener('click', () => navigateTo({ path: node.path }));
  return row;
}

// Keep the explorer highlight/expansion in sync with the active document.
function syncFileTree() {
  if (!state.tree.length) return;
  expandAncestorsOf(state.path);
  renderFileTree();
}

// ---------------------------------------------------------------------------
// Find in Files (folder-scoped content search)
// ---------------------------------------------------------------------------
let fileSearchTimer = null;

function openFileSearch() {
  setFilesVisible(true);
  $filesSearch.hidden = false;
  $filesSearch.focus();
  $filesSearch.select();
}

function scheduleFileSearch() {
  clearTimeout(fileSearchTimer);
  fileSearchTimer = setTimeout(runFileSearch, 180);
}

function runFileSearch() {
  const query = $filesSearch.value.trim();
  if (!query) {
    showFileTree();
    return;
  }
  Promise.resolve(window.folioAPI.searchFiles(query))
    .then((data) => renderFileResults(data))
    .catch((err) => console.error(err));
}

function showFileTree() {
  $filesResults.hidden = true;
  $filesResults.innerHTML = '';
  $filesTree.hidden = false;
}

function clearFileSearch() {
  clearTimeout(fileSearchTimer);
  if ($filesSearch) $filesSearch.value = '';
  showFileTree();
}

// Fully dismiss the Find-in-Files box: clear it, restore the tree, and hide it.
function hideFileSearch() {
  clearFileSearch();
  if ($filesSearch) $filesSearch.hidden = true;
}

function renderFileResults(data) {
  $filesTree.hidden = true;
  $filesResults.hidden = false;
  $filesResults.innerHTML = '';
  const query = (data && data.query) || '';
  const files = (data && data.files) || [];
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'folio-files-empty';
    empty.textContent = 'No matches';
    $filesResults.appendChild(empty);
    return;
  }
  const total = files.reduce((n, f) => n + f.matches.length, 0);
  const summary = document.createElement('div');
  summary.className = 'files-results-summary';
  summary.textContent =
    `${total} match${total === 1 ? '' : 'es'} in ${files.length} file${files.length === 1 ? '' : 's'}` +
    (data && data.truncated ? ' (truncated)' : '');
  $filesResults.appendChild(summary);
  const frag = document.createDocumentFragment();
  files.forEach((file) => {
    const group = document.createElement('div');
    group.className = 'files-result-group';
    const header = document.createElement('div');
    header.className = 'files-result-file';
    if (samePath(file.path, state.path)) header.classList.add('active');
    header.title = file.path;
    const nm = document.createElement('span');
    nm.className = 'files-name';
    nm.textContent = file.name;
    const cnt = document.createElement('span');
    cnt.className = 'files-result-count';
    cnt.textContent = String(file.matches.length);
    header.append(nm, cnt);
    header.addEventListener('click', () => openSearchResult(file.path, query));
    group.appendChild(header);
    file.matches.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'files-result-match';
      row.title = `Line ${m.line}`;
      const ln = document.createElement('span');
      ln.className = 'files-result-line';
      ln.textContent = String(m.line);
      const tx = document.createElement('span');
      tx.className = 'files-result-text';
      appendHighlighted(tx, m.text, query);
      row.append(ln, tx);
      row.addEventListener('click', () => openSearchResult(file.path, query));
      group.appendChild(row);
    });
    frag.appendChild(group);
  });
  $filesResults.appendChild(frag);
}

// Append `text` to `el`, wrapping case-insensitive occurrences of `query` in <mark>.
function appendHighlighted(el, text, query) {
  const q = (query || '').toLowerCase();
  if (!q) {
    el.appendChild(document.createTextNode(text));
    return;
  }
  const lower = text.toLowerCase();
  let i = 0;
  let idx;
  while ((idx = lower.indexOf(q, i)) !== -1) {
    if (idx > i) el.appendChild(document.createTextNode(text.slice(i, idx)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(idx, idx + q.length);
    el.appendChild(mark);
    i = idx + q.length;
  }
  if (i < text.length) el.appendChild(document.createTextNode(text.slice(i)));
}

// Open a document from a search result and remember the term so the in-preview
// find bar highlights it once the document renders.
function openSearchResult(path, query) {
  state.pendingFindQuery = query;
  navigateTo({ path });
}

function setFilesVisible(on) {
  state.filesVisible = on;
  $files.hidden = !on;
  updateStatusButtons();
  persistState();
}

// ---------------------------------------------------------------------------
// Status bar: live document stats + mode-toggle buttons
// ---------------------------------------------------------------------------
function computeStats(text) {
  const t = text || '';
  const words = (t.match(/[^\s]+/g) || []).length;
  const chars = [...t].length;
  const lines = t.length ? t.split(/\r\n|\r|\n/).length : 0;
  const readMin = Math.max(1, Math.round(words / 200));
  return { words, chars, lines, readMin };
}

function updateStats() {
  const s = computeStats(currentText());
  const parts = [
    `${s.words.toLocaleString()} ${s.words === 1 ? 'word' : 'words'}`,
    `${s.chars.toLocaleString()} ${s.chars === 1 ? 'char' : 'chars'}`,
    `${s.lines.toLocaleString()} ${s.lines === 1 ? 'line' : 'lines'}`,
    `~${s.readMin} min read`,
  ];
  $stats.innerHTML = parts
    .map((p) => `<span class="folio-stat">${p}</span>`)
    .join('<span class="folio-stat-sep">·</span>');
}

function updateStatusButtons() {
  $btnSource.classList.toggle('active', state.sourceMode);
  $btnSourceLabel.textContent = state.sourceMode ? 'Exit Source' : 'Source';
  $btnSource.title = state.sourceMode
    ? 'Exit Source Code Mode (Ctrl/Cmd+/)'
    : 'Toggle Source Code Mode (Ctrl/Cmd+/)';
  $btnOutline.classList.toggle('active', state.outlineVisible);
  $btnFiles.classList.toggle('active', state.filesVisible);
}
function setSourceMode(on) {
  state.sourceMode = on;
  document.body.classList.toggle('typora-sourceview-on', on);

  if (on) {
    if (!editor) createEditor(state.docText);
    else setEditorText(state.docText);
    if (state.find.open) closeFindBar();
    hideLinkHint();
    $preview.hidden = true;
    $source.hidden = false;
    // CM needs a measure once it becomes visible.
    requestAnimationFrame(() => {
      editor.requestMeasure();
      editor.focus();
    });
  } else {
    if (editor) state.docText = editor.state.doc.toString();
    $source.hidden = true;
    $preview.hidden = false;
    renderPreview();
  }
  updateStatusButtons();
  persistState();
}

function setOutlineVisible(on) {
  state.outlineVisible = on;
  $outline.hidden = !on;
  updateStatusButtons();
  persistState();
}

// Toggle the source editor's gutter line numbers. The setting persists and, when
// the editor already exists, is applied live by reconfiguring its compartment.
function setLineNumbers(on) {
  state.lineNumbers = on;
  if (editor) {
    editor.dispatch({
      effects: lineNumbersCompartment.reconfigure(on ? lineNumbers() : []),
    });
  }
  persistState();
}

// ---------------------------------------------------------------------------
// Find in preview (rendered mode)
// ---------------------------------------------------------------------------
// Uses the CSS Custom Highlight API: matches are marked with Range objects
// registered under ::highlight(folio-find[-current]) instead of mutating the
// DOM, so highlights never disturb layout and are trivially cleared on
// re-render. Falls back gracefully (no highlight, just no-op) if unsupported.
const HIGHLIGHT_SUPPORTED =
  typeof window.Highlight === 'function' && window.CSS && CSS.highlights;

function openFindBar(initialQuery) {
  $find.hidden = false;
  state.find.open = true;
  if (typeof initialQuery === 'string' && initialQuery) $findInput.value = initialQuery;
  $findInput.focus();
  $findInput.select();
  runFind($findInput.value);
}

function closeFindBar() {
  $find.hidden = true;
  state.find.open = false;
  clearFindHighlights();
  if (!state.sourceMode) $preview.focus?.();
}

function clearFindHighlights() {
  if (HIGHLIGHT_SUPPORTED) {
    CSS.highlights.delete('folio-find');
    CSS.highlights.delete('folio-find-current');
  }
  state.find.matches = [];
  state.find.index = -1;
}

function findRangesIn(root, query) {
  const q = query.toLowerCase();
  const ranges = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeValue && node.nodeValue.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue.toLowerCase();
    let idx = text.indexOf(q);
    while (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + q.length);
      ranges.push(range);
      idx = text.indexOf(q, idx + q.length);
    }
  }
  return ranges;
}

function runFind(query) {
  clearFindHighlights();
  state.find.query = query;
  if (!query) {
    updateFindCount();
    return;
  }
  const ranges = HIGHLIGHT_SUPPORTED ? findRangesIn($write, query) : [];
  state.find.matches = ranges;
  if (ranges.length) {
    CSS.highlights.set('folio-find', new Highlight(...ranges));
    setCurrentMatch(0, true);
  } else {
    updateFindCount();
  }
}

function setCurrentMatch(i, scroll) {
  state.find.index = i;
  const cur = state.find.matches[i];
  if (HIGHLIGHT_SUPPORTED) {
    CSS.highlights.delete('folio-find-current');
    if (cur) {
      const h = new Highlight(cur);
      h.priority = 1; // paint the current match on top of the plain matches
      CSS.highlights.set('folio-find-current', h);
    }
  }
  if (cur && scroll) {
    const el = cur.startContainer.parentElement;
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  updateFindCount();
}

function findStep(dir) {
  const n = state.find.matches.length;
  if (!n) return;
  setCurrentMatch((state.find.index + dir + n) % n, true);
}

function updateFindCount() {
  const n = state.find.matches.length;
  if (n) $findCount.textContent = `${state.find.index + 1}/${n}`;
  else $findCount.textContent = state.find.query ? '0/0' : '';
}


// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------
function applyZoom() {
  const factor = Math.max(0.5, Math.min(2.5, 1 + state.zoom * 0.1));
  document.getElementById('folio-root').style.zoom = String(factor);
}

function zoom(delta) {
  if (delta === 0) state.zoom = 0;
  else state.zoom = Math.max(-5, Math.min(15, state.zoom + delta));
  applyZoom();
  persistState();
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
// The active theme is composed of an ordered stack of stylesheets (base
// foundation → family overlay → width overlay). They are mounted as <link>
// elements appended after app.css so the theme wins on shared selectors and
// later layers override earlier ones. Appearance (light/dark) is handled by
// the main process via nativeTheme, which the stylesheets react to through
// their @media (prefers-color-scheme: dark) blocks — no work needed here.
function applyTheme(payload) {
  const files = Array.isArray(payload) ? payload : payload && payload.files;
  if (!files || !files.length) return;
  state.themeFiles = files;

  document.querySelectorAll('link.folio-theme').forEach((l) => l.remove());
  for (const file of files) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.className = 'folio-theme';
    link.href = state.themesBaseUrl + file;
    document.head.appendChild(link);
  }
}

// ---------------------------------------------------------------------------
// Dirty tracking
// ---------------------------------------------------------------------------
function recomputeDirty() {
  const dirty = currentText() !== state.savedText;
  if (dirty !== state.dirty) {
    state.dirty = dirty;
    window.folioAPI.setDirty(dirty);
  }
}

function markSaved() {
  state.savedText = currentText();
  state.dirty = false;
  window.folioAPI.setDirty(false);
}

// ---------------------------------------------------------------------------
// Document loading
// ---------------------------------------------------------------------------
function loadDocument(doc) {
  // On an in-place reload (external change or File ▸ Reload), keep the reading
  // position instead of snapping to the top. Capture it as a fraction so it still
  // makes sense if the document grew or shrank.
  const preserveScroll = !!doc.preserveScroll;
  const prevPreviewFrac =
    preserveScroll && $preview.scrollHeight > 0 ? $preview.scrollTop / $preview.scrollHeight : 0;
  const prevEditorTop = preserveScroll && editor ? editor.scrollDOM.scrollTop : 0;

  state.path = doc.path || null;
  state.baseUrl = doc.baseUrl || null;
  state.docText = doc.content || '';
  state.savedText = state.docText;
  state.dirty = false;
  state.pendingAnchor = doc.anchor || null;
  window.folioAPI.setDirty(false);

  if (state.sourceMode) {
    if (!editor) createEditor(state.docText);
    else setEditorText(state.docText);
    requestAnimationFrame(() => editor && editor.requestMeasure());
    updateStats();
  } else {
    renderPreview();
    if (state.pendingAnchor) {
      const anchor = state.pendingAnchor;
      requestAnimationFrame(() => scrollToAnchor(anchor));
    }
  }
  state.pendingAnchor = null;
  syncFileTree();
  updateStatusButtons();

  if (preserveScroll) {
    if (state.sourceMode) {
      requestAnimationFrame(() => {
        if (editor) editor.scrollDOM.scrollTop = prevEditorTop;
      });
    } else {
      requestAnimationFrame(() => {
        $preview.scrollTop = prevPreviewFrac * $preview.scrollHeight;
      });
    }
  } else {
    $preview.scrollTop = 0;
  }

  // If we arrived here from a Find-in-Files result, highlight the term.
  if (state.pendingFindQuery) {
    const q = state.pendingFindQuery;
    state.pendingFindQuery = '';
    if (!state.sourceMode) openFindBar(q);
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
function persistState() {
  window.folioAPI.setState({
    sourceMode: state.sourceMode,
    outlineVisible: state.outlineVisible,
    filesVisible: state.filesVisible,
    lineNumbers: state.lineNumbers,
    zoom: state.zoom,
  });
}

// ---------------------------------------------------------------------------
// Commands from the native menu
// ---------------------------------------------------------------------------
function handleCommand(payload) {
  const name = payload && payload.name;
  switch (name) {
    case 'toggle-source':
      setSourceMode(!state.sourceMode);
      break;
    case 'toggle-outline':
      setOutlineVisible(!state.outlineVisible);
      break;
    case 'toggle-files':
      setFilesVisible(!state.filesVisible);
      break;
    case 'toggle-line-numbers':
      setLineNumbers(!state.lineNumbers);
      break;
    case 'zoom-in':
      zoom(1);
      break;
    case 'zoom-out':
      zoom(-1);
      break;
    case 'zoom-reset':
      zoom(0);
      break;
    case 'find':
      if (state.sourceMode) {
        requestAnimationFrame(() => editor && openSearchPanel(editor));
      } else {
        openFindBar();
      }
      break;
    case 'find-in-files':
      openFileSearch();
      break;
    case 'format':
      applyFormat(payload && payload.format);
      break;
    case 'toast':
      showToast(payload && payload.text);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Transient toast (bottom-center). Used for lightweight confirmations such as
// "Path copied to clipboard".
// ---------------------------------------------------------------------------
let toastHideTimer = null;
let toastClearTimer = null;
function showToast(text) {
  if (!text || !$toast) return;
  clearTimeout(toastHideTimer);
  clearTimeout(toastClearTimer);
  $toast.textContent = text;
  $toast.hidden = false;
  // Restart the fade-in transition even on rapid repeats.
  $toast.classList.remove('folio-toast-show');
  void $toast.offsetWidth;
  $toast.classList.add('folio-toast-show');
  toastHideTimer = setTimeout(() => {
    $toast.classList.remove('folio-toast-show');
    toastClearTimer = setTimeout(() => {
      $toast.hidden = true;
    }, 220);
  }, 1600);
}

// ---------------------------------------------------------------------------
// Requests from the main process (content for save, prepare for export)
// ---------------------------------------------------------------------------
function handleMainRequest(kind) {
  switch (kind) {
    case 'content':
      return currentText();
    case 'prepare-export':
      if (state.sourceMode) setSourceMode(false);
      return true;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  const init = await window.folioAPI.getInit();
  state.themesBaseUrl = init.themesBaseUrl;

  applyTheme(init.themeFiles);

  const s = init.settings || {};
  state.zoom = typeof s.zoom === 'number' ? s.zoom : 0;
  applyZoom();
  setOutlineVisible(!!s.outlineVisible);
  // Restore the line-numbers preference before the editor is lazily created.
  state.lineNumbers = !!s.lineNumbers;

  // Restore a previously opened folder (explorer tree) before loading the doc,
  // so the initial document highlights correctly. Visibility follows the stored
  // preference.
  if (init.folder) {
    setFolder(init.folder, null);
  }
  setFilesVisible(!!s.filesVisible && !!state.folder);

  // Load initial document (rendered preview first).
  loadDocument(init.document || { path: null, content: '' });

  // Honour a persisted source-mode preference.
  if (s.sourceMode) setSourceMode(true);

  // Wire status-bar buttons.
  $btnSource.addEventListener('click', () => setSourceMode(!state.sourceMode));
  $btnOutline.addEventListener('click', () => setOutlineVisible(!state.outlineVisible));
  $btnFiles.addEventListener('click', () => setFilesVisible(!state.filesVisible));

  // Show link targets on hover in the rendered preview.
  setupLinkHint();

  // Wire the in-preview find bar.
  $findInput.addEventListener('input', () => runFind($findInput.value));
  $findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findStep(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFindBar();
    }
  });
  $findPrev.addEventListener('click', () => {
    findStep(-1);
    $findInput.focus();
  });
  $findNext.addEventListener('click', () => {
    findStep(1);
    $findInput.focus();
  });
  $findClose.addEventListener('click', () => closeFindBar());

  // Wire the Find-in-Files search box.
  $filesSearch.addEventListener('input', () => scheduleFileSearch());
  $filesSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideFileSearch();
      if (!state.sourceMode) $preview.focus?.();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(fileSearchTimer);
      runFileSearch();
    }
  });

  // Wire main -> renderer events.
  window.folioAPI.onCommand((payload) => handleCommand(payload));
  window.folioAPI.onLoadDocument((doc) => loadDocument(doc));
  window.folioAPI.onOpenFolder((payload) => setFolder(payload, !!payload));
  // On Windows/Linux the View > Toggle File Explorer/Outline menu items carry a
  // baked-in "Ctrl+Alt+…" label instead of a native accelerator (see menu.js),
  // so handle those keystrokes here. macOS keeps the native accelerator.
  if (!/Mac/i.test(navigator.platform || navigator.userAgent || '')) {
    window.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
      const code = e.code;
      if (code === 'KeyE') {
        e.preventDefault();
        setFilesVisible(!state.filesVisible);
      } else if (code === 'KeyO') {
        e.preventDefault();
        setOutlineVisible(!state.outlineVisible);
      }
    });
  }
  window.folioAPI.onSetTheme((themeFile) => applyTheme(themeFile));
  window.folioAPI.onSaved(() => markSaved());
  window.folioAPI.onDocumentPathChanged((info) => {
    state.path = info && info.path;
    if (info && info.baseUrl) state.baseUrl = info.baseUrl;
    if (!state.sourceMode) renderPreview();
    syncFileTree();
  });

  // Answer main-process requests (get editor content, prepare for export).
  window.folioAPI.onRequest((kind) => handleMainRequest(kind));
}

boot().catch((err) => {
  document.getElementById('write').innerHTML =
    `<h1>Folio failed to start</h1><pre>${String(err && err.stack ? err.stack : err)}</pre>`;
  console.error(err);
});
