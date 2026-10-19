# Data Model: Themed Markdown Viewer & Source Editor

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Folio has no database. The "data" of this feature is the open document's state, which is split between
the main process and the page, the persisted preferences, and a few derived values. Names below are the
real identifiers in `src/`.

## 1. Session: per-window document state (`Session` in `src/main.js`)

At `bd8f5ef` these were module-level variables (`mainWindow`, `currentPath`, `currentName`, `isDirty`,
`forceClose`). `8062af5` moved them onto one `Session` per window (owned by 007) and added the watcher
fields.

| Field | Type | Default | Rules |
|---|---|---|---|
| `currentPath` | `string \| null` | `null` | Absolute path of the open file; `null` means untitled. Set by `loadFile()`, by `openAsDocument()` in `get-init`, and by `doSaveAs()`. Cleared by `doNew()` and `loadBuiltinDoc()`. |
| `currentName` | `string` | `'Welcome'` | Display name: the file's basename, or `'Untitled'` (New), `'Welcome'` or `'Markdown Formatting Tour'`. Used by the title and as the Save As / Export default name. |
| `isDirty` | `boolean` | `false` | Mirrors the page's dirty flag through `dirty-changed`. Forced to `false` on every load, successful save and reload. Read by `confirmDiscardIfDirty()` and `onExternalChange()`. |
| `forceClose` | `boolean` | `false` | Set after the unsaved prompt has allowed a close, so the re-issued `close` passes straight through. |
| `watchedPath` | `string \| null` | `null` | File currently polled with `fs.watchFile`. |
| `watchListener` | `function \| null` | not set until `watchCurrentFile()` | Listener handle passed to `fs.unwatchFile()`. |
| `lastMtimeMs` | `number` | `0` | Last modification time seen. Refreshed after Folio's own saves and reloads, so they are not treated as external changes. |

Fields owned by other specs: `win`, `id` and `windowLabel` (007); `currentFolder`, `history` and
`historyIndex` (005); `pendingOpenPath` and `pendingOpenFolder` (003/005).

## 2. Page document state (`state` in `src/renderer/renderer.js`)

| Field | Type | Default | Rules |
|---|---|---|---|
| `docText` | `string` | `''` | Document text while the rendered page is showing. In source mode the editor is authoritative (`currentText()`); its text is copied back to `docText` when source mode is left. |
| `savedText` | `string` | `''` | Baseline for the unsaved-changes comparison. Set by `loadDocument()` (open, new, reload, bundled guide) and by `markSaved()` on `saved`. |
| `path` | `string \| null` | `null` | Mirrors `Session.currentPath`, updated by `document-path-changed`. |
| `baseUrl` | `string \| null` | `null` | `file://` URL of the document file, used to resolve relative images (`6bf8c90`). `null` for New and for the Help guides. |
| `sourceMode` | `boolean` | `false` | Whether the source editor is showing. Persisted and restored at boot. |
| `outlineVisible` | `boolean` | `false` | Whether the outline sidebar is showing. Persisted, but forced to `false` at startup since `5c48052` (003). |
| `zoom` | integer | `0` | Zoom step, clamped to −5…15 (see §6). Persisted and restored. |
| `dirty` | `boolean` | `false` | `currentText() !== savedText`, recomputed on every editor change and reported through `setDirty()` only when it flips. |
| `themesBaseUrl` | `string` | `''` | `file://` URL of the `themes/` folder (from `get-init`). |
| `theme` → `themeFiles` | `string` → `string[]` | from `get-init` | At 001, one theme file name (`applyTheme(themeFile)`). Since 004, an ordered list of layers. |

## 3. Persisted preferences (`DEFAULTS` in `src/store.js`)

