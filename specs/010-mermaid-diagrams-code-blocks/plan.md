# Implementation Plan: Mermaid Diagrams & Code Block Enhancements

**Branch**: `010-mermaid-diagrams-code-blocks` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-mermaid-diagrams-code-blocks/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `1ce68e0` (2026-08-12) and `5c3ee89` (2026-08-20, code-fence highlighting portion only; its `disable-lcd-text` switch and the removal of the `-webkit-text-stroke` weight compensation belong to [001](../001-markdown-viewer-editor/spec.md)). The plan describes the design as implemented.

## Summary

Folio draws ```` ```mermaid ```` fences as diagrams, puts a copy button on every code fence, and colours fenced code exactly as Typora does.

- **Diagrams** (`1ce68e0`): A markdown-it `fence` rule override diverts every fence whose info string starts with `mermaid` into an empty placeholder (`<div class="folio-mermaid" data-folio-mermaid="N">`). It collects the source in the per-render `env`. Once DOMPurify-sanitized HTML is in `#write`, `renderMermaidBlocks()` draws the placeholders one at a time with `mermaid.render()`, configured with `securityLevel: 'strict'`, a `default`/`dark` theme picked from `prefers-color-scheme`, and the `#write` body font. A generation counter guards every pass, each diagram gets a unique id, and a diagram that fails to draw falls back to its source plus the parser's message. Redraws happen on `appearance-changed`, a new main→renderer notification forwarded from `nativeTheme`'s `updated` event, and after theme stylesheets finish loading. PDF export waits for the current pass, up to 20 s.
- **Copy button** (`1ce68e0`): After sanitization, an icon-only `<button class="folio-copy">` is added to each `#write pre.md-fences` with non-blank code. It appears on hover or `:focus-visible`, writes the code's text through the renderer's async Clipboard API, confirms for 1.4 s, and is hidden by `@media print`.
- **Typora-identical highlighting** (`5c3ee89`): highlight.js is replaced by the new `src/renderer/highlight.js` module. It drives the CodeMirror 5 modes from `@codemirror/legacy-modes` directly with `StringStream` and emits Typora's `.cm-*` span classes inside `<pre class="md-fences"><code class="cm-s-inner language-…">`. The theme's `--color-cm-*` palette colours the tokens. `app.css` drops its two fixed highlight.js palettes and adds a fence-scoped fallback for the nine token classes that Typora's core stylesheet colours, plus a fix for compounded fence font size.
- **Bundle** (`1ce68e0`): `build.js` minifies one-shot builds because Mermaid dominates the bundle size.

## Technical Context

**Language/Version**: JavaScript. The renderer is ES modules bundled by esbuild (0.23.1 at the time; `^0.28.2` since `218bccc`) into one IIFE targeting `chrome120`. The main process and preload are CommonJS. Electron 43.2.0 (the upgrade from 31.x landed in `57f8363` on 2026-08-03, nine days before this feature).

**Primary Dependencies**: `mermaid` `^11.16.1` (new runtime dependency, `1ce68e0`, locked at 11.16.1; it adds 107 lockfile entries such as d3, dagre-d3-es, cytoscape and its layouts, `@mermaid-js/parser`, roughjs, khroma, stylis and marked). `@codemirror/legacy-modes` `^6.5.3` (new, `5c3ee89`, locked 6.5.3) is driven through `StringStream` from the existing `@codemirror/language` `^6.10.2`. `highlight.js` `^11.10.0` was removed in `5c3ee89` (it had been locked at 11.11.1). Existing dependencies the feature relies on: markdown-it `^14.1.0` (`fence` rule, `highlight` hook, `utils.escapeHtml`), DOMPurify `^3.1.6` (sanitizes before injection) and Electron `nativeTheme`.

**Storage**: N/A. No new settings keys and no change to `folio-settings.json`. The diagram palette reads the existing `appearance` setting (owned by [004](../004-three-axis-theming/spec.md)) only indirectly, through `prefers-color-scheme`.

