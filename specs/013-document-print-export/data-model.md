# Data Model: Document Printing and Proper PDF Export

**Date**: 2026-11-05
**Status**: Completed retrospective design.

No persistent schema, migration, or database was added.

## Current document session

Existing session fields identify the window, file path or untitled name, and unsaved state.
The new transient `outputInProgress` flag allows one active output operation per document.
Different windows have independent flags.
Current Markdown stays in renderer/editor state and is read without saving, reloading, switching modes, or changing display zoom.

## Output snapshot

The renderer returns complete HTML.
Rendered snapshots contain cloned sanitized `#write`, completed diagrams, resolved assets, and ordered stylesheet links.
Source snapshots contain escaped full Markdown in `#folio-print-source` with only output styling.
Both include a document base URL and restrictive output CSP.
No editor object, application bridge, or persisted preference is copied.

## Request correlation

Main tracks request ID, owning sender ID, timeout, success callback, and failure callback.
Renderer responses contain either `value` or an error string with the same ID.
Another window's response cannot satisfy the request.
Required output rejects on failure/timeout; existing saves retain fallback semantics.

## Temporary resources

Each isolated output window owns one unique temporary directory and HTML file.
It is sandboxed and has no preload or Node integration.
The directory/window are released after success, cancellation, callback/preparation failure, or destruction.

## Operation transitions

1. **Idle**: Session output flag is false.
2. **Preparing snapshot**: Set flag; request rendered/source HTML; reject overlapping output for that document.
3. **Loading assets**: Create temporary HTML/window; wait for styles, fonts, and images.
4. **Producing output**: Write PDF bytes or await the native print decision.
5. **Submitted/canceled/failed**: Return the distinct outcome or report an error.
6. **Released**: Remove temporary resources and clear the flag.

PDF destination selection precedes preparation.
Canceling it creates neither an output window nor a PDF.

## Validation rules

- Preparation returns an HTML string, never fallback permission to print the app.
- Literal source is escaped and complete, not serialized from visible editor DOM.
- Only the owning window may satisfy a pending response.
- Native cancellation is not submission success.
- The selected PDF path is the only persistent output file.