The keys this feature introduced. The full schema, with types, validation and the legacy migration,
is in [contracts/settings-schema.md](./contracts/settings-schema.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `theme` | `string` | `'fluent.css'` | 001's single theme file. Migrated to `styleFamily`, `appearance` and `pageWidth`, then deleted, by 004 (`migrateLegacyTheme`). |
| `recentFiles` | `string[]` | `[]` | See §4. |
| `window` | `{ width: number, height: number }` | `{ width: 1100, height: 820 }` | Written on close (`persistWindowBounds`). Merged one level deep with the defaults on load. |
| `sourceMode` | `boolean` | `false` | Restored at launch. |
| `outlineVisible` | `boolean` | `false` | Persisted; not restored since `5c48052`. |
| `zoom` | integer | `0` | Restored at launch. |

## 4. Recent files list (`recentFiles`)

- **Shape**: ordered array of absolute file paths, most recent first.
- **Validation**: `addRecent(filePath)` ignores empty values, removes any existing copy of the path,
  inserts it at the front, and truncates the list to `MAX_RECENT = 10`.
- **Written by**: `loadFile()` (Open…, Open Recent, and 005's navigation), `doSave()`, `doSaveAs()` and
  `get-init` launch targets (003). **Not written** by reloads or by the bundled guides.
- **Cleared by**: File ▸ Open Recent ▸ Clear Recent (`clearRecent()`).
- **Stale entries**: never pruned automatically. Opening a missing file shows an error and leaves the
  entry in place.

## 5. Bundled document registry (`BUILTIN_DOCS` in `src/main.js`, `9c3abe5`)

| Key | File (`samples/`) | Display name | Opened by |
|---|---|---|---|
| `welcome` | `welcome.md` | `Welcome` | the `get-init` fallback when there is no launch target; Help ▸ Welcome |
| `formatting-tour` | `formatting-tour.md` | `Markdown Formatting Tour` | Help ▸ Markdown Formatting Tour |

These files are resolved with `builtinDocPath(file)`, which works inside `app.asar`. They always load
as untitled documents (`currentPath = null`), so Save becomes Save As. If `welcome.md` cannot be read
at launch, a hard-coded stub (`# Welcome to Folio …`) is shown instead.

## 6. Derived values

| Value | Where | Definition |
|---|---|---|
| Document statistics | `computeStats()` | `words` = count of `/[^\s]+/g` matches; `chars` = `[...text].length` (code points, including whitespace); `lines` = `text.split(/\r\n\|\r\|\n/).length`, or 0 for empty text; `readMin` = `max(1, round(words / 200))`. Shown as `N words · N chars · N lines · ~N min read` with singular labels for 1 and `toLocaleString()` digit grouping. |
| Front matter | `splitFrontMatter()` | `^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n\|$)` on the full text. The match is removed from the body and rendered escaped as `<pre class="md-front-matter">` before the body HTML. |
| Zoom factor | `applyZoom()` | `factor = clamp(1 + 0.1 × zoom, 0.5, 2.5)`, applied as CSS `zoom` on `#folio-root` and exposed as `--folio-zoom` (`664668d`). Steps −5…15 give 21 levels from 50% to 250%. |
| PDF page size | `pageSizeForTheme()` (`bd8f5ef`) → `pageSizeForWidth()` (004) | `'Letter'` when the active theme name contains "letter" (001), or when `pageWidth === 'letter'` (004); otherwise `'A4'`. |
| Suggested names | `doSaveAs()`, `doExportPDF()` | Save As: `currentPath`, or `"<currentName>.md"`. Export: `currentPath` with its extension replaced by `.pdf`, or `"<currentName>.pdf"`. |

## 7. State transitions

### 7.1 Document identity

```text
            File ▸ New ──────────────► Untitled("Untitled")
            Help ▸ guide ────────────► Untitled("Welcome" | "Markdown Formatting Tour")
launch (no target) ──────────────────► Untitled("Welcome")
Untitled(name) ── Save / Save As ────► File(path)        [title, recent, baseUrl, watcher updated]
File(path) ──── Save As ─────────────► File(newPath)     [watcher moves to newPath]
any ─────────── Open… / Open Recent ─► File(path)        [Open… is guarded; Open Recent is NOT (gap)]
File(path) ──── Reload / external ───► File(path)        [same identity, text replaced, scroll kept]
```

### 7.2 Unsaved state

```text
Clean ── edit makes text ≠ savedText ──────────────────────► Dirty   (title gains "• ")
Dirty ── edit/undo makes text == savedText ────────────────► Clean
Dirty ── Save succeeds ────────────────────────────────────► Clean   (savedText := text)
Dirty ── Save fails / Save As cancelled ───────────────────► Dirty   (pending action aborted)
Dirty ── guarded action → prompt:
           Save (succeeds) → action runs → Clean
           Don't Save      → action runs → Clean (edits discarded)
           Cancel          → nothing changes → Dirty
Dirty ── external change → prompt: Reload → Clean (disk text) | Keep My Changes → Dirty
Clean ── external change ──────────────────────────────────► Clean   (silent reload)
```

### 7.3 View mode

```text
Rendered ── Ctrl/Cmd+/ | Source button ──► Source   (body.typora-sourceview-on added; editor gets docText + focus)
Source   ── Ctrl/Cmd+/ | Exit Source ────► Rendered (docText := editor text; page re-rendered; class removed)
Source   ── Export to PDF ───────────────► Rendered (prepare-export)
launch   ── settings.sourceMode = true ──► Source
```

### 7.4 File watch lifecycle

```text
Unwatched ── loadFile / get-init file / Save As ──► Watching(path, lastMtimeMs = stat.mtimeMs)
Watching  ── New / bundled guide / window closed ─► Unwatched
Watching  ── poll: mtime == 0 or == lastMtimeMs ──► Watching (ignored)
Watching  ── poll: new mtime ─────────────────────► lastMtimeMs := mtime → onExternalChange()
Watching  ── own Save / reload ───────────────────► lastMtimeMs := stat after write/read
```