**Testing**: No automated tests; manual verification per constitution quality gates and [quickstart.md](./quickstart.md).

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: The document's text renders synchronously and diagrams draw asynchronously afterwards, so they never delay the text. Appearance redraws are deferred one macrotask (`setTimeout(…, 0)`) so background windows are not left waiting for animation frames. Copy confirmation lasts 1400 ms. Fence highlighting runs synchronously inside the Markdown render, in a single linear pass per line.

**Constraints**: Fully offline, with everything bundled and no CDN (Principle VI). The CSP keeps `script-src 'self'`; Mermaid's inline `<style>` relies on the existing `style-src 'unsafe-inline'`. Mermaid must run with `securityLevel: 'strict'`, and its output must not pass through DOMPurify, which would strip the `<style>` and `<foreignObject>` it needs. Fences must emit Typora's CodeMirror 5 class vocabulary (Principle I). Every new chrome element needs light and dark palettes. PDF export waits at most 20 000 ms. Highlighting stops after `MAX_TOKENS_PER_LINE = 10000` tokens on a line.

**Scale/Scope**: 7 documented diagram types, with no allow-list. The highlighter recognises 169 fence info-string names (170 table keys, with `php` explicitly mapped to plain text) resolving to 78 CodeMirror 5 modes imported from 55 legacy-mode files, plus 63 Lezer-to-CM5 token aliases and 9 fallback token colour rules. `1ce68e0` changed about 235 lines in `renderer.js` and 140 in `app.css`. `5c3ee89` added the 282-line `highlight.js`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
| --------- | ------ | -------- |
| I. Typora Theme Compatibility | ✅ Pass | `5c3ee89` makes preview fences carry Typora's CodeMirror 5 `.cm-*` classes inside `<pre class="md-fences"><code class="cm-s-inner …">` (`highlightFence()` in `src/renderer/highlight.js`, the markdown-it `highlight` hook in `src/renderer/renderer.js`). The theme's `--color-cm-*` palette (`themes/base.css`) colours them, which is exactly the constitution's fence rule. Rendered content still goes into `#write`, and the theme layer stack and load order are untouched. Appearance still flips through `prefers-color-scheme`, and the diagram palette reads the same media query instead of swapping files. The new chrome (copy button, diagram error message) has light and dark palettes in `src/renderer/app.css`. The only deliberate override of theme rules is `#write .md-fences > code { font-size: inherit }`, which restores Typora's fence size ([research.md](./research.md) R10; see also F9). |
| II. Complement Typora | ✅ Pass | Viewing and exporting improvements only. The preview stays non-editable (`contenteditable="false"` on the button). Folio follows Typora conventions here: ```` ```mermaid ```` diagrams and CodeMirror-tokenized fences. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass (follow-up noted) | DOMPurify still sanitizes the markdown output before it is injected (`renderPreview()`). Diagrams are drawn afterwards with Mermaid `securityLevel: 'strict'`, as the constitution requires. Diagram source and parser messages in the fallback are escaped (`md.utils.escapeHtml`), the highlighter escapes `& < > "` in every token, and the `language-…` class is escaped. The only new channel, `appearance-changed`, is main→renderer, carries no payload, and is exposed only as `folioAPI.onAppearanceChanged`. No renderer→main channel was added: the clipboard write uses the renderer's Clipboard API. The CSP is unchanged. Follow-up: links declared inside diagrams are drawn after Folio wires document links, so they bypass its routing ([research.md](./research.md) F7, found by code reading). |
| IV. Never Lose the User's Work | N/A | No document-replacing action, dirty-state, `Session` or settings change. Export only gains a bounded wait. Diagrams are drawn from `currentText()`, so unsaved edits are previewed and exported as shown. |
| V. Cross-Platform Parity | ✅ Pass | All behaviour is in the renderer and platform-neutral. `nativeTheme` `updated` is forwarded to every window on every OS. The redraw uses `setTimeout`, not `requestAnimationFrame`, so background windows update on every platform. No accelerators were added. |
| VI. Lean, Local, Self-Contained | ✅ Pass | Mermaid and the legacy modes are bundled by esbuild, with no CDN and no network. Both new runtime dependencies are justified in [research.md](./research.md) R1 (Mermaid) and R9 (`@codemirror/legacy-modes`), and highlight.js was removed. The highlighter is a small in-repo module, `src/renderer/highlight.js`, free of Electron and the DOM. The architecture is unchanged (one bundled renderer, no framework). The expensive work is bounded: diagrams draw sequentially and stale passes are abandoned, export waits at most 20 s, highlighting is guarded per line, and one-shot builds are minified (`build.js`). |
| Quality Gates | ⚠️ Partial | Gate 1: `build.js` changed, so it is exercised by `npm run build:renderer` (quickstart V9). Gates 2–3: [quickstart.md](./quickstart.md) covers every changed flow in Light and Dark × Fluent, GitHub and Microsoft Word. Gate 4: N/A (no packaging, association or launch change). Gate 5: the IPC and export-timing changes are reviewed in [contracts/ipc-channels.md](./contracts/ipc-channels.md). **Documentation**: `1ce68e0` updated README.md (copy button, Diagrams feature, Mermaid acknowledgement), but `5c3ee89` did not. README still credits highlight.js in Features, Project layout and Acknowledgements ([research.md](./research.md) F1). |

