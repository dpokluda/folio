# Implementation Plan: Math Typesetting (TeX)

**Branch**: `009-math-typesetting` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-math-typesetting/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commit `68e67be` (2026-07-16, math-rendering portion only), cross-checked with `git log -S katex` (only `68e67be` and `1ce68e0`; the latter touches neighbouring lines only) and with the current code. Describes the design as implemented.

## Summary

The preview typesets TeX by registering `@vscode/markdown-it-katex` on the renderer's existing markdown-it instance with `{ throwOnError: false }`. KaTeX turns every `$…$` and `$$…$$` token into HTML+MathML synchronously inside `md.render()`, so formulas are already part of the HTML string that the existing `DOMPurify.sanitize()` call filters before it is injected into `#write`. No extra render pass, IPC channel or setting is involved, and PDF export prints the same DOM. For the offline requirement, `build.js` copies KaTeX's `katex.min.css` and its 20 `.woff2` font faces from `node_modules/katex/dist` into the git-ignored `src/renderer/katex/` folder on every build, and `src/renderer/index.html` links that stylesheet between `app.css` and the runtime theme layers. The existing Content-Security-Policy (`font-src 'self' file: data:`, `style-src 'self' 'unsafe-inline' file:`, `script-src 'self'`) already admits these local assets, so it is unchanged.

## Technical Context

**Language/Version**: JavaScript. Renderer ES modules bundled by esbuild ^0.23.0 into one IIFE targeting `chrome120` (unminified at the time; minification arrived with Mermaid in `1ce68e0`); CommonJS build script `build.js`. Electron ^31.3.1 at the time; upgraded to 43.2.0 in `57f8363` (2026-08-03) with no change needed for math.

**Primary Dependencies**: New: `katex` ^0.16.47 (locked 0.16.47, MIT), the typesetter plus its stylesheet and fonts; `@vscode/markdown-it-katex` ^1.1.2 (locked 1.1.2, MIT), the markdown-it parse and render rules. Existing: `markdown-it` ^14.1.0 (`html: true`, `linkify: true`, `typographer: true`) and `dompurify` ^3.1.6 (locked 3.4.11 at the time, 3.4.16 today). KaTeX's own `commander` 8.3.0 dependency serves only its CLI and is not bundled.

**Storage**: N/A. No settings keys and no per-window `Session` state. Build outputs only: `src/renderer/katex/katex.min.css` and `src/renderer/katex/fonts/*.woff2` (generated, git-ignored, packaged through `build.files` `src/**/*`).

**Testing**: No automated tests; manual verification per constitution quality gates and quickstart.md.

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: Formulas are typeset synchronously in the same `renderPreview()` pass that builds the page, so raw TeX is never painted and PDF export needs no settle step. Light/Dark switches need no re-render because math inherits the text colour through `currentColor`.

**Constraints**: Fully offline, no CDN (Principle VI). CSP unchanged, keeping `script-src 'self'` (Principle III). All rendered HTML, KaTeX output included, is sanitized before it reaches `#write` (Principle III). KaTeX `trust` stays off. Only `.woff2` fonts ship.

