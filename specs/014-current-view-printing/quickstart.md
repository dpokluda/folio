# Validation: Print the Current Document View

Save work and quit older running Folio copies before `npm start`; the existing single-instance handoff otherwise opens the older process.
Use the current checkout and verify About reports `1.1.0`.

```sh
npm run build:renderer
node --test tests/printing.test.js tests/task-list-layout.test.js
npm start
```

1. Confirm File has one Print item, no Print Source item, and the `Ctrl/Cmd+P` shortcut.
2. In source mode, Print must prepare the entire literal Markdown without changing mode or losing edits/selection.
3. In preview mode, the same command must prepare rendered content without app chrome.
4. Switch back to source and repeat; the earlier mode must not be cached.
5. Export to PDF from source mode; it must remain formatted rendered content and leave source mode active.
6. Preserve the existing cancellation, error, paper-size, appearance, and resource-cleanup behavior.

Automated checks exercise real renderer/output windows and test native callbacks, not physical printer jobs.
Native printer/dialog and other-platform qualification remain unverified.

## Execution Record

Completed locally on Windows on 2026-11-05.
The updated regressions first failed because the menu still had two Print entries and the new current-view request returned no snapshot.
After implementation, the renderer build passed and all three affected printing/task-list tests passed without skips.
The real renderer checks source -> preview -> source output selection, full source equality, editor-state preservation, and rendered PDF export from source mode.
Main/menu JavaScript syntax and `git diff --check` passed.
Feature links and removal of obsolete Print Source action/request references from current source and guides were checked.

The version remains `1.1.0`; completed feature 013 was not rewritten.
Native dialog and physical-printer checks were not performed.
