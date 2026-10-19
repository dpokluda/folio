# Contract: `window.folioAPI` Channels (Page ↔ Main Process)

**Feature**: [001 spec](../spec.md) | **Source**: `src/preload.js` (contextBridge), `src/main.js` (`ipcMain` handlers, `send()`, `ask()`), `src/renderer/renderer.js` (`boot()`, `handleCommand()`, `handleMainRequest()`)

The page runs with `contextIsolation: true` and `nodeIntegration: false`, and it reaches the main
process **only** through the members below, all exposed by `contextBridge.exposeInMainWorld('folioAPI', …)`.
This contract covers the members this feature introduced. Members owned elsewhere: `navigate`
(005), `searchFiles` (006), `onOpenFolder` (005), `onAppearanceChanged` (010/011). Since `8062af5`,
the document-related handlers (`get-init`, `dirty-changed`) resolve the calling window's `Session` from
`event.sender` (`sessionFor()`, owned by 007) rather than trusting state supplied by the page;
`state-changed` and `open-external` touch only app-wide preferences or the validated URL.

## Page → main

| Member | Channel | Kind | Payload | Validation and handling | Introduced |
|---|---|---|---|---|---|
| `getInit()` | `get-init` | invoke | none | Returns the **InitPayload** below. Opens a pending launch target (003/005) or falls back to the Welcome document, and seeds the watcher and recent list for a file. | `bd8f5ef` |
| `setDirty(value)` | `dirty-changed` | send | `boolean` | Coerced with `!!`. Updates `Session.isDirty` and the title (`• ` prefix). | `bd8f5ef` |
| `setState(state)` | `state-changed` | send | `{ sourceMode?, outlineVisible?, zoom? }` | Each key is persisted only when it has the right type: `sourceMode` and `outlineVisible` must be `boolean`, `zoom` must be a `number`. Other keys are ignored. 005 and 008 later add `filesVisible` and `lineNumbers`. | `bd8f5ef` |
| `openExternal(url)` | `open-external` | send | `string` | Passed to `shell.openExternal` **only** if it matches `/^https?:\/\//i`, otherwise silently ignored. 005's `mailto:` forwarding is therefore a no-op. | `bd8f5ef` |

## Main → page events

| Member | Channel | Payload | Page behavior | Introduced |
|---|---|---|---|---|
| `onCommand(cb)` | `command` | `{ name }` | 001 names: `toggle-source`, `toggle-outline`, `zoom-in`, `zoom-out`, `zoom-reset`. Other names belong to other specs (`find`, `find-in-files` → 006; `toggle-files` → 005; `toggle-line-numbers`, `format`, `toast` → 008). | `bd8f5ef` |
| `onLoadDocument(cb)` | `load-document` | **DocumentPayload** (below) | `loadDocument()`: reset `savedText`, clear the dirty flag, render (or fill the editor), and keep or reset the scroll position. | `bd8f5ef` |
| `onSetTheme(cb)` | `set-theme` | 001: theme file name (`string`); since 004: `{ files: string[] }` | 001 set `<link id="theme-style">.href`; 004 rebuilds the `link.folio-theme` stack. | `bd8f5ef` |
| `onSaved(cb)` | `saved` | none | `markSaved()`: `savedText := currentText()`, then `setDirty(false)`. | `bd8f5ef` |
| `onDocumentPathChanged(cb)` | `document-path-changed` | `{ path, baseUrl }` | After Save As, update `state.path` and `state.baseUrl`, then re-render the page (when not in source mode) so relative images resolve against the new folder. | `bd8f5ef` (`baseUrl` added in `6bf8c90`) |

## Main → page requests (`8062af5`)

| Member | Request channel | Response channel | Request | Response |
|---|---|---|---|---|
| `onRequest(handler)` | `folio-request` | `folio-response` | `{ id: number, kind: 'content' \| 'prepare-export' }` | `{ id, value }`. `content` returns `currentText()` (a string). `prepare-export` leaves source mode and resolves `true`; since `1ce68e0` it also waits for diagrams (010). A handler that throws replies `null`. |

Main-side `ask(session, kind, { timeoutMs, fallback })`:

- Ids increase monotonically, and pending entries live in `pendingRequests`. A response whose id is
  unknown or has expired is ignored.
- `content`: timeout 4000 ms, fallback `null`. A `null` result aborts Save and Save As without
  writing anything, and the function returns `false`.
- `prepare-export`: fallback `true`. The timeout was 4000 ms in `8062af5` and has been 20000 ms since
  `1ce68e0`.
- This round trip replaced `bd8f5ef`'s `webContents.executeJavaScript('window.folio.getContent()')` and
  `prepareForExport()`, which ran in the page's main world and bypassed context isolation.

## Payload shapes

**InitPayload** (current shape; the 001 shape is noted in brackets):

```text
{
  themesBaseUrl: string,                 // file:// URL of themes/ (trailing separator)
  themeFiles: string[],                  // [001: themes: string[], theme: string]
  settings: {
    sourceMode: boolean,                 // restored
    outlineVisible: false,               // always false since 5c48052 (003) [001: stored value]
    zoom: number,                        // restored
    filesVisible: boolean,               // 005
    lineNumbers: boolean                 // 008
  },
  folder: object | null,                 // 005
  document: DocumentPayload
}
```

**DocumentPayload** (`load-document`, `get-init.document`):

| Field | Type | Present when |
|---|---|---|
| `path` | `string \| null` | always; `null` for untitled documents |
| `content` | `string` | always (the UTF-8 file text, `''` for New) |
| `name` | `string` | bundled guides and the launch Welcome ("Welcome", "Markdown Formatting Tour") |
| `baseUrl` | `string \| null` | file-backed documents and the launch Welcome (`pathToFileURL(path).href`) |
| `preserveScroll` | `true` | in-place reloads (live reload, Reload from Disk) |
| `anchor` | `string \| null` | link navigation (005) |

## Not exposed (by design)

There is no generic file-system, shell, eval or `require` bridge. The page cannot read or write files,
cannot open arbitrary URLs or paths, and cannot run code in the main process. Every capability is one
of the narrow members above (constitution Principle III).
