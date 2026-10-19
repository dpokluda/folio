# Data Model: Folder Mode, Link Navigation & Back/Forward History

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-14 (reconstructed 2026-10-18)

The feature keeps no database and writes no files of its own. Its state is per-window session state in the main process, a snapshot of the folder tree in the renderer, two settings keys, and identifiers derived from the rendered document. Locations are cited per entity.

## 1. Session: folder and history fields

Lives on `class Session` in `src/main.js` (one instance per window, looked up with `sessionFor(event.sender)` or `focusedSession()`; the class itself is specified by [007](../007-multiple-windows/spec.md)).

| Field | Type | Default | Set by | Rules |
|-------|------|---------|--------|-------|
| `currentFolder` | `string \| null` | `null` | `openFolder()`, `get-init` (folder launch), cleared by `doCloseFolder()` | Absolute path of the open root folder. Drives `hasFolder` (File > Close Folder enablement) and Find in Files (006). |
| `pendingOpenFolder` | `string \| null` | `null` | `createWindow({ folder })` (003/007) | Consumed once by `get-init`; if it is no longer a directory the window falls back to Welcome. |
| `history` | `Array<HistoryEntry>` | `[]` | `recordHistory()`, `resetHistory()` | Ordered oldest to newest; only absolute paths of real files, never untitled documents. |
| `historyIndex` | `number` | `-1` | `recordHistory()`, `resetHistory()`, `navigateHistory()` | `-1` if and only if `history` is empty; otherwise `0 ≤ historyIndex < history.length`. |

Related fields owned by 001 and used here: `currentPath` (the displayed file, `null` when untitled), `isDirty` (input to `confirmDiscardIfDirty()`).

### HistoryEntry

| Field | Type | Rules |
|-------|------|-------|
| `path` | `string` | Absolute path of a Markdown file that was displayed. May lie outside `currentFolder`. |
| `anchor` | `string \| null` | Fragment used to reach the file (without `#`, still percent-encoded); `null` when none. Updated in place when the same file is displayed again as the current entry. |

## 2. Explorer tree

Produced by `scanFolder(dir, depth = 0)` in `src/folder.js`, sent in the `open-folder` payload and the `get-init` `folder` field, held in renderer `state.tree`.

```text
TreeNode = DirNode | FileNode
DirNode  = { name: string, path: string, type: 'dir',  children: TreeNode[] }
FileNode = { name: string, path: string, type: 'file' }
```

Validation rules (enforced while scanning):

- `name` never starts with `.`; a `DirNode` name is never in `SKIP_DIRS` (`node_modules`, `.git`, `.obsidian`, `.vscode`, `.idea`).
- A `FileNode` passes `isMarkdownFile()`: lower-cased extension in `MD_EXTS` (`.md`, `.markdown`, `.mdown`, `.mkd`, `.markdn`, `.mdtext`, `.mdtxt`).
- A `DirNode` exists only if `children.length > 0` (pruned bottom-up).
- Directories are entered only while `depth < MAX_TREE_DEPTH` (16); the root is depth 0.
- Each level lists all `DirNode`s, then all `FileNode`s, each sorted with `localeCompare(…, undefined, { numeric: true, sensitivity: 'base' })`.
- Entries whose `Dirent` is neither a directory nor a file (including symbolic links) are ignored; an unreadable directory yields `[]`.

The tree is a snapshot: it is rebuilt only by `openFolder()` or a folder launch.

### Folder payload

`{ root: string, name: string, tree: TreeNode[] }`, where `name = path.basename(root) || root` (the root of a drive keeps its full path). `null` means "no folder" (Close Folder).

## 3. Index and entry documents

| Concept | Source | Rule |
|---------|--------|------|
| `INDEX_DOC_NAMES` | `src/folder.js` (`8062af5`) | `['_index.md', 'readme.md', 'index.md']`, compared against lower-cased file names. |
| Entry document | `entryDocFor(tree)` | First top-level `FileNode` matching `INDEX_DOC_NAMES` in list order; else `firstMarkdownIn(tree)`: the first `FileNode` of a level, otherwise recurse into its `DirNode`s in order; `null` for an empty tree. |
| Folder index document | `folderIndexDoc(dir)` | First regular file in `readdirSync(dir)` whose lower-cased name matches `INDEX_DOC_NAMES` in list order; `null` if none or unreadable. No fallback. |

## 4. Navigation request and target

### NavRequest (renderer → main, `navigate` channel)

| Variant | Shape | Sender |
|---------|-------|--------|
| Explorer click | `{ path: string }` | `renderTreeNode()` row click, Find in Files result (006) |
| Preview link | `{ href: string, fromPath: string \| null }` | `wireLinks()`; `href` is the raw attribute, `fromPath` is renderer `state.path` |

### NavTarget (result of `resolveNavTarget()` in `src/folder.js`)

| `kind` | Fields | Produced when | Main-process action |
|--------|--------|---------------|---------------------|
| `markdown` | `path`, `anchor` | Target is a Markdown file, or a folder with an index document | `confirmDiscardIfDirty()` → `loadFile(path, anchor)` |
| `folder-empty` | `path` | Target is a folder without an index document | Info dialog "Nothing to display for this folder." |
| `external` | `path` | Target exists and is neither a folder nor Markdown | `openExternalTarget()` |
| `missing` | `path` | `statSync()` fails | Warning "Cannot find the linked item." |
| `null` | none | Pure `#anchor`; relative `href` with no `fromPath`; unparsable `file://` URL; payload without `path` or `href` | Nothing (`{ ok: false }`) |

