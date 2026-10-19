# Data Model: Source Formatting Commands, Line Numbers & Copy File Path

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This page lists the state this feature introduces or changes, and where each piece lives. Folio has no database. State is held in renderer variables, on per-window `Session` objects in the main process, and in the JSON settings file owned by `src/store.js`.

## 1. FormatKind (enumeration)

The `kind` string identifies a Format command end to end. It is defined by the `fmt(label, accel, kind)` items in `src/menu.js` and passed through `actions.format(kind)` in `src/main.js`. The renderer turns it into an edit in `applyFormat(kind)`, using `INLINE_FORMATS`, in `src/renderer/renderer.js`. The keyboard path uses `formattingKeymap`, which calls the same transforms directly.

| `kind` | Menu label | Menu accelerator (display) | Editor key | Behavior class | Marks / template |
|---|---|---|---|---|---|
| `bold` | Bold | `CmdOrCtrl+B` | `Mod-b` | inline wrap, toggles | `**` … `**` |
| `italic` | Italic | `CmdOrCtrl+I` | `Mod-i` | inline wrap, toggles | `*` … `*` |
| `underline` | Underline | `CmdOrCtrl+U` | `Mod-u` | inline wrap, toggles | `<u>` … `</u>` |
| `strikethrough` | Strikethrough | `CmdOrCtrl+Shift+X` | `Mod-Shift-x` | inline wrap, toggles | `~~` … `~~` |
| `code` | Inline Code | `CmdOrCtrl+E` | `Mod-e` | inline wrap, toggles | `` ` `` … `` ` `` |
| `codeblock` | Code Block | `CmdOrCtrl+Shift+E` | `Mod-Shift-e` | fenced block, insert only | ```` ``` ```` fence lines |
| `link` | Link | `CmdOrCtrl+K` | `Mod-k` | link template, insert only | `[` text `](` `)` |
| `math` | Inline Math | `CmdOrCtrl+M` | `Mod-m` | inline wrap, toggles | `$` … `$` |
| `mathblock` | Math Block | `CmdOrCtrl+Shift+M` | `Mod-Shift-m` | fenced block, insert only | `$$` fence lines |
| `h1` … `h6` | Heading 1 … Heading 6 | `CmdOrCtrl+1` … `CmdOrCtrl+6` | `Mod-1` … `Mod-6` | heading level, toggles per line | `#` × N + one space |

**Validation rules**

- Kinds come only from the menu template built in the main process. The renderer never sends a kind.
- `applyFormat` ignores unknown kinds: no branch matches, so it only refocuses the editor.
- Headings are recognized by `/^h[1-6]$/`, and the level is `Number(kind.slice(1))`.

## 2. Selection (source editor)

| Field | Type | Rules |
|---|---|---|
| `from` | integer ≥ 0 | Start offset in the document. |
| `to` | integer ≥ `from` | End offset. `from === to` means a caret (empty selection). |

- **Cardinality**: exactly one range. `EditorState.allowMultipleSelections` is not enabled, and CodeMirror's default is a single range. The transforms still use `changeByRange` or iterate `selection.ranges`, so they would act on every range if multiple selections were ever turned on.
- **Owner**: the CodeMirror `EditorView` (`editor`) in `src/renderer/renderer.js`, which is created lazily on the first switch to source mode.
- How each command repositions the selection is specified in [contracts/formatting-commands.md](./contracts/formatting-commands.md).

## 3. Inline formatting state (a selected span) — transitions

`toggleWrap(view, before, after)` checks these rows in order for the current range:

| Current state | Condition | Result | New selection |
|---|---|---|---|
| Wrapped, marks outside the selection | `from !== to`, the `before.length` characters before `from` equal `before`, and the `after.length` characters after `to` equal `after` | Both marks deleted (Plain) | Same text: `from - before.length` … `to - before.length` |
| Wrapped, marks inside the selection | Selected text has length ≥ `before.length + after.length`, starts with `before` and ends with `after` | Marks stripped (Plain) | Inner text |
| Plain (non-empty) | Otherwise | `before` + text + `after` (Wrapped) | Original text, now inside the marks |
| Caret | `from === to` and no rule above matched | `before` + `after` inserted (EmptyPair) | Caret between the marks |
| EmptyPair, caret inside | `from === to` | Another pair is nested; there is no toggle with an empty selection | Caret in the innermost pair |

## 4. Heading level (per line) — transitions

| Field | Type | Rules |
|---|---|---|
| `level` | integer 0–6 | 0 means a paragraph. Otherwise it is the number of `#` in a prefix matching `^(#{1,6})[ \t]+`. |

For Heading N, applied to every line from `doc.lineAt(from)` to `doc.lineAt(to)`, with duplicates removed:

- `level == N` → 0: the prefix and all its following spaces or tabs are removed.
- `level != N` → N: the prefix is replaced by, or prepended as, `#` × N + one space.

All lines change in one transaction with `scrollIntoView: true`, and the selection is mapped through the changes.

