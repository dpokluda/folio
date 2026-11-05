# Contract: Document Output

**Date**: 2026-11-05
**Status**: Implemented locally; native dialog/printer qualification not run.

## User interface

| Command | Shortcut | Content | Destination |
|---|---|---|---|
| File > Export to PDF | None added | Complete rendered document | Selected PDF path |
| File > Print | Ctrl/Cmd+P | Complete rendered document | System print dialog |
| File > Print Source | None added | Complete literal Markdown | System print dialog |

Commands use the active window without saving Markdown or changing mode.
A4 is the default; US Letter selects Letter.
Native printer settings can override the initial paper choice.

## Request/response bridge

Main sends `folio-request` with `{ id, kind }`.
The owning renderer returns `folio-response` with `{ id, value }` or `{ id, error }`.
Main checks request ID and owning sender ID.

| Kind | Value | Purpose |
|---|---|---|
| `content` | Current Markdown string | Existing save behavior |
| `prepare-export` | Complete rendered HTML string | Export and rendered printing |
| `prepare-print-source` | Complete escaped source HTML string | Source printing |

Reuse preload `onRequest`; add no generic filesystem, shell, or eval bridge.
Required output requests time out after 20 seconds.
Errors/timeouts do not authorize printing the app window.

## Snapshot

Rendered HTML preserves `#write` and app/theme/KaTeX stylesheet order, with `print.css` last.
It contains no app root, sidebars, status bar, source editor, or copy buttons.
Latest theme/diagram work settles before cloning.
Source HTML contains escaped complete `currentText()` in `#folio-print-source`, styled black-on-white and monospaced.
Both have no application bridge and deny scripts through CSP.
Required asset/style sources are allowed; top-level navigation and new windows are denied.

## Output ownership and options

`withPrintDocument(parent, html, output)` owns creation, asset readiness, and cleanup.
The callback runs after styles, fonts, and images are ready.
Missing resources or a separate 20-second loading timeout fail output.
This timeout does not cover human interaction with the print dialog.
PDF uses A4/Letter, backgrounds, and 0.75-inch margins.
Native output uses `silent: false`, backgrounds, and printer-default margins.
The PDF and native margin shapes are distinct Electron contracts.

## Outcomes

- PDF success writes produced bytes to the selected path.
- Native success resolves true after submission; it does not prove a physical printout.
- `Print job canceled` resolves false without success or error notification.
- Other print errors, premature destruction, and preparation/resource failures reject and use Folio's existing error dialog.
- Every exit releases temporary resources and the session guard.