Resolution order for `href`: split at the first `#` into `href` and `anchor`; empty `href` → `null`; `file://` → `fileURLToPath()`; otherwise `decodeURIComponent()` (raw on failure), `/` → `path.sep`, absolute as-is, else `path.resolve(path.dirname(fromPath), decoded)`.

## 5. Renderer explorer state

Fields of `state` in `src/renderer/renderer.js`:

| Field | Type | Default | Rules |
|-------|------|---------|-------|
| `folder` | `{ root, name } \| null` | `null` | Set and cleared by `setFolder(payload, show)`. |
| `tree` | `TreeNode[]` | `[]` | Replaced on every `open-folder`. |
| `expanded` | `Set<string>` | empty | Reset on every `setFolder()`; `expandAncestorsOf(state.path)` adds the displayed file's ancestors; folder-row clicks toggle membership; never pruned while navigating. |
| `filesVisible` | `boolean` | `false` | `setFilesVisible()` mirrors it to `#folio-files[hidden]` and the `#btn-files.active` class and persists it through `state-changed`. |
| `pendingAnchor` | `string \| null` | `null` | Taken from `load-document.anchor`; applied after `renderPreview()` (preview only), then cleared. |

`state.path` and `state.baseUrl` (owned by 001) identify the displayed document for highlighting (`samePath()`: separators normalized, trailing slashes removed, lower-cased) and for hover-hint resolution.

## 6. Settings keys

`DEFAULTS` in `src/store.js`, persisted to `folio-settings.json` in Electron `userData`:

| Key | Type | Default | Written by | Read by |
|-----|------|---------|------------|---------|
| `folder` | `string \| null` | `null` | `openFolder()`, `get-init` folder launch, `doCloseFolder()` (`null`) | Nobody since `5c48052`; `e2e2877` read it to restore the folder at launch. |
| `filesVisible` | `boolean` | `false` | `openFolder()` (`true`), `doCloseFolder()` (`false`), `state-changed` from `persistState()` | Nobody since `5c48052`; the initial visibility comes from `get-init` (`true` only for a folder launch). |

No migration is needed: both keys are new in `e2e2877`, and `Store` merges missing keys from `DEFAULTS`.

## 7. Derived identifiers

| Item | Rule | Uniqueness |
|------|------|------------|
| Heading id | Existing `id` kept; otherwise `githubSlug(text)`: lower-case, trim, remove `[^\w\s-]`, whitespace runs → `-`; empty → `section` | Per render: the first use of a base keeps it, later ones get `-1`, `-2`, … |
| Fragment match | `scrollToAnchor(raw)`: `decodeURIComponent(raw)` → `getElementById(id)` → `getElementById(githubSlug(id))` → first `h1`–`h6` whose `githubSlug(textContent)` equals the slug | First match wins; no match → no scroll |

## 8. State transitions

### Folder lifecycle (per window)

```text
NoFolder ──Open Folder… (guard OK, folder picked)──▶ FolderOpen(root)
FolderOpen(root) ──Open Folder… (another folder)──▶ FolderOpen(root2)   tree, expansion and history reset
FolderOpen(root) ──Close Folder (guard OK)──────────▶ NoFolder           Welcome shown, history cleared
any ──guard Cancel / picker cancelled──────────────▶ unchanged
window start with folder argument (003) ──────────▶ FolderOpen(arg)    explorer visible
```

### Explorer visibility

Hidden at window start unless the window was created for a folder. Open Folder → visible; Close Folder → hidden; View > Toggle File Explorer, `Ctrl+Alt+E` (Windows/Linux) or the **Files** button → flips, whether or not a folder is open.

### History (per window)

| Event | Effect on `history` / `historyIndex` |
|-------|--------------------------------------|
| Window starts on file F (folder entry or file argument) | `[F]`, `0` |
| Window starts on Welcome | `[]`, `-1` |
| `loadFile(P)` with `record: true` (link, explorer, Open…, Open Recent, Find in Files result, folder entry document), P ≠ current entry | Drop entries after `historyIndex`, push `{ P, anchor }`, `historyIndex = length - 1` |
| Same, P = current entry | Only `history[historyIndex].anchor` updated |
| Open Folder | `[]`, `-1`, then the entry document is recorded → `[E]`, `0` (stays empty if the folder has no Markdown) |
| File > New, Help > Welcome, Help > Markdown Formatting Tour, Close Folder | `[]`, `-1` |
| Back / Forward (target file exists, guard OK) | `historyIndex ± 1`, `loadFile(entry.path, entry.anchor, { record: false })` |
| Back / Forward (target file missing) | Unchanged; warning dialog |
| Back / Forward (guard Cancel) | Unchanged |
| In-page `#fragment` click, live reload, Reload from Disk, Save, Save As | Unchanged |

Menu enablement is derived on every `rebuildMenu()` (after each load, on window focus, after Open and Close Folder): `canGoBack = historyIndex > 0`; `canGoForward = historyIndex ≥ 0 && historyIndex < history.length - 1`; `hasFolder = currentFolder != null`.
