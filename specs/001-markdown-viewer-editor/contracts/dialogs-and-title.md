# Contract: Dialogs, Prompts & Window Title

**Feature**: [001 spec](../spec.md) | **Source**: `src/main.js` (`updateTitle`, `promptUnsaved`, `confirmDiscardIfDirty`, `onExternalChange`, `doOpen`, `doSaveAs`, `doExportPDF`, `showAbout`, error boxes)

Message boxes and file dialogs are parented to the window that owns the document (since `8062af5`,
that window's `Session.win`). Error boxes (`dialog.showErrorBox`) take no parent window.

## Window title (`updateTitle()`)

```text
<"• " when dirty><name> - Folio
```

- `<name>` is `path.basename(currentPath)` for a file, otherwise `currentName` ("Untitled", "Welcome",
  "Markdown Formatting Tour"), falling back to "Untitled".
- The separator was an em dash (`<name> — Folio`) until `2a26dea` changed it to a plain hyphen.
- The title is refreshed on every dirty flip, load, save and Save As.

## Unsaved-changes prompt (`promptUnsaved()`, entered through `confirmDiscardIfDirty()`)

Shown only when `Session.isDirty` is true.

| Property | Value |
|---|---|
| type | `warning` |
| title | `Folio` |
| message | `Do you want to save the changes you made?` |
| detail | `Your changes will be lost if you don't save them.` |
| buttons | `Save` · `Don't Save` · `Cancel` |
| default / cancel | `Save` (index 0) / `Cancel` (index 2) |

| Answer | Result |
|---|---|
| Save | `doSave()`, which becomes Save As for untitled documents. The action proceeds **only if it returns `true`** (`8062af5`). Until `8062af5`, a file-backed document proceeded even when the save failed. |
| Don't Save | The action proceeds and the edits are discarded. |
| Cancel | The action is aborted and nothing changes. |

**Guarded callers in this feature**: `doNew`, `doOpen`, `openBuiltinDoc`, `doReload`, and the window
`close` handler (which also covers quitting). Other specs add `doOpenFolder`, `doCloseFolder`,
`navigate` and `navigateHistory` (005). **Not guarded**: `actions.openRecent` (known gap, research.md
finding 4).

## External-change prompt (`onExternalChange()`, `8062af5`)

Shown only when the watched file changed on disk **and** the document is dirty. A clean document
reloads silently.

| Property | Value |
|---|---|
| type | `warning` |
| title | `File changed on disk` |
| message | `<file name> was modified outside Folio.` |
| detail | `Reloading will discard the unsaved changes you have made here.` |
| buttons | `Reload` · `Keep My Changes` |
| default / cancel | `Keep My Changes` (index 1) / `Keep My Changes` (index 1) |

## File dialogs

| Dialog | Title | Options | Filters |
|---|---|---|---|
| Open (`doOpen`) | `Open Markdown file` | `properties: ['openFile']` (a single file) | `Markdown`: md, markdown, mdown, mkd, txt · `All files`: * |
| Save As (`doSaveAs`) | `Save Markdown file` | `defaultPath`: `currentPath`, or `<currentName>.md` | `Markdown`: md, markdown · `All files`: * |
| Export (`doExportPDF`) | `Export to PDF` | `defaultPath`: `currentPath` with its extension replaced by `.pdf`, or `<currentName>.pdf` | `PDF`: pdf |

Cancelling any of these dialogs is a silent no-op. Save As then returns `false`, which keeps a pending
guarded action from running.

## Error boxes (`dialog.showErrorBox`)

| Situation | Title | Body |
|---|---|---|
| Open, Open Recent or launch file cannot be read | `Folio — cannot open file` | `<path>` + blank line + error message |
| Save or Save As cannot write | `Folio — cannot save file` | `<path>` + blank line + error message |
| Reload cannot read the file (for example, it was deleted) | `Folio — cannot reload file` | `<path>` + blank line + error message |
| `printToPDF` or the PDF write fails | `Folio — cannot export PDF` | error message |
| A bundled guide cannot be read | `Folio` | `Cannot open <guide name>.` + blank line + error message |

In each case the current document and its unsaved state are left unchanged.

## About dialog (`showAbout()`, Help ▸ About Folio)

| Property | Value |
|---|---|
| type / title | `info` / `About Folio` |
| message | `Folio <app version>` |
| detail | "A lightweight, themeable Markdown editor and viewer with a Typora-like look." · the non-affiliation disclaimer · "Built with Electron, CodeMirror and markdown-it." |
| buttons | `Close` (default and cancel) |

In `bd8f5ef` the dialog had `Open GitHub` and `Close` buttons and listed the repository URL; both were
removed in `8062af5`. On macOS the application menu's About item uses the native About panel
(`role: about`) instead.

## PDF output (`doExportPDF()`)

1. `ask(session, 'prepare-export')` returns the page to the rendered view; since `1ce68e0` it also
   waits for diagrams (010).
2. The Export dialog opens (above).
3. `webContents.printToPDF({ pageSize, printBackground: true, margins: { marginType: 'default' } })`
   runs, where `pageSize` is `'Letter'` for the US Letter page width (`pageSizeForWidth`, 004;
   `pageSizeForTheme` by theme name at 001) and `'A4'` otherwise.
4. The returned buffer is written to the chosen path with `fs.writeFileSync`.
