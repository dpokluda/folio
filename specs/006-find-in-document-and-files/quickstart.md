# Quickstart: Validate Find in Document & Find in Files

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/](./contracts/) | **State**: [data-model.md](./data-model.md)

These are manual validation scenarios; Folio has no automated test runner. Run them from the
repository root. Expected values below refer to the bundled `samples/` documents.

## Prerequisites

- Node.js LTS, the version range stated in README.md.
- Dependencies installed once: `npm install`.

## Build and run

```sh
npm run build:renderer                    # gate 1: the renderer bundles without esbuild errors
npm start -- samples/formatting-tour.md   # open one document
npm start -- samples                      # open the samples folder in folder mode (entry: formatting-tour.md)
```

## Scenario 1: Find in the rendered document (User Story 1, FR-001 to FR-012)

1. Run `npm start -- samples/formatting-tour.md`. Press **Ctrl/Cmd+F**.
   **Expected**: a find bar appears at the top-right of the document area, the field has focus, and
   the view stays rendered.
2. Type `typora`.
   **Expected**: four occurrences are highlighted and the counter reads `1/4`. The first one, in the
   inline code `#typora-source` of the task list, has the stronger highlight and is in view.
3. Press **Enter** four times, then **Shift+Enter** once. Also click **↓** and **↑**.
   **Expected**: Enter shows `2/4`, `3/4`, `4/4`, then wraps to `1/4`; Shift+Enter wraps back to
   `4/4`. The buttons do the same, and focus returns to the field.
4. Type `zzz`, then clear the field.
   **Expected**: `zzz` highlights nothing and shows `0/0`. The empty field shows a blank counter.
