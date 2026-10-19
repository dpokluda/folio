# Data Model: Mermaid Diagrams & Code Block Enhancements

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature adds **no persisted data**. `folio-settings.json` (`src/store.js`) is unchanged, and no `Session` field in `src/main.js` was added. Everything below is transient renderer state, DOM state or static lookup tables, rebuilt on every preview render or held at module scope in `src/renderer/renderer.js` and `src/renderer/highlight.js`.

## E1. Diagram source registry (per render)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `env.mermaid` | `string[]` | Created fresh as `{ mermaid: [] }` in `renderPreview()` and passed to `md.render(body, env)`. |
| element *i* | `string` | Raw content of the *i*-th ```` ```mermaid ```` fence (`token.content`, trailing newline included), pushed by the `fence` rule override. |

- **Lifetime**: One `renderPreview()` call. It is handed to `renderMermaidBlocks(env.mermaid)` and then dropped.
- **Validation**: A placeholder's index is read back with `Number(el.getAttribute('data-folio-mermaid'))`. If no string is stored at that index, the placeholder is skipped.
- **Fallback**: If `env.mermaid` is missing, mermaid fences render as ordinary (plain-text) code blocks. This cannot happen today because `renderPreview()` is the only caller of `md.render()`.

## E2. Diagram placeholder (DOM)

`<div class="folio-mermaid" data-folio-mermaid="<index>">` inside `#write`, emitted where the fence was.

| State | DOM representation | Entered when |
| ----- | ------------------ | ------------ |
| `pending` | Empty `div` | The sanitized HTML is injected (`$write.innerHTML = DOMPurify.sanitize(…)`) |
| `drawn` | `div` containing the Mermaid SVG; `bindFunctions(el)` applied if provided | `mermaid.render()` resolves, the pass is still current and the element is still connected |
| `failed` | `div.folio-mermaid.folio-mermaid-error` containing `pre.md-fences > code.cm-s-inner` (escaped source), `p.folio-mermaid-message` (escaped message) and a copy button | `mermaid.render()` throws and the pass is still current |
| `abandoned` | Left as it was; replaced wholesale by the next render's DOM | The generation changed or the element was detached |

**Transitions**: `pending → drawn | failed | abandoned`. `drawn` and `failed` are terminal for that render. A redraw replaces the whole `#write` content and starts again from `pending`. Redraws are triggered by an appearance change, a theme load, a document load, leaving source mode or a path change.

## E3. Drawing pass (module state, `src/renderer/renderer.js`)

| Field | Type | Initial | Rules |
| ----- | ---- | ------- | ----- |
| `mermaidGeneration` | integer | `0` | Incremented at the start of every `renderMermaidBlocks()` call, even when there is nothing to draw. A pass whose `gen` no longer matches stops at its next checkpoint. |
| `mermaidPending` | `Promise<void>` | `Promise.resolve()` | Set to `Promise.resolve()` when there are no placeholders or sources, otherwise to the async pass. Never rejects: a trailing `.catch` logs `[folio] mermaid render failed`. |
| diagram id | string | — | `folio-mermaid-<gen>-<n>`. `n` counts only placeholders that have a source in this pass. Mermaid's scratch element `d<id>` is removed in `finally`. |
| `prefersDark` | `MediaQueryList \| null` | — | `matchMedia('(prefers-color-scheme: dark)')`, or `null` when `matchMedia` is unavailable, in which case the light palette is used. |

## E4. Diagram configuration (derived on every pass; not persisted)

| Key | Value | Derived from |
| --- | ----- | ------------ |
| `startOnLoad` | `false` | constant |
| `securityLevel` | `'strict'` | constant (constitution Principle III) |
| `suppressErrorRendering` | `true` | constant (Folio renders its own fallback, E5) |
| `theme` | `'dark'` if `prefersDark.matches`, else `'default'` | Appearance ([004](../004-three-axis-theming/spec.md), [011](../011-system-appearance/spec.md)) |
| `fontFamily` | `getComputedStyle($write).fontFamily`; omitted if empty or on error | Style ([004](../004-three-axis-theming/spec.md)) |

## E5. Diagram failure fallback

| Field | Value | Rules |
| ----- | ----- | ----- |
| source | fence content | HTML-escaped with `md.utils.escapeHtml`; shown unhighlighted in `<pre class="md-fences"><code class="cm-s-inner">` |
| message | `err.message \|\| err.str \|\| 'Invalid diagram'` | Coerced to `String`, HTML-escaped; displayed monospace with `white-space: pre-wrap` |

## E6. Copy button (DOM + per-button timer)

