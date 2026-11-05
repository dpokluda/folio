# Research: Print the Current Document View

**Date**: 2026-11-05
**Status**: Decisions resolved from the existing implementation.

## Authoritative view

**Decision**: Select source/rendered output in the renderer when it handles `prepare-print`.
**Rationale**: `state.sourceMode` already owns the actual view; no additional preference or asynchronous main-process state lookup is needed.
**Alternatives considered**: Cache mode in main or ask the user which content to print.
Both add unnecessary state or interaction.

## PDF separation

**Decision**: Keep `prepare-export` rendered-only.
**Rationale**: The requested current-view behavior applies to Print, not the existing rendered PDF export.
**Alternatives considered**: Share a mode-dependent preparation request with PDF export.
That would change the earlier export contract unnecessarily.

## Removed surface

**Decision**: Remove Print Source, its action, and its old request kind; reuse `printableDocument(source)` internally.
**Rationale**: One public command still uses both existing content representations.
**Alternatives considered**: Keep hidden legacy menu/request aliases.
They have no current consumer after the affected tests are updated.

## Historical record and version

**Decision**: Record this refinement in feature 014, preserve completed feature 013, and keep `1.1.0`.
**Rationale**: The constitution requires flow-forward records; the version instructions prohibit repeated bumps while refining the same change set.
**Alternatives considered**: Rewrite 013 or bump again.
Neither follows both existing policies.