5. Type `Folio is not`.
   **Expected**: `0/0`. The phrase spans plain and bold text (see the spec's edge cases).
6. Type `typora` again. Switch **Themes ▸ Style** (Fluent, GitHub, Microsoft Word), **Page Width**
   (Dynamic, A4, US Letter) and **Appearance** (Light, Dark).
   **Expected**: the highlights stay in place and remain legible; the page layout and line wrapping
   do not change (gate 3).
7. Press **File ▸ Reload from Disk** (**Ctrl/Cmd+R**) while the bar is open.
   **Expected**: the bar stays open, the matches are recomputed and the counter returns to `1/4`.
8. Press **Esc**, then **Ctrl/Cmd+F** again.
   **Expected**: Esc hides the bar and removes the highlights. Ctrl/Cmd+F reopens it with `typora`
   selected and highlighted.
9. Press **Ctrl/Cmd+/** to enter source mode, then **Ctrl/Cmd+F**, then **Ctrl/Cmd+/** again.
   **Expected**: entering source mode closes the find bar. Ctrl/Cmd+F opens the source editor's own
   search panel at the top of the editor. After returning to the rendered view, the find bar stays
   closed.

## Scenario 2: Find in Files (User Story 2, FR-013 to FR-023)

1. Run `npm start -- samples`, or use **File ▸ Open Folder…** and pick `samples`. Press
   **Ctrl/Cmd+Shift+F**.
   **Expected**: the explorer is visible with a focused search box at the top, showing the
   placeholder "Find in files… (Esc to close)".
2. Type `typora` and pause.
   **Expected**:
   - The tree is replaced by `5 matches in 2 files`.
   - `formatting-tour.md` (badge 4, lines 24, 25, 88 and 89) is listed before `welcome.md` (badge 1,
     line 3).
   - `typora` is emphasized in every row.
   - Hovering a heading shows the file's full path.
   - The `formatting-tour.md` heading is marked as the open document.
3. Type `github.com/dpokluda`.
   **Expected**: `formatting-tour.md` line 9 is listed, because Find in Files matches the Markdown
   source (a link address). After opening it, the rendered page shows `0/0` for the same term.
4. Type `zzzz` and press **Enter** right away.
   **Expected**: `No matches` appears immediately.
5. Select all the text in the box and delete it.
   **Expected**: the file tree returns and the empty box stays visible.
6. Type `typora`, then click the **Files** button in the status bar twice.
   **Expected**: the explorer hides and comes back with the results still showing.
7. Press **Esc** in the box.
   **Expected**: the box is cleared and hidden, and the file tree returns.
8. Choose **File ▸ Close Folder** (**Ctrl/Cmd+Shift+W**), then press **Ctrl/Cmd+Shift+F**.
   **Expected**: an info dialog says "Find in Files searches an open folder." and no search box
   appears.
9. Open `samples` in this window again. Use **File ▸ New Window** (**Ctrl/Cmd+Shift+N**), open the
   `docs` folder there, and search `folio` in each window.
   **Expected**: the `samples` window lists only `formatting-tour.md` and `welcome.md`; the `docs`
   window lists only `macos-gatekeeper.md` (FR-022).

## Scenario 3: Open a result with the term highlighted (User Story 3, FR-024 to FR-026)

1. In the `samples` window, show `typora` results and click any `formatting-tour.md` row.
   **Expected**: the document is shown in the rendered view, the find bar shows `typora`, the
   counter reads `1/4` with the first occurrence in view, and **Enter** moves to `2/4`. The result
   list stays in the explorer.
2. Click the `welcome.md` row, then use **Go ▸ Back** (**Alt+Left**, or **Cmd+[** on macOS).
   **Expected**: the `welcome.md` result opens with `1/1`, and Back returns to `formatting-tour.md`.
3. Click a result for the document that is already open.
   **Expected**: it is re-read from disk and the term is highlighted again.
4. Press **Ctrl/Cmd+/** to enter source mode and type one character (the title bar shows `•`). Click
   a `welcome.md` result and choose **Cancel**. Repeat and choose **Don't Save**.
   **Expected**: the prompt "Do you want to save the changes you made?" appears. Cancel opens
   nothing and keeps the edit and the `•`. Don't Save opens `welcome.md` in the source editor with
   no highlights.

   Known limitation, recorded in research.md: after Cancel the term stays pending. If the next
   document in that window loads in the rendered view, the find bar opens with that term.

## Scenario 4: Stay responsive on large folders (User Story 4, FR-027 to FR-029)

1. Create a scratch folder in your home directory.

   macOS / Linux:

   ```sh
   mkdir -p ~/folio-find-check && cd ~/folio-find-check
   for i in $(seq -w 1 30); do
     for j in $(seq 1 60); do echo "line $j has a needle in it"; done > "note-$i.md"
   done
   ```

   Windows (PowerShell):

   ```powershell
   New-Item -ItemType Directory -Force ~/folio-find-check | Out-Null; Set-Location ~/folio-find-check
   1..30 | ForEach-Object { $n = '{0:D2}' -f $_; 1..60 | ForEach-Object { "line $_ has a needle in it" } | Set-Content "note-$n.md" }
   ```

2. Open `~/folio-find-check` with **File ▸ Open Folder…** and search `needle`.
   **Expected**: `1000 matches in 20 files (truncated)`. Groups `note-01.md` to `note-20.md` each
   show a badge of 50, although every file has 60 matching lines.
3. Type `needle` quickly in a fresh box.
   **Expected**: the list updates once you stop typing, not once per keystroke, and within about a
   second (SC-004).
4. From the shell, run `echo "unique-term-1" >> note-05.md`, then search `unique-term-1` right away.
   **Expected**: `1 match in 1 file` (a saved change is picked up on the next search).
5. Run `rm note-05.md` (PowerShell: `Remove-Item note-05.md`) and search `unique-term-1` again.
   **Expected**: `No matches` immediately.
6. Create a long line: `printf '%0280d haystack\n' 0 > long-line.md` (PowerShell:
   `('0' * 280) + ' haystack' | Set-Content long-line.md`). Wait at least 5 seconds, then search
   `haystack`.
   **Expected**: `long-line.md` is listed. The file appeared within about 4 s even though the
   explorer tree does not show it until the folder is reopened. Its row shows only the first 240
   characters, all zeros, so no emphasis is visible.
7. Open the `samples` folder and search `needle`.
   **Expected**: `No matches`. Nothing from the scratch folder is reused.
8. Clean up with `rm -rf ~/folio-find-check` (PowerShell: `Remove-Item -Recurse -Force ~/folio-find-check`).

## Constitution gates for this feature

| Gate | How it is checked here |
|---|---|
| 1. Renderer builds | `npm run build:renderer` completes without errors. |
| 2. Smoke test, including the unsaved-changes guard | Scenarios 1 to 4. The guard is checked in Scenario 3, step 4. |
| 3. Light/Dark and every Style family | Scenario 1, step 6. Also check the search box, the result rows and the `<mark>` emphasis in Light and Dark ([contracts/find-ui-dom.md](./contracts/find-ui-dom.md) lists the palettes). |
| 4. Packaging (`npm run dist`) | Not applicable: no packaging, file-association or launch change. |
| 5. Principle III review | Walk through the security notes in [contracts/ipc-search-files.md](./contracts/ipc-search-files.md): the folder comes from the sender, the page sends no path, the channel is read-only, errors produce an empty result, and results are rendered as text only. |
| Documentation | README.md ▸ How to use covers Find and Find in Files. Known imprecisions are listed in [research.md](./research.md) ▸ Retroactive findings. |