Created by `addCopyButton(pre)` for each `#write pre.md-fences` whose `code` element (or the `pre` itself) has non-blank `textContent`. Creation is idempotent: a `pre` that already has a `:scope > .folio-copy` child is skipped.

| State | Icon | `title` / `aria-label` | Class | Visibility |
| ----- | ---- | ---------------------- | ----- | ---------- |
| `idle` | copy | `Copy code` | — | Shown on fence hover or `:focus-visible`; otherwise `opacity: 0` |
| `done` | check | `Copied` | `folio-copy-done` | Pinned visible (`opacity: 1`) |
| `failed` | copy | `Copy failed` | `folio-copy-failed` | Pinned visible (`opacity: 1`) |

- **Transitions**: `idle → done` when `navigator.clipboard.writeText()` resolves; `idle → failed` when it rejects. `done`/`failed` → `idle` after **1400 ms**. Activating again while confirming clears the old timer and restarts it.
- **Timer store**: `copyResetTimers: WeakMap<HTMLButtonElement, timeoutId>`, so each button times out on its own.
- **Clipboard payload**: `code.textContent` with exactly one trailing `\n` removed (`/\n$/`). It is plain text and carries none of the highlight markup.

## E7. Language mode table (`MODES`, `src/renderer/highlight.js`)

| Field | Type | Rules |
| ----- | ---- | ----- |
| key | string | The first whitespace-delimited word of the fence info string, lower-cased. There are 170 keys, looked up with an own-property check so inherited names such as `constructor` never match. |
| value | CodeMirror 5 mode object \| `null` | 78 distinct modes imported from 55 `@codemirror/legacy-modes/mode/*` files. `null` (only `php`) means plain text. |

169 of the 170 keys produce highlighting. The full grouping is in [contracts/code-fence-highlighting.md](./contracts/code-fence-highlighting.md).

## E8. Token alias table (`TOKEN_ALIASES`) and class derivation

| Field | Type | Rules |
| ----- | ---- | ----- |
| key | string | A token name returned by a mode, either CM5 style (`variable-2`) or Lezer style (`variableName.local`). There are 63 entries. |
| value | string \| `null` | The CM5 token name to emit, or `null` to emit no span (`punctuation`, `separator`, `contentSeparator`). |

`normalizeToken(raw)` resolves a name in this order: a direct alias, then the alias of its base tag (the part before the first `.`), then the base tag itself if it matches `/^[a-z][a-z0-9-]*$/i`. Anything else is dropped. `cmClass(style)` turns each space-separated part into `cm-<name>` and joins the results with spaces, exactly as CodeMirror 5 does.

## E9. Highlighter limits

| Constant | Value | Purpose |
| -------- | ----- | ------- |
| `TAB_SIZE` | `4` | `StringStream` tab size. It only affects indentation decisions, not tokens. |
| `INDENT_UNIT` | `2` | Passed to `startState()` and `blankLine()`. |
| `MAX_TOKENS_PER_LINE` | `10000` | Runaway guard: past this many tokens, the rest of the line is emitted as escaped plain text. |

## E10. Export preparation request

| Side | Behaviour |
| ---- | --------- |
| Main (`doExportPDF()` in `src/main.js`) | `ask(session, 'prepare-export', { fallback: true, timeoutMs: 20000 })`. Other request kinds keep `ask()`'s default `timeoutMs` of 4000. |
| Renderer (`handleMainRequest()`) | If in source mode, calls `setSourceMode(false)`, which re-renders and starts a new pass. Then returns `whenMermaidSettled().then(() => true)`. |
| Outcome | Resolves `true` when the pass settles, or with the `true` fallback after 20 s. The save dialog and `printToPDF` (page size from Page width) then run unchanged. |

## E11. Appearance-change notification

There is no payload. One message per open session is sent for each `nativeTheme` `updated` event. The renderer responds with `setTimeout(refreshMermaid, 0)`, which skips source mode and documents without diagrams. See [contracts/ipc-channels.md](./contracts/ipc-channels.md).

## Relationships

```text
Appearance (004/011) ──nativeTheme──► prefers-color-scheme ──► E4.theme ──► E2 drawn SVG palette
        │                                       └──► theme --color-cm-* palette ──► fence token colours (E7/E8)
        └──► E11 appearance-changed ──► refreshMermaid ──► new E3 pass
Style / Page width (004) ──► theme <link> load ──► refreshMermaid ──► E4.fontFamily
Document text (001) ──► E1 registry ──► E2 placeholders ──► E3 pass ──► drawn | failed (E5 + E6)
Every pre.md-fences with text ──► E6 copy button          Export (001) ──► E10 waits on E3.mermaidPending
```
