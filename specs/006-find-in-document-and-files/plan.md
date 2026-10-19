# Implementation Plan: Find in Document & Find in Files

**Branch**: `006-find-in-document-and-files` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-find-in-document-and-files/spec.md`

**Retroactive Record**: Reconstructed 2026-10-18 from commits `2a26dea`, `e126f54`, `4a9cc98` (dismissable Find-in-Files box only) and `8062af5` (search caching and per-window search scoping only), all dated 2026-07-14; describes the design as implemented.

## Summary

Two complementary searches. **Find** (`Ctrl/Cmd+F`) in the rendered view opens an in-page find bar that marks matches with the CSS Custom Highlight API — no DOM is inserted into or removed from `#write` — with a stronger current-match highlight, an `i/n` counter, Enter / Shift+Enter / ↑ / ↓ navigation that wraps, and Esc or ✕ to close; it re-runs automatically after every preview re-render and closes when source mode is entered. In source mode the same command opens CodeMirror's own search panel instead of forcing a mode switch (`2a26dea`). **Find in Files** (`Ctrl/Cmd+Shift+F`), when the window has an open folder (005), reveals a search box at the top of the file explorer; typing (debounced 180 ms, Enter for immediate) calls the `search-files` invoke channel, whose Electron-free `searchInFolder()` in `src/folder.js` scans the explorer's own Markdown file list for case-insensitive per-line matches, capped at 50 per file, 1,000 in total and 500 files. Results replace the tree, grouped by file with line numbers and highlighted excerpts; clicking one navigates through the existing guarded `navigate` channel and seeds the find bar with the term (`e126f54`). The box stays hidden until invoked and Esc dismisses it (`4a9cc98`). Searches reuse a 4-second file list and mtime-validated file contents, are invalidated when a folder is opened or closed, and are scoped to the sender window's `Session` (`8062af5`).

Incidental: `2a26dea` also changed the window-title separator to a plain hyphen (`name - Folio`) and refreshed the Outline status-button tooltip; both belong to 001 and are listed here only for traceability.

## Technical Context

**Language/Version**: JavaScript — CommonJS main-process modules (`src/main.js`, `src/menu.js`, `src/preload.js`, `src/folder.js`) and an ES-module renderer (`src/renderer/renderer.js`) bundled by esbuild into the generated `src/renderer/bundle.js`.

**Primary Dependencies**: Electron 31.x at the time (`package.json` `^31.3.1`, resolved 31.7.7 with Chromium 126, which provides `Highlight`, `CSS.highlights` and `::highlight()`); upgraded to Electron 43.2.0 in `57f8363` (2026-08-03) with no change to this feature. `@codemirror/search` (a dependency since `bd8f5ef`: `search({ top: true })`, `searchKeymap`, `openSearchPanel`) for source mode. Node's `fs` and `path` inside `src/folder.js`. No new dependencies.

**Storage**: No new persisted state and no new `folio-settings.json` keys. Reads the open folder's Markdown files as UTF-8 from disk; caches are in memory only (`src/folder.js`). Revealing the explorer for Find in Files persists the existing `filesVisible` preference (005) through the renderer's `persistState()`.

**Testing**: No automated tests; manual verification per constitution quality gates and [quickstart.md](./quickstart.md). `src/folder.js` stays Electron-free so `searchInFolder()` can be unit-tested in plain Node later.

**Target Platform**: macOS, Windows, Linux desktop.

**Project Type**: desktop-app (Electron main + bundled renderer).

**Performance Goals**: Preview find recomputes synchronously on every keystroke (a `TreeWalker` over the non-blank text nodes of `#write`). Find in Files runs at most once per 180 ms typing pause (Enter runs it immediately); repeat searches within a folder reuse the file list for 4 s and re-read only files whose `mtimeMs` changed.

**Constraints**: Nothing may be inserted into `#write` (Principle I); the renderer must not choose the directory that is searched (Principle III); the search runs synchronously inside the main-process `search-files` handler, so it must stay bounded (Principle VI); every new chrome element needs light and dark palettes (Principle I, quality gate 3).

