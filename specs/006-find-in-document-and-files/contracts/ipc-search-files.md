# Contract: `search-files` Channel (`folioAPI.searchFiles`)

**Feature**: [spec.md](../spec.md) | **Data shapes**: [data-model.md](../data-model.md) §5–§7

| Property | Value |
|---|---|
| Channel | `search-files` |
| Direction | Renderer → main, request/response (`ipcRenderer.invoke` / `ipcMain.handle`). |
| Preload surface (`src/preload.js`) | `window.folioAPI.searchFiles(query: string): Promise<SearchResult>` |
| Handler (`src/main.js`) | `ipcMain.handle('search-files', (event, query) => …)` |
| Implementation (`src/folder.js`) | `searchInFolder(dir, query)`, exported along with `collectMarkdownFiles` and `invalidateSearchCache`. |
| Introduced | `e126f54`. The handler was scoped to the sender's Session in `8062af5`. |

## Request

`query`: the text of the search box with surrounding whitespace removed. The renderer
(`runFileSearch()`) never sends an empty string; for an empty box it shows the file tree without a
request. The page sends nothing else: no folder, no path, no options.

## Handler algorithm and validation (Principle III)

1. `const session = sessionFor(event.sender)`. The calling window is identified from the IPC sender,
   never from the payload.
2. If there is no `session` or `session.currentFolder` is `null`, return
   `{ query, files: [], truncated: false }`.
3. Otherwise return `searchInFolder(session.currentFolder, query)` inside `try`. If it throws, return
   `{ query, files: [], truncated: false }`.

Inside `searchInFolder(dir, query)`:

- `q = String(query == null ? '' : query).toLowerCase()`. If `q.trim()` is empty, return the empty
  result. This accepts any input type without throwing.
- The candidate files come from `markdownFilesFor(dir)`, which is
  `collectMarkdownFiles(scanFolder(dir))` behind the 4-second cache. They are therefore exactly the
  Markdown files that the explorer would list: the seven Markdown extensions, with hidden entries
  and `node_modules`, `.git`, `.obsidian`, `.vscode` and `.idea` skipped, to a depth of 16 (005).
- For each file in explorer order:
  - `lines = linesFor(file)` (the mtime-validated cache). On `null` the file is skipped.
  - Each line where `lines[i].toLowerCase().includes(q)` produces `{ line: i + 1, text: lines[i].trim().slice(0, 240) }`.
  - The file stops at 50 matches. The search stops at 1,000 total matches, or once 500 files have
    matches.
- The result is `{ query, files: [{ path, name: path.relative(dir, file), matches }], truncated: total >= 1000 }`.

## Response

```text
SearchResult {
  query:     string                 // echoed unchanged
  files:     FileResult[]           // 0..500, explorer order, only files with ≥ 1 match
  truncated: boolean                // total matches reached 1000
}
FileResult { path: string /* absolute */, name: string /* folder-relative */, matches: Match[] /* 1..50 */ }
Match      { line: number /* 1-based */, text: string /* trimmed, ≤ 240 chars */ }
```

The renderer must:

- Treat `files` as untrusted text. `renderFileResults()` writes `name`, `line` and `text` with
  `textContent` and text nodes, and creates the `<mark>` emphasis elements in code
  (`appendHighlighted()`). File content is never parsed as HTML.
- Show `No matches` (the `.folio-files-empty` class) when `files` is empty.
- Otherwise show the summary `${total} match(es) in ${files.length} file(s)` followed by
  ` (truncated)` when `truncated` is set.

## Caching semantics (`8062af5`)

| Aspect | Behaviour |
|---|---|
| File list | Reused for 4,000 ms per folder (`FILE_LIST_TTL_MS`). New files appear once the list is rebuilt. |
| File content | Reused while `fs.statSync(file).mtimeMs` is unchanged. Files saved since the last search are read again. A file deleted in the meantime fails `stat` and is skipped. |
| Folder change | Searching a different folder clears the content cache. `invalidateSearchCache()` runs in `openFolder()` and `doCloseFolder()` (`src/main.js`). |
| Sharing | The caches live at module scope and are shared by all windows, holding one folder at a time. |

## Opening a result (reuses an existing channel)

A click calls `navigate` (005) with payload `{ path: file.path }`. That handler applies
`resolveNavTarget()` and then `confirmDiscardIfDirty(session)`:

- Cancel → `{ ok: false, canceled: true }`.
- Proceed → `loadFile(session, path)`, which records history and sends `load-document`.

This feature adds no channel for opening results. The term to highlight never leaves the renderer
(`state.pendingFindQuery`).

## Security review notes (constitution gate 5)

- **Narrow purpose**: the channel is read-only, takes a single string input and can neither write,
  execute nor open anything.
- **No path input**: the root comes only from `Session.currentFolder`. Only File ▸ Open Folder or a
  folder launch target (command-line argument, second instance, macOS `open-file`) set that value,
  never page content.
- **Bounded output**: at most 1,000 matches of at most 240 characters each, in at most 500 file
  groups.
- **Failure mode**: every error becomes an empty result, so no stack traces or file contents leak
  into dialogs.
