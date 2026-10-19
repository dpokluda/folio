# Contract: Mermaid Diagram Rendering (preview DOM, configuration, lifecycle)

**Scope**: How a ```` ```mermaid ```` fence becomes a diagram in `#write`, which hooks themes and Folio's CSS can rely on, and when diagrams are redrawn. Implemented in `src/renderer/renderer.js` and `src/renderer/app.css` (`1ce68e0`). The fallback markup was retargeted in `5c3ee89`.

## 1. Fence detection

| Rule | Detail |
| ---- | ------ |
| Trigger | Any markdown-it `fence` token (```` ``` ```` or `~~~`) where `md.utils.unescapeAll(token.info).trim().split(/\s+/)[0].toLowerCase() === 'mermaid'` |
| Examples | ```` ```mermaid ````, ```` ```Mermaid ````, ```` ```mermaid title="x" ```` → diagram. ```` ```mermaidjs ```` → ordinary code block (plain text). |
| Not covered | Indented code blocks, inline code, and raw-HTML `<pre><code class="language-mermaid">` are never treated as diagrams. |

## 2. Placeholder markup (before drawing)

```html
<div class="folio-mermaid" data-folio-mermaid="0"></div>
```

- The index points into the per-render `env.mermaid` source array (see [data-model.md](../data-model.md) E1).
- The placeholder goes through DOMPurify with the rest of the document; `data-*` attributes survive.

## 3. Drawn markup

```html
<div class="folio-mermaid" data-folio-mermaid="0">
  <svg id="folio-mermaid-<generation>-<n>" …><style>…</style> … </svg>
</div>
```

- The SVG comes from `mermaid.render(id, code)`. It is inserted after sanitization and is **not** sanitized again (see [research.md](../research.md) R1).
- The `bindFunctions(el)` that Mermaid returns is called when present.

## 4. Failure markup

```html
<div class="folio-mermaid folio-mermaid-error" data-folio-mermaid="0">
  <pre class="md-fences"><code class="cm-s-inner">ESCAPED SOURCE</code><button class="folio-copy" …></button></pre>
  <p class="folio-mermaid-message">ESCAPED PARSER MESSAGE</p>
</div>
```

- The message is `err.message || err.str || 'Invalid diagram'`. Mermaid's own error graphic is suppressed (`suppressErrorRendering: true`).
- `1ce68e0` emitted `<pre class="md-fences hljs"><code class="hljs">`; `5c3ee89` changed it to `cm-s-inner` along with the highlighter swap.
- The copy button follows [copy-button.md](./copy-button.md). It is only added when the source is non-blank.

## 5. Configuration (`initMermaid()`, run at the start of every pass)

```js
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  suppressErrorRendering: true,
  theme: prefersDark && prefersDark.matches ? 'dark' : 'default',
  ...(fontFamily ? { fontFamily } : {}),   // getComputedStyle($write).fontFamily
});
```

## 6. Lifecycle

1. `renderPreview()` renders Markdown with `env = { mermaid: [] }`, sanitizes, and injects the result into `#write`.
2. `renderMermaidBlocks(env.mermaid)` increments `mermaidGeneration` and, if any placeholders exist, starts an async pass that it stores in `mermaidPending`.
3. Placeholders are drawn **sequentially** in document order. Before applying each result, the pass checks `gen === mermaidGeneration && el.isConnected` and abandons itself otherwise.
4. Each diagram has its own `try`/`catch`. A throw becomes the failure markup (§4) and the pass moves on to the next diagram.
5. `finally` removes Mermaid's scratch element `#d<id>` from `<body>`.
6. The rest of `renderPreview()` (copy buttons, asset/link wiring, outline, stats, find) runs synchronously right after step 2, **before** diagrams finish.

## 7. Redraw triggers

| Trigger | Mechanism | Guard |
| ------- | --------- | ----- |
| Appearance change | `appearance-changed` → `setTimeout(refreshMermaid, 0)` ([ipc-channels.md](./ipc-channels.md)) | `refreshMermaid()` returns early in source mode or when `#write` has no `[data-folio-mermaid]` |
| Style / Page-width change | `applyTheme()` waits for every new `link.folio-theme` to fire `load` or `error`, then calls `refreshMermaid()` | same |
| Document load, leaving source mode, document path change, Reload from Disk | Normal `renderPreview()` | — |

`refreshMermaid()` re-runs the whole `renderPreview()`, not only the diagrams.

## 8. Export interplay

`prepare-export` resolves only after `whenMermaidSettled()` (`mermaidPending.catch(() => {})`), and the main process waits up to 20 000 ms (see [ipc-channels.md](./ipc-channels.md)). Failure markup prints as shown. Copy buttons are hidden in print.

## 9. CSS hooks (`src/renderer/app.css`)

| Selector | Rule |
| -------- | ---- |
| `#write .folio-mermaid` | `margin: 0 0 1.4em; text-align: center; overflow-x: auto;` |
| `#write .folio-mermaid > svg` | `max-width: 100%; height: auto;` |
| `#write .folio-mermaid.folio-mermaid-error` | `text-align: left;` |
| `#write .folio-mermaid .folio-mermaid-message` | Monospace (`var(--mono-font, …)`), `0.8em`, `line-height: 1.5`, `white-space: pre-wrap`, `color: #b31d28`; dark: `#f85149` |

Themes may style `.folio-mermaid` freely. The SVG carries its own colours from the Mermaid theme.

## 10. Security properties

- Diagram output is never routed through the sanitizer. It relies on Mermaid `securityLevel: 'strict'`, under which HTML in labels is encoded and click *callbacks* are not registered.
- Failure source and message are HTML-escaped before insertion.
- Known gap (code reading, not runtime-verified): links declared with `click … href` are still emitted by Mermaid and are not routed through Folio's link handling. See [research.md](../research.md) F7.
