# Quickstart: Validate Source Formatting Commands, Line Numbers & Copy File Path

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [menu-commands](./contracts/menu-commands.md), [formatting-commands](./contracts/formatting-commands.md), [ipc-channels](./contracts/ipc-channels.md), [settings-schema](./contracts/settings-schema.md), [ui-elements](./contracts/ui-elements.md)

This guide is for manual validation. Folio has no automated test runner, so these scenarios together with the constitution's verification gates are the acceptance test. The exact text transformations are specified in [contracts/formatting-commands.md](./contracts/formatting-commands.md) and are not repeated here.

## Prerequisites

- Node.js LTS (Node 18+, per README) and a clone of the repository.
- Dependencies installed once: `npm install`.
- A scratch folder outside the repository, so that saved edits never touch `samples/`:

  ```bash
  mkdir -p ~/folio-qa
  printf 'Introduction\nmake this bold\nfirst line\nsecond line\n\nE = mc^2\n' > ~/folio-qa/format-test.md
  ```

## Run

```bash
npm start -- ~/folio-qa/format-test.md
```

`npm start` runs `ensure:electron` and `build:renderer` before launching. The document opens in the rendered view. Press `Ctrl/Cmd+/` for source mode. "Ctrl/Cmd" means Cmd on macOS and Ctrl on Windows and Linux.

## Scenarios

### 1. Inline formatting (User Story 1)

1. In source mode, double-click `bold` on line 2 and press `Ctrl/Cmd+B`.
   **Expected**: `make this **bold**`, with `bold` still selected and `•` in the title bar.
2. Press `Ctrl/Cmd+B` again.
   **Expected**: `make this bold`, with `bold` selected.
3. Press `Ctrl/Cmd+B` once more to re-apply bold. Then select the whole `**bold**`, including its marks, and press `Ctrl/Cmd+B`.
   **Expected**: the marks are removed and `bold` is selected.
4. Repeat steps 1 and 2 with Italic, Underline, Strikethrough, Inline Code and Inline Math:
   - Italic (`Ctrl/Cmd+I`) gives `*…*`.
   - Underline (`Ctrl/Cmd+U`) gives `<u>…</u>`.
   - Strikethrough (`Ctrl/Cmd+Shift+X`) gives `~~…~~`.
   - Inline Code (`Ctrl/Cmd+E`) gives `` `…` ``.
   - Inline Math (`Ctrl/Cmd+M`) gives `$…$`.

   **Expected**: each command wraps the selection, then unwraps it.
5. Place the caret with nothing selected and press `Ctrl/Cmd+U`.
   **Expected**: `<u></u>` with the caret between the tags. Type `x`: `<u>x</u>`.
6. Choose **Format > Bold** with the mouse on a selection.
   **Expected**: the same result as the shortcut, and typing continues in the editor without clicking it first.
7. Press `Ctrl/Cmd+Z` repeatedly.
   **Expected**: the formatting edits are undone. When the text matches the saved file again, `•` disappears.

### 2. Format commands in the rendered view (User Story 1, FR-003)

1. Press `Ctrl/Cmd+/` to return to the rendered view. Choose **Format > Bold**, then **Format > Heading 2**.
   **Expected**: the document is unchanged. Each time, "Switch to Source mode (Ctrl/Cmd+/) to format text" appears at the bottom center and is gone within about 2 seconds.
2. Press `Ctrl/Cmd+B` in the rendered view.
   **Expected**: the document is unchanged.
3. Record the result of step 2 per platform:
   - On Windows and Linux, nothing should happen.
   - On macOS, the hint may appear (research.md, finding 6). Note which behavior you see.

### 3. Headings (User Story 2)

1. In source mode, put the caret on `Introduction` and press `Ctrl/Cmd+2`, then `Ctrl/Cmd+3`, then `Ctrl/Cmd+3`.
   **Expected**: `## Introduction`, then `### Introduction`, then `Introduction`.
2. Select from `first line` through `second line` and press `Ctrl/Cmd+1`.
   **Expected**: both lines become `# …`. Press it again: both return to plain text.
3. Open the Outline (`Ctrl/Cmd+Alt+O`) and switch to the rendered view.
   **Expected**: the new headings appear in the preview and in the outline.

### 4. Links, code blocks and math blocks (User Story 3)

1. Select `this` on line 2 and press `Ctrl/Cmd+K`.
   **Expected**: `[this]()` with the caret between the parentheses. Type `https://example.com`.
2. With nothing selected, press `Ctrl/Cmd+K`.
   **Expected**: `[]()` with the caret between the brackets.
3. Put the caret at the end of `second line` and press `Ctrl/Cmd+Shift+E`.
   **Expected**: a ```` ``` ```` line, an empty line holding the caret, and a closing ```` ``` ```` line, all below the text. Type `echo hi`.
4. Select the whole `E = mc^2` line, from its first to its last character, and press `Ctrl/Cmd+Shift+M`.
   **Expected**: `$$` above, `E = mc^2` (still selected), and `$$` below.
5. Switch to the rendered view.
   **Expected**: the link, code block and display formula render. Math typesetting is defined by [009](../009-math-typesetting/spec.md).
6. Apply `Ctrl/Cmd+K` and `Ctrl/Cmd+Shift+E` a second time on the same spot.
   **Expected**: a second link or block is inserted. These commands never toggle.

### 5. Moved pane shortcuts (User Story 3, FR-015)

1. Save with `Ctrl/Cmd+S`, then open a folder (**File > Open Folder…**, then pick `~/folio-qa`) and reopen `format-test.md` from the explorer. In source mode, press `Ctrl/Cmd+Shift+E`.
   **Expected**: a code block is inserted, and the file explorer does not toggle.
