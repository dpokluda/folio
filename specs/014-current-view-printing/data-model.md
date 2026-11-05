# Data Model: Print the Current Document View

No new entity, schema, migration, or stored preference is needed.

The existing renderer's `state.sourceMode` is the authoritative view:
`true` selects literal source, and `false` selects rendered output.
Each `prepare-print` invocation captures that choice by passing it to the existing asynchronous snapshot function.
Output preparation must not change this state.

Existing document text, session ownership, temporary output resources, and operation transitions remain defined by
[feature 013's data model](../013-document-print-export/data-model.md).
The removed Print Source action/request has no persisted data to migrate.
