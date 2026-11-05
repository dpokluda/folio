# Research: Document Printing and Proper PDF Export

**Date**: 2026-11-05
**Status**: Completed retrospective findings; no unresolved technical decisions.

These decisions come from implementation and local checks performed before this feature record was created.
They are not claims of new external research or native printer qualification.

## Document-only output

**Decision**: Print a standalone content snapshot in a hidden output window rather than the live app window.

**Rationale**: The attached PDF contained one page of selectable text plus Files/Outline/Source controls and document statistics.
It was an application-layout capture, not a bitmap screenshot.
The live preview's absolute positioning and fixed-height scroll container clipped the document during printing.
A separate page removes that layout constraint and shares one path across export and printing.

**Alternatives considered**: Override every app layout rule during live printing.
That would still couple output to sidebars, zoom, virtualization, and interactive state.

## Complete source and preserved state

**Decision**: Use in-memory text for source and a sanitized preview snapshot for rendered output.
Make an invisible preview measurable in source mode without switching modes.

**Rationale**: Printing the editor DOM omits lines outside its virtualized viewport.
Forcing preview mode changes editing state.

**Alternatives considered**: Capture the editor or switch modes for output.
Both fail completeness or preservation requirements.

## Asset readiness and errors

**Decision**: Wait for theme work and the latest diagram pass, then verify stylesheet loading, font readiness, and image decoding.
Separate preparation timeouts from native-dialog interaction.

**Rationale**: Diagrams render asynchronously, superseding passes can make earlier waits stale, and failed stylesheets can expose empty stylesheet objects.
Explicit load/error callbacks are necessary.

**Alternatives considered**: Immediate capture or success-shaped preparation timeouts.
Both can silently produce incomplete documents.

## Paper and appearance

**Decision**: Default to A4, use Letter for US Letter, and ignore display zoom for output scaling.
Keep rendered theme colors; use black-on-white monospaced source.

**Rationale**: Preserve page/appearance contracts while removing app backdrop and sheet decoration.

**Alternatives considered**: Force Light or add printer preferences.
Neither was requested.

## Versioning

**Decision**: Set `1.1.0` once and add major/minor/build rules to project instructions.

**Rationale**: The user chose `1.1`; npm requires three components.
Retrospective documentation is the same change set.

**Alternatives considered**: Another version increment or bug-fix `+build` metadata.
Both conflict with the requested model.

## Older app during development launch

**Decision**: Preserve single-instance behavior and document quitting older copies before launching a changed checkout.

**Evidence**: The user reported `npm start` showing `1.0.0` without Print.
The checkout declared `1.1.0`, while running processes referenced the installed Folio app.
Installed package metadata confirmed `1.0.0`.
`src/main.js` acquires a single-instance lock and hands second launches to the existing instance.

**Rationale**: Development startup does not hot-update an already running packaged app.
Do not terminate it automatically because it may hold unsaved work.

**Alternatives considered**: Change instance identity or stop the app automatically.
Neither is required or authorized by the user's question.