**Scale/Scope**: ≤ 50 listed matches per file, ≤ 1,000 matches and ≤ 500 files per search; excerpts ≤ 240 characters; the file scope (seven Markdown extensions, hidden entries and `node_modules`/`.git`/`.obsidian`/`.vscode`/`.idea` skipped, depth ≤ 16) is inherited from `scanFolder()` (005). One find bar and one Find-in-Files pane per window.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Evidence |
|---|---|---|
| I. Typora Theme Compatibility | ✅ Pass | Matches are `Range` objects registered in `CSS.highlights` as `folio-find` and `folio-find-current` (`src/renderer/renderer.js`); nothing is inserted into `#write`, so theme selectors, layout and line wrapping are untouched. The find bar is a sibling of `#folio-preview` / `#typora-source` inside `#folio-content`; the Find-in-Files UI lives in the explorer aside `#folio-files`. All new chrome and the `::highlight()` palettes live in `src/renderer/app.css`, which loads before the theme layers, with dark variants under `@media (prefers-color-scheme: dark)`. Entering source mode closes the bar, so `typora-sourceview-on` styling is unaffected. |
| II. Complement Typora: View and Lightly Edit | ✅ Pass | "Searching" is an allowed purpose. Both searches are read-only and the preview gains no editing affordance; editing-oriented find/replace stays in source mode's CodeMirror panel. `Ctrl/Cmd+F` / `Ctrl/Cmd+Shift+F` follow familiar editor conventions. |
| III. Untrusted Documents, Hardened Shell | ✅ Pass | One narrow invoke channel, `search-files`, exposed as `folioAPI.searchFiles(query)` (`src/preload.js`). The handler resolves `sessionFor(event.sender).currentFolder` (`src/main.js`, `8062af5`); the renderer supplies only the query, which `searchInFolder()` coerces with `String()` and short-circuits when blank; exceptions yield an empty result. Results are built with `textContent`, text nodes and programmatic `<mark>` elements, never `innerHTML` of file text (`renderFileResults()`, `appendHighlighted()`). Opening a result reuses the existing `navigate` handler and `resolveNavTarget()` (005). No change to the CSP, sanitization or external opening. |
| IV. Never Lose the User's Work | ✅ Pass | A result click goes through `navigate` → `confirmDiscardIfDirty(session)`; Cancel returns `{ ok: false, canceled: true }` and nothing loads. Neither search writes anything. Find state lives in each window's renderer `state`; the searched folder comes from that window's `Session`. |
| V. Cross-Platform Parity | ✅ Pass | `CmdOrCtrl+F` / `CmdOrCtrl+Shift+F` accelerators (`src/menu.js`); no platform branches; CRLF handled by `split(/\r?\n/)`; folder-relative names via `path.relative()`; the active-file marker uses `samePath()`'s separator- and case-insensitive comparison. Both commands are documented in README.md. |
| VI. Lean, Local, and Self-Contained | ✅ Pass | No new dependency (the Highlight API is built into Chromium; `@codemirror/search` predates this feature). Search logic lives in the Electron-free `src/folder.js`. Bounded by design: 50 / 1,000 / 500 caps, 240-character excerpts, a 180 ms typing pause, a 4 s file-list cache, an mtime-validated content cache and invalidation on folder change, on top of `scanFolder()`'s depth cap and skip list. Everything is local and offline. |
| Quality Gates & Documentation | ⚠️ Pass, drift noted | Gate 1–2: `npm run build:renderer` and an `npm start` smoke test of every flow, including the unsaved-changes guard on result clicks ([quickstart.md](./quickstart.md)). Gate 3: light and dark palettes for the find bar, highlights and results, checked across Style families. Gate 5: `search-files` reviewed against Principle III and hardened in `8062af5`. Gate 4 (packaging): N/A. Documentation: README.md was updated in the same commits (`e126f54`, `4a9cc98`), but two statements are imprecise — results opened in source mode are not highlighted, and clearing the box does not hide it — recorded in [research.md](./research.md) ▸ Retroactive findings. |

**Post-design re-check (after Phase 1)**: unchanged. The contracts add no channel, dependency or `#write` markup beyond the evidence above; all principles pass, and the README imprecision remains a documentation follow-up recorded in research.md.

## Project Structure

### Documentation (this feature)

```text
specs/006-find-in-document-and-files/
├── spec.md                  # Feature specification (/speckit-specify)
├── checklists/
│   └── requirements.md      # Spec quality checklist (/speckit-specify)
├── plan.md                  # This file (/speckit-plan command output)
├── research.md              # Phase 0 output (/speckit-plan command)
├── data-model.md            # Phase 1 output (/speckit-plan command)
├── quickstart.md            # Phase 1 output (/speckit-plan command)
├── contracts/               # Phase 1 output (/speckit-plan command)
│   ├── menu-commands.md     # Edit ▸ Find… / Find in Files…, accelerators, in-surface keys
│   ├── ipc-search-files.md  # search-files channel + folioAPI.searchFiles
│   └── find-ui-dom.md       # find bar, Find-in-Files DOM, highlight names, palettes
└── tasks.md                 # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── folder.js            # collectMarkdownFiles(), searchInFolder(), SEARCH_MAX_* caps (e126f54);
│                        #   FILE_LIST_TTL_MS, markdownFilesFor(), linesFor(), invalidateSearchCache() (8062af5)
├── main.js              # actions.findInFiles + no-folder dialog, 'search-files' handler (e126f54);
│                        #   sender-scoped handler, invalidateSearchCache() in openFolder()/doCloseFolder() (8062af5);
│                        #   incidental title separator in updateTitle() (2a26dea)
├── menu.js              # Edit ▸ Find in Files… (CmdOrCtrl+Shift+F) (e126f54)
├── preload.js           # folioAPI.searchFiles(query) (e126f54)
└── renderer/
    ├── index.html       # #folio-find bar (2a26dea); #folio-files-search, #folio-files-results (e126f54);
    │                    #   search box hidden by default (4a9cc98)
    ├── app.css          # find bar + ::highlight(folio-find[-current]) (2a26dea); search box + results (e126f54);
    │                    #   .folio-files-search[hidden] (4a9cc98) — each with dark variants
    └── renderer.js      # find-in-preview and per-mode 'find' (2a26dea); Find-in-Files UI and
                         #   pendingFindQuery hand-off (e126f54); hideFileSearch() / Esc dismissal (4a9cc98)
README.md                # How to use ▸ Find, Find in Files (e126f54, 4a9cc98)
```

**Structure Decision**: The existing single-project Electron layout is kept; no files or modules are added. Work is split along the constitution's lines: Electron-free search logic and caching in `src/folder.js`; a thin, sender-scoped channel in `src/main.js` and `src/preload.js`; the menu command in `src/menu.js`; and all UI (markup, chrome styles with light/dark palettes, behaviour) in `src/renderer/`. Find in Files reuses folder mode's `scanFolder()` and `navigate` channel (005) rather than introducing its own walker or navigation path.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally empty.