2. Press `Ctrl/Cmd+Alt+E` (Cmd+Option+E on macOS) in the rendered view and again in source mode.
   **Expected**: the file explorer toggles both times.
3. Press `Ctrl/Cmd+Alt+O` in both views.
   **Expected**: the outline toggles.
4. Open the **View** menu.
   **Expected**: on Windows and Linux, the items read "Toggle File Explorer   Ctrl+Alt+E" and "Toggle Outline   Ctrl+Alt+O" (not "Alt+Ctrl+…"). On macOS they show ⌥⌘E and ⌥⌘O.
5. Hover the status-bar **Files** and **Outline** buttons.
   **Expected**: the tooltips show `Ctrl/Cmd+Alt+E` and `Ctrl/Cmd+Alt+O`.

### 6. Line numbers (User Story 4)

1. With no stored preference, enter source mode. To get there, quit Folio and remove the `lineNumbers` key from `folio-settings.json` (or delete the file) in the app's Electron `userData` folder. The folder name can differ between `npm start` and a packaged build.
   **Expected**: no gutter, and **View > Show Line Numbers** is unchecked.
2. Place the caret mid-document, make an edit, then choose **View > Show Line Numbers**.
   **Expected**: numbers appear at once, the item is checked, the caret stays put, and `Ctrl/Cmd+Z` still undoes the edit.
3. Quit Folio and relaunch it with the same command.
   **Expected**: in source mode the gutter is shown, and `folio-settings.json` contains `"lineNumbers": true` (see [settings-schema](./contracts/settings-schema.md)).
4. In the rendered view, turn the setting off, then enter source mode.
   **Expected**: no gutter.
5. Turn it back on. Check the gutter in **Themes > Appearance > Light** and **Dark**, for each **Style** (Fluent, GitHub, Microsoft Word).
   **Expected**: muted numbers, with no gutter background or divider.

   Record the readability of the numbers in Dark appearance. research.md, finding 5, predicts the same faint grey in both appearances.

### 7. Copy File Path and the toast (User Story 5)

1. With `format-test.md` open, press `Ctrl/Cmd+Shift+C`. Then paste the clipboard in a terminal:
   - macOS: `pbpaste`
   - Windows PowerShell: `Get-Clipboard`
   - Linux: `wl-paste` or `xclip -o -selection clipboard`

   **Expected**: the full absolute path of `format-test.md`. "Path copied to clipboard" shows at the bottom center for about 1.6 s and is gone within 2 s.
2. Make an unsaved edit and copy the path again.
   **Expected**: the same path is copied, and `•` stays in the title bar.
3. Choose **File > New**, then open the **File** menu.
   **Expected**: **Copy File Path** is disabled. Do the same for **Help > Welcome** and **Help > Markdown Formatting Tour**, with the same result.
4. Save the new document with **Save As…** into `~/folio-qa/`.
   **Expected**: **Copy File Path** is enabled and copies the new path.
5. Open a second window (`Ctrl/Cmd+Shift+N`) with another file. Copy the path in each window.
   **Expected**: each copy uses the focused window's document, and the toast appears in that window only.
6. Trigger two toasts quickly, for example by pressing `Ctrl/Cmd+Shift+C` twice.
   **Expected**: the toast restarts rather than stacking, and it never blocks clicks underneath it.
7. Optional accessibility check: run VoiceOver (macOS), Narrator (Windows) or Orca (Linux).
   **Expected**: toast messages are announced, and focus stays where it was.

### 8. Constitution verification gates

1. **Gate 1**: run `npm run build:renderer`.
   **Expected**: it completes without esbuild errors.
2. **Gate 2**: scenarios 1–7 cover every changed flow. Unsaved-changes guard: after a formatting edit, close the window.
   **Expected**: Folio prompts to save or discard, and **Cancel** keeps the window and the edits.
3. **Gate 3**: check the toast and the gutter in Light and Dark appearance across Fluent, GitHub and Microsoft Word (scenario 6, step 5, and scenario 7, step 1).
   **Expected**: the toast is legible in both palettes ([ui-elements](./contracts/ui-elements.md)).
4. **Gate 4**: not applicable. Packaging, launch arguments and OS integration are unchanged.
5. **Gate 5** (Principle III review): run `git show --stat 68e67be`.
   **Expected**: `src/preload.js` is not listed.

   Then confirm in `src/main.js` that `state-changed` stores `lineNumbers` only when it is a boolean, and that the clipboard is written from the Session's `currentPath`. Confirm in `src/renderer/renderer.js` that `showToast` uses `textContent`.
6. **Documentation**: README.md, "How to use", describes Format, Line numbers, Copy file path and the `Ctrl/Cmd+Alt+E` / `Ctrl/Cmd+Alt+O` pane shortcuts. Compare the README against the drift listed in research.md, findings 1–3.

### 9. Known-limitation spot checks (optional; documents shipped behavior)

These checks confirm the edge cases listed in [spec.md](./spec.md#edge-cases). They are expected results, not failures.

1. With only the caret inside `**word**`, press `Ctrl/Cmd+B`.
   **Expected**: another empty pair, `**wo****rd**`.
2. Select `word` inside `**word**` and press `Ctrl/Cmd+I`.
   **Expected**: `*word*`.
3. With the caret in the middle of a line of text, press `Ctrl/Cmd+Shift+E`.
   **Expected**: the rest of the line follows the closing fence.
4. With two windows open, toggle line numbers in one window.
   **Expected**: the other window's gutter does not change until it is toggled there or reopened.
5. Windows only, with a layout where AltGr+E types `€` (for example German): in source mode, press AltGr+E.
   **Expected**: record whether `€` is typed or the file explorer toggles (research.md, finding 7).

## Cleanup

Remove the scratch folder when you are done: `rm -rf ~/folio-qa`.