## 5. Line-number preference

| Location | Name | Type | Default | Notes |
|---|---|---|---|---|
| `src/store.js` `DEFAULTS` | `lineNumbers` | boolean | `false` | Persisted in `folio-settings.json`. Comment: "optional source-editor gutter line numbers". |
| `get-init` reply (`src/main.js`) | `settings.lineNumbers` | stored value | — | The renderer coerces it with `!!`. |
| `state-changed` handler (`src/main.js`) | `state.lineNumbers` | boolean | — | Stored only if `typeof === 'boolean'`, then `rebuildMenu()` runs. |
| `rebuildMenu()` → `buildMenu({ lineNumbers })` | `lineNumbers` | boolean (`!!store.get('lineNumbers')`) | — | Drives the `checked` state of View > Show Line Numbers. |
| Renderer `state` (`src/renderer/renderer.js`) | `state.lineNumbers` | boolean | `false` | Restored in `boot()` before the editor is created. |
| Renderer | `lineNumbersCompartment` | CodeMirror `Compartment` | `[]` or `lineNumbers()` | Mounted in `createEditor()` and reconfigured by `setLineNumbers(on)`. |

**State flow**: click on View > Show Line Numbers → `actions.toggleLineNumbers()` → `command { name: 'toggle-line-numbers' }` to the focused window → `setLineNumbers(!state.lineNumbers)` → the compartment is reconfigured (if the editor exists) and `persistState()` runs → `state-changed { …, lineNumbers }` → `store.set('lineNumbers', …)` → `rebuildMenu()`.

**Scope and lifecycle**: The preference is app-wide, like the other view toggles, and survives relaunches. Each window keeps its own renderer copy, so open windows can diverge from the stored value until they toggle or reopen (see research.md, finding 9). If the key is missing from the settings file, `{ ...DEFAULTS, ...parsed }` supplies `false`. An unreadable file falls back to `DEFAULTS`. No migration is needed.

## 6. Document path (existing Session field, read here)

| Location | Field | Type | Notes |
|---|---|---|---|
| `Session` (`src/main.js`) | `currentPath` | absolute path string, or `null` | `null` for untitled documents: New, the Welcome document and the Markdown Formatting Tour. Set by open, link or explorer navigation, CLI launch and Save As. |
| `rebuildMenu()` | `hasFile` | boolean (`!!(session && session.currentPath)`) | Enables File > Copy File Path (and Reload from Disk, see 001). Refreshed on window focus, open, New, built-in documents and Save As. |

**Copy flow**: `actions.copyPath()` → `copyDocumentPath()`:

1. `focusedSession()` returns `null` → nothing happens.
2. `currentPath === null` → toast "Save the document first to copy its path".
3. Otherwise → `clipboard.writeText(currentPath)`, then toast "Path copied to clipboard".

The path is never supplied by the renderer, and the document's dirty state is not touched.

## 7. Transient notice (toast)

| Part | Location | Details |
|---|---|---|
| Element | `src/renderer/index.html` | `<div id="folio-toast" hidden role="status" aria-live="polite">` inside `#folio-content` |
| Timers | `src/renderer/renderer.js` | `toastHideTimer` (1600 ms) and `toastClearTimer` (220 ms) |
| Visual state | `src/renderer/app.css` | The `.folio-toast-show` class sets opacity 1 and `translate(-50%, 0)`. The `[hidden]` attribute sets `display: none`. |

**State machine**:

```text
Hidden ──showToast(text)──▶ Showing (hidden removed, .folio-toast-show, 0.18 s fade/slide in)
Showing ──1600 ms──▶ Fading (.folio-toast-show removed, 0.18 s fade out)
Fading ──220 ms──▶ Hidden (hidden = true)
Any state ──showToast(text)──▶ Showing (both timers cleared, transition restarted via reflow)
```

**Messages** (fixed strings):

| Text | Source |
|---|---|
| "Path copied to clipboard" | main |
| "Save the document first to copy its path" | main |
| "Switch to Source mode (Ctrl/Cmd+/) to format text" | renderer |

**Validation**: empty or missing text is ignored, and text is assigned with `textContent`, never parsed as HTML.

## 8. Command messages (main → renderer)

These are new payloads on the existing `command` channel, all handled by `handleCommand(payload)`. This feature changed the handler to take the whole payload object instead of just its `name`.

| Payload | Sent by | Effect |
|---|---|---|
| `{ name: 'format', format: FormatKind }` | `actions.format(kind)` via `sendFocused` | `applyFormat(format)` |
| `{ name: 'toggle-line-numbers' }` | `actions.toggleLineNumbers()` via `sendFocused` | `setLineNumbers(!state.lineNumbers)` |
| `{ name: 'toast', text: string }` | `copyDocumentPath()` via `send(session, …)` | `showToast(text)` |

The full channel contract is in [contracts/ipc-channels.md](./contracts/ipc-channels.md).
