# Contract: Single Current-View Print Command

| Action | Request | Output |
|---|---|---|
| File > Print / Ctrl/Cmd+P in source mode | `prepare-print` | Full escaped current Markdown |
| File > Print / Ctrl/Cmd+P in preview mode | `prepare-print` | Complete rendered document |
| Export to PDF in either mode | `prepare-export` | Complete rendered document |

The File menu has no Print Source item.
Main sends the same narrow Print request regardless of view.
The owning renderer chooses its current `state.sourceMode` when handling that request.
Success returns standalone HTML through the existing correlated response.
No new bridge, settings value, or view-selection dialog is introduced.

Remove the old `printSource` action and `prepare-print-source` request.
Reuse existing source formatting, paper selection, native dialog, cancellation/error outcomes, user-state preservation, and output cleanup.
Feature 013's contract remains the historical record for the earlier two-command interface; this contract supersedes only that choice.
