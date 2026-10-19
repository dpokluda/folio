# Contract: Explorer & Hint Chrome, Scan Rules and Settings

**Feature**: [../spec.md](../spec.md) | **Source**: `src/folder.js`, `src/renderer/index.html`, `src/renderer/renderer.js`, `src/renderer/app.css`, `src/store.js`

## 1. Scan contract (`scanFolder(dir)`, `src/folder.js`)

| Rule | Value |
|------|-------|
| Markdown extensions (`MD_EXTS`, case-insensitive) | `.md`, `.markdown`, `.mdown`, `.mkd`, `.markdn`, `.mdtext`, `.mdtxt` |
| Always skipped | Any entry whose name starts with `.`; folders in `SKIP_DIRS`: `node_modules`, `.git`, `.obsidian`, `.vscode`, `.idea` |
| Folder pruning | A folder appears only if its scanned subtree contains at least one Markdown file |
| Depth | `MAX_TREE_DEPTH = 16`: subfolders of a folder at depth 16 (root = 0) are not entered |
| Order | Folders, then files; each sorted with `a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })` |
| Errors | An unreadable folder yields `[]` (silently omitted) |
| Symbolic links | Ignored (`Dirent` reports neither directory nor file) |
| Output | `TreeNode[]` as defined in [../data-model.md](../data-model.md) |

Entry document on Open Folder: `entryDocFor(tree)`; index document for folder links: `folderIndexDoc(dir)`; both use `INDEX_DOC_NAMES = ['_index.md', 'readme.md', 'index.md']` (lower-cased comparison).

## 2. Chrome elements (`src/renderer/index.html`)

All elements are Folio chrome outside `#write`; no Typora theme selector targets them, and they leave the `#write` / `#typora-source` contract of constitution I untouched.

| Element | Purpose | Introduced |
|---------|---------|------------|
| `aside#folio-files[hidden]` (`aria-label="File explorer"`), first child of `#folio-root`, before `#folio-outline` | Explorer pane, 260 px wide (`flex: 0 0 260px`), scrolls independently | `e2e2877` |
| `div.folio-files-title#folio-files-title` | Folder name (upper-cased by style), "Files" when no folder | `e2e2877` |
| `nav#folio-files-tree` | Tree rows | `e2e2877` |
| `button#btn-files.folio-status-btn` | Status-bar **Files** toggle | `e2e2877` |
| `div#folio-link-hint[hidden][aria-hidden="true"]` inside `#folio-content` | Link-target hint | `f8f17fa` |

`input#folio-files-search` and `div#folio-files-results` inside the pane belong to Find in Files ([006](../../006-find-in-document-and-files/spec.md)).

## 3. Tree rows (`renderTreeNode()`)

| Row | Classes | Content | Interaction |
|-----|---------|---------|-------------|
| Folder | `.files-row.files-dir` | `.files-twisty` (▸ closed / ▾ open), `.files-ico` (📁 / 📂), `.files-name` (bold) | Click toggles `state.expanded` and re-renders |
| File | `.files-row.files-file` (+ `.active` for the displayed file) | `.files-ico` 📄, `.files-name`; `title` = full path | Click → `navigateTo({ path })` |
| Placeholder | `.folio-files-empty` | "No markdown files" (folder open, empty tree) or "No folder open" | none |

Indentation: `8 + depth × 14` px for folders, plus 14 px for files (aligned past the twisty). After each render the `.files-file.active` row is scrolled into view with `block: 'nearest'`.

## 4. Behavior

- Start collapsed (`356cf20`): `setFolder()` clears `state.expanded`, then `expandAncestorsOf(state.path)`.
- Sync: `loadDocument()` and `onDocumentPathChanged` call `syncFileTree()` → `expandAncestorsOf()` + `renderFileTree()`; manually opened folders stay open.
- Highlight: `samePath(node.path, state.path)` after normalizing (`\` → `/`, trailing `/` removed, lower-cased).
- Visibility: `setFilesVisible(on)` sets `#folio-files.hidden`, toggles `#btn-files.active` and persists `filesVisible`. At boot: `setFilesVisible(!!settings.filesVisible && !!state.folder)`.

## 5. Styling (`src/renderer/app.css`)

| Selector group | Light | Dark (inside `@media (prefers-color-scheme: dark)`) |
|----------------|-------|------------------------------------------------------|
| `#folio-files` | `#f6f7f9` background, `#e2e4e8` right border, 13 px system UI font, no text selection | `#17181b` background, `#2a2c30` border |
| `.files-row:hover` | `#e9ebef` | `#24262b` |
| `.files-file.active` / `.files-name` | `#dbe6fb` / `#0a3b82`, weight 600 | `#24304d` / `#9db4ff` |
| `#folio-link-hint` | Absolute, `left: 0; bottom: 0; z-index: 20`, `max-width: min(80%, 640px)`, `#f6f7f9` background, top and right border, top-right radius 5 px, 11.5 px font, `white-space: nowrap`, ellipsis, `pointer-events: none` | `#17181b` background, `#2a2c30` border, `#9aa0aa` text |

`app.css` loads before the `link.folio-theme` layers, and Appearance flips `prefers-color-scheme` through `nativeTheme` (004), so both palettes follow Light/Dark/System without per-theme rules.

## 6. Settings keys (`src/store.js` `DEFAULTS`)

| Key | Type | Default | Contract |
|-----|------|---------|----------|
| `folder` | `string \| null` | `null` | Absolute path of the last opened folder; `null` after Close Folder. Not read at startup since `5c48052`. |
| `filesVisible` | `boolean` | `false` | Last explorer visibility. Not read at startup since `5c48052`. |

Both live in `folio-settings.json` in Electron `userData`; unknown or missing keys fall back to `DEFAULTS`.