**Scale/Scope**: An import and a commented `.use()` call (5 lines) in `src/renderer/renderer.js`, about 20 lines in `build.js`, 2 lines in `src/renderer/index.html`, 1 line in `.gitignore`, 2 new dependencies. Generated assets: 20 font faces (≈296 KB on disk) and one stylesheet (≈24 KB). Every formula is typeset again on every render (no cache); KaTeX's default `maxExpand` of 1000 bounds macro expansion per formula; the number of formulas per document is not capped.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0 (ratified 2026-10-18) applied retroactively to the design shipped on 2026-07-16.

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | ✅ Pass | Formulas are rendered into `#write` by the normal `renderPreview()` pass. `katex/katex.min.css` is linked after `app.css` and before the runtime `<link class="folio-theme">` layers (`src/renderer/index.html`), so themes still win on shared selectors and could restyle `.katex`. KaTeX's stylesheet sets no text colour, and `.katex *{border-color:currentColor}` plus `.katex svg{fill:currentColor;stroke:currentColor}` make glyphs, rules and stretchy symbols follow the theme's Light or Dark text colour, so one stylesheet serves both palettes. No new chrome element. |
| II. Complement Typora: View and Lightly Edit | ✅ Pass | A viewing and export feature that follows Typora's `$…$` / `$$…$$` convention. The preview stays read-only; TeX is edited in source mode (the authoring commands belong to [008](../008-source-editing-tools/spec.md)). |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | KaTeX output is produced inside `md.render()` and passes `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })` before `$write.innerHTML` (`renderPreview()` in `src/renderer/renderer.js`). DOMPurify's default HTML/SVG/MathML profile keeps KaTeX's spans, inline styles and SVG paths. KaTeX `trust` stays `false`, so `\href`, `\url`, `\includegraphics` and `\html…` are refused. No new IPC channel or preload surface; CSP unchanged with `script-src 'self'`. The Gate 5 review is recorded in research.md (entries 5, 6 and 9). |
| IV. Never Lose the User's Work | N/A | No action replaces or discards a document, and nothing is persisted. Rendering never modifies the source text. |
| V. Cross-Platform Parity | ✅ Pass | Pure renderer feature with the same bundle and assets on every OS. `copyKatexAssets()` builds paths with `path.join`; the assets reach every package through `build.files` (`src/**/*`) because every `dist*` script runs `build:renderer` first. No accelerators are added here. |
| VI. Lean, Local, and Self-Contained | ✅ Pass | Two runtime dependencies, justified in research.md (entries 1 and 2): the typesetter and a thin markdown-it bridge maintained for VS Code. Assets are vendored at build time from the installed `katex` package (never from a CDN, despite the CDN example in the plugin README), git-ignored like `bundle.js`, woff2 only. No framework and no new process type. Typesetting is bounded per formula by KaTeX's expansion limit. |
| Development Workflow & Quality Gates | ✅ Pass (with notes) | Gate 1: `npm run build:renderer` now also copies the assets and logs `[folio] KaTeX assets copied.`. Gates 2, 3 and 5 are scripted in quickstart.md (smoke test with a source-mode round trip, Light/Dark in all three Style families, CSP and sanitization review). Gate 4 applies because packaged contents change; quickstart.md scenario 4 runs `npm run dist` on the host. README.md was updated in the same commit (Features, Format note, Acknowledgements); small documentation gaps are listed under "Retroactive findings" in research.md and do not amount to a violation. |

**Post-design re-check (after Phase 1)**: research.md, data-model.md, contracts/ and quickstart.md introduce no new dependency, IPC channel, setting or CSP change, and every row above still holds. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-math-typesetting/
├── spec.md                          # Feature specification (/speckit-specify)
├── checklists/
│   └── requirements.md              # Spec quality checklist (/speckit-specify)
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/                       # Phase 1 output (/speckit-plan command)
│   ├── math-syntax.md               # Authoring grammar: delimiters, escapes, unsupported forms
│   ├── rendered-math-dom.md         # Output markup in #write, sanitization, styling hooks
│   └── offline-assets-and-csp.md    # Build-time asset copy, packaging, CSP directives relied on
└── tasks.md                         # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
.gitignore                  # + src/renderer/katex/ under "Build output"
build.js                    # copyKatexAssets(): katex.min.css + fonts/*.woff2 → src/renderer/katex/, called first in run()
package.json                # + katex ^0.16.47, + @vscode/markdown-it-katex ^1.1.2 (build config only reformatted)
package-lock.json           # locks katex 0.16.47, @vscode/markdown-it-katex 1.1.2, commander 8.3.0
README.md                   # Features bullet, Format-section sentence, Acknowledgements entry
src/renderer/
├── index.html              # <link rel="stylesheet" href="katex/katex.min.css" /> after app.css
├── renderer.js             # import katexPlugin; .use(katexPlugin, { throwOnError: false })
└── katex/                  # GENERATED by build.js; git-ignored, never committed
    ├── katex.min.css
    └── fonts/              # 20 × KaTeX_*.woff2
```

**Structure Decision**: Math is a renderer-only extension of the existing single-bundle architecture: one plugin registration in `src/renderer/renderer.js`, one stylesheet link in `src/renderer/index.html`, and a build-time asset copy in `build.js` that writes into a git-ignored folder next to `bundle.js`, mirroring how the bundle itself is generated. The other files changed by `68e67be` (`src/main.js`, `src/menu.js`, `src/store.js`, `src/renderer/app.css`, the formatting code in `src/renderer/renderer.js`) belong to [008](../008-source-editing-tools/spec.md); the `build/icons/` changes belong to [002](../002-cross-platform-packaging/spec.md).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
