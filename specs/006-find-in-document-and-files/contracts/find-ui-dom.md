# Contract: Find UI, DOM Hooks, Highlight Names and Palettes

**Feature**: [spec.md](../spec.md) | **State**: [data-model.md](../data-model.md) §1–§4

## Invariants (Principle I: Typora theme compatibility)

1. **Find never touches the `#write` subtree.** Matches are `Range` objects registered in
   `CSS.highlights`; no element is inserted, removed or rewrapped. Theme selectors, layout and line
   wrapping are therefore identical whether highlights are present or not.
2. **The find bar is application chrome, not page content.** `#folio-find` is a child of
   `#folio-content` and a sibling of `#folio-preview` and `#typora-source`, absolutely positioned
   (`top: 12px; right: 18px; z-index: 20`) over the document area.
3. **The Find-in-Files UI lives in the file explorer.** It is inside `#folio-files` (owned by 005),
   between `#folio-files-title` and `#folio-files-tree`.
4. **Styling lives in `src/renderer/app.css`.** That file loads before the theme layers. Every rule
   has a dark counterpart inside `@media (prefers-color-scheme: dark)`, so it follows Light, Dark and
   System appearance.
5. **Source mode never shows the find bar.** `setSourceMode(true)` closes it, so it never overlaps
   the `typora-sourceview-on` layout.

## Find bar (`2a26dea`, `src/renderer/index.html`)

| Element | Id / class | Attributes | Content |
|---|---|---|---|
| Container | `#folio-find` | `hidden` (initial), `role="search"`, `aria-label="Find in page"` | — |
| Field | `#folio-find-input` | `type="text"`, `placeholder="Find"`, `aria-label="Find"`, `spellcheck="false"`, `autocomplete="off"` | The user's term. |
| Counter | `#folio-find-count.folio-find-count` | `aria-live="polite"` | `i/n`, `0/0` or empty. |
| Previous | `#folio-find-prev.folio-find-btn` | `type="button"`, `title="Previous match (Shift+Enter)"`, `aria-label="Previous match"` | ↑ (`&#8593;`) |
| Next | `#folio-find-next.folio-find-btn` | `title="Next match (Enter)"`, `aria-label="Next match"` | ↓ (`&#8595;`) |
| Close | `#folio-find-close.folio-find-btn` | `title="Close (Esc)"`, `aria-label="Close find"` | ✕ (`&#10005;`) |

## Highlight names

| Highlight | Registered by | Priority | Light palette | Dark palette |
|---|---|---|---|---|
| `folio-find` (every match) | `runFind()` | default | background `#ffe58a`, text `inherit` | background `#6b5a1e`, text `#f3f0e6` |
| `folio-find-current` (current match) | `setCurrentMatch()` | `1` | background `#ff9a3d`, text `#1a1a1a` | background `#c9701f`, text `#1a1a1a` |

The code checks for API support with `HIGHLIGHT_SUPPORTED`. Without it, find degrades to "no
matches" and never throws.

## Find-in-Files pane (`e126f54`, `4a9cc98`)

| Element | Id / class | Attributes / rules | Content |
|---|---|---|---|
| Search box | `#folio-files-search.folio-files-search` | `type="text"`, `placeholder="Find in files… (Esc to close)"`, `aria-label="Find in files"`, `spellcheck="false"`, `autocomplete="off"`, `hidden` (initial, `4a9cc98`); `.folio-files-search[hidden] { display: none; }` | The term. |
| Tree | `#folio-files-tree` (005) | `hidden` while results are shown | The explorer tree. |
| Results | `#folio-files-results` | `hidden` (initial) | The summary and groups, or the empty state. |
| Summary | `.files-results-summary` | — | `N match(es) in M file(s)`, plus ` (truncated)` when applicable. |
| Empty state | `.folio-files-empty` (shared with 005) | — | `No matches` |
| Group | `.files-result-group` | — | — |
| Group heading | `.files-result-file` (with `.active` for the current document when rendered) | `title` = absolute path; click → `openSearchResult()` | `.files-name` (folder-relative path), `.files-result-count` (badge) |
| Match row | `.files-result-match` | `title="Line N"`; click → `openSearchResult()` | `.files-result-line` (number), `.files-result-text` (excerpt with `<mark>` around each case-insensitive occurrence, ellipsized by CSS) |
| Emphasis | `.files-result-text mark` | light: background `#ffe58a`, text `inherit`; dark: background `#6b5a1e`, text `#ffe58a` | The matched substring. |

## Contract for later features

Anything rendered into `#write` after this feature is walked by the find bar's text-node search.
Interactive chrome placed inside the page should therefore carry no text nodes, or it will produce
false matches. The code-fence copy button (010) follows this rule: it renders an SVG icon with no
text label "on purpose", as its comment in `src/renderer/renderer.js` explains.