**Post-design re-check (after Phase 1)**: No change. The contracts add one payload-free notification channel, keep the Typora DOM contract (`#write`, `.md-fences`, `.cm-*`, `--color-cm-*`), and introduce no settings. The Documentation ⚠️ stays open as a README follow-up; it is not a design violation, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/010-mermaid-diagrams-code-blocks/
├── spec.md              # Feature specification (/speckit-specify command output)
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── ipc-channels.md
│   ├── mermaid-diagrams.md
│   ├── copy-button.md
│   └── code-fence-highlighting.md
├── checklists/
│   └── requirements.md  # /speckit-specify quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
build.js                      # minify one-shot renderer builds (1ce68e0)
package.json                  # + mermaid (1ce68e0); + @codemirror/legacy-modes, − highlight.js (5c3ee89)
package-lock.json             # lockfile for the dependency changes above (1ce68e0, 5c3ee89)
README.md                     # Features: copy button + Diagrams; Mermaid acknowledgement (1ce68e0)
samples/
└── formatting-tour.md        # "Diagrams" section: flowchart + sequence diagram (1ce68e0)
src/
├── main.js                   # nativeTheme 'updated' → 'appearance-changed'; export waits up to 20 s (1ce68e0)
├── preload.js                # folioAPI.onAppearanceChanged (1ce68e0)
└── renderer/
    ├── renderer.js           # mermaid fence rule, diagram pipeline, copy buttons, export wait,
    │                         #   redraw triggers (1ce68e0); highlight hook → highlightFence (5c3ee89)
    ├── highlight.js          # NEW: CodeMirror 5 legacy-mode tokenizer → Typora .cm-* markup (5c3ee89)
    └── app.css               # diagram, copy-button and print styles (1ce68e0); fence fallback
                              #   palette + font-size fix, highlight.js palettes removed (5c3ee89)
themes/
└── base.css                  # drop `.md-fences .hljs` from the inner-code reset (5c3ee89)
```

**Structure Decision**: This feature keeps the existing single-project Electron layout the constitution mandates: CommonJS main process in `src/`, one esbuild-bundled renderer in `src/renderer/`, no UI framework. Nearly all of the feature lives in the renderer bundle. `renderer.js` orchestrates rendering, diagrams, copy buttons and export preparation. The highlighter is its own module, `src/renderer/highlight.js`, because it is pure string→HTML logic with no Electron or DOM dependency. The main process and preload change only to add one notification channel and a longer export wait. No directories were added.

## Complexity Tracking

No violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

The Documentation-gate drift (README still describing highlight.js) is an unresolved documentation defect, recorded in [research.md](./research.md) F1. It is not a justified design violation, so it is not listed here.
