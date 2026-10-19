# Quickstart & Validation: Themed Markdown Viewer & Source Editor

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

Folio has no automated test suite, so this guide is the validation procedure for the feature and for the
constitution's verification gates. Each scenario maps to a user story. Exact strings, buttons and
defaults are in [contracts/dialogs-and-title.md](./contracts/dialogs-and-title.md) and
[contracts/menu-commands.md](./contracts/menu-commands.md), and they are not repeated here.

## Prerequisites

- Node.js LTS (README: Node 18+, developed on 20/24) and npm.
- From the repository root:

  ```sh
  npm install          # postinstall also repairs a broken Electron download (002)
  npm run build:renderer
  npm start            # builds the renderer bundle and launches Folio
  ```

- Shortcuts below are written `Ctrl/Cmd+…`: use Cmd on macOS and Ctrl on Windows and Linux.

## Test fixtures (create once, in any scratch folder; `~/folio-qa` is used below)

```sh
mkdir -p ~/folio-qa/images
cp build/icons/icon.png ~/folio-qa/images/pic.png          # any PNG works

printf -- '---\ntitle: Front matter check\ntags: [qa, folio]\n---\n# Body heading\n\nAn image: ![pic](images/pic.png)\n' > ~/folio-qa/front-matter.md

printf 'one two three\nfour five\n' > ~/folio-qa/stats.md

for i in $(seq 1 200); do printf '## Section %s\n\nParagraph %s of a long document.\n\n' "$i" "$i"; done > ~/folio-qa/long.md

cat > ~/folio-qa/unsafe.md <<'MD'
# Safety check

<script>alert('PWNED script')</script>
<img src="missing.png" onerror="alert('PWNED onerror')">
<a href="javascript:alert('PWNED raw link')">raw javascript link</a>
[markdown javascript link](javascript:alert('PWNED md link'))

<u>underlined</u> and <kbd>Ctrl</kbd>

[web link](https://example.com) · <a href="https://example.com" target="_blank">new-window link</a>

<form action="https://example.com"><button>Submit</button></form>
MD
```

On Windows, create the same files with any editor, or run the commands in Git Bash or WSL.

## Scenario 1: View a document as a themed sheet (US1, P1)

1. Launch with `npm start`. **Expect** the Welcome document, rendered and themed, with the title
   `Welcome - Folio`.
2. Help ▸ Markdown Formatting Tour. **Expect** the title `Markdown Formatting Tour - Folio`, with a
   table, checkboxes, a footnote reference (superscript) and the footnotes section at the end, emoji,
   strikethrough, curly quotes, colored code in the `js` and `python` fences, and a blockquote, all
   styled by the theme.
3. File ▸ Open… (`Ctrl/Cmd+O`) and pick `~/folio-qa/front-matter.md`. **Expect** a monospace metadata
   box at the top (not a giant heading), `Body heading`, and the image loaded from `images/pic.png`.
   The title reads `front-matter.md - Folio`.
4. File ▸ Open Recent. **Expect** `front-matter.md` first. Clear Recent, then reopen the submenu.
   **Expect** a disabled `(No recent files)`.
5. Themes ▸ Page Width ▸ A4 (004's menu). **Expect** a white sheet on a tinted backdrop painted by the
   theme, with no grey window color showing through. Return to Dynamic.
6. Help ▸ About Folio. **Expect** the version and the non-affiliation disclaimer.
7. Resize the window, quit, and relaunch. **Expect** the same window size.
8. Move `~/folio-qa/front-matter.md` away and choose it from Open Recent. **Expect** the error
   `Folio — cannot open file` naming the path, with the current document unchanged. Move the file back.

## Scenario 2: Source mode, saving, and the unsaved-changes guard (US2, P2)

1. Open `~/folio-qa/stats.md`. Press `Ctrl/Cmd+/`. **Expect** the theme-styled source editor with the
   caret in it, and the status-bar button reading `Exit Source`. Click the button. **Expect** the
   rendered page again.
2. Enter source mode and type `six`. **Expect** the title `• stats.md - Folio`. Undo until the text
   matches the saved file. **Expect** the `•` to disappear.
3. Type again and press `Ctrl/Cmd+S`. **Expect** the `•` to clear and the file on disk to contain the
   edit. Leave source mode. **Expect** the page to show the saved text.
4. Help ▸ Welcome, type a character in source mode, and press `Ctrl/Cmd+S`. **Expect** a Save As
   dialog suggesting `Welcome.md`. Save it into `~/folio-qa`. **Expect** the title `Welcome.md - Folio`,
   and `samples/welcome.md` in the repository unchanged (`git diff --stat samples/` prints nothing).
5. With unsaved edits, try each guarded action: File ▸ New, File ▸ Open…, Help ▸ Markdown Formatting
   Tour, File ▸ Reload from Disk, closing the window, and quitting. Answer **Cancel** once (**expect**
   nothing to change), **Don't Save** once (**expect** the action to proceed and the edits to be gone),
   and **Save** once (**expect** a save, then the action).
6. Failing save: make a file read-only (`chmod a-w ~/folio-qa/stats.md`, or `attrib +R` on Windows),
   edit it, then close the window and answer **Save**. **Expect** `Folio — cannot save file`, the window
   to stay open, and the `•` to remain. Restore write access afterwards.
7. Quit while in source mode and relaunch. **Expect** Folio to start in source mode. Toggle back to the
   rendered page.

## Scenario 3: Untrusted content (US3, P3)

1. Open `~/folio-qa/unsafe.md`. **Expect** no alert dialog at any point, and the title to stay
   `unsafe.md - Folio`.
2. **Expect** `underlined` to be underlined and `Ctrl` to render as a key cap. The Markdown
   `javascript:` link is not rendered as a link.
3. Click both `javascript:` links if they are clickable. **Expect** no alert.
4. Click `web link` and `new-window link`. **Expect** example.com to open in the system browser, no new
   Folio window, and the Folio window still showing the document.
5. Click **Submit**. **Expect** the Folio window to stay on the document; any web target goes to the
   system browser.

## Scenario 4: Live reload and Reload from Disk (US4, P4)

1. Open `~/folio-qa/long.md` and scroll to about the middle.
2. In a terminal, run `printf 'Appended externally.\n' >> ~/folio-qa/long.md`. **Expect** the page to
   refresh within 2 seconds without a prompt, at about the same reading position.
3. Make an edit in source mode (the `•` appears) and append again from the terminal. **Expect** the
   prompt `long.md was modified outside Folio.`, with **Keep My Changes** as the default. Choose it:
   the edits remain. Append once more and choose **Reload**: the edits are replaced by the disk content.
4. Edit, then press `Ctrl/Cmd+S`. **Expect** no external-change prompt for Folio's own save.
5. Simulate an atomic save:
   `cp ~/folio-qa/long.md ~/folio-qa/long.tmp && printf 'Replaced atomically.\n' >> ~/folio-qa/long.tmp && mv ~/folio-qa/long.tmp ~/folio-qa/long.md`.
   **Expect** a refresh showing the new last line.
6. Press `Ctrl/Cmd+R` (File ▸ Reload from Disk). **Expect** an in-place reload. File ▸ New, then open
   the File menu. **Expect** Reload from Disk to be disabled.
7. Reopen `long.md`, then delete it from the terminal. **Expect** the content to stay on screen. Press
   `Ctrl/Cmd+R`. **Expect** `Folio — cannot reload file`. Recreate the file with
   `for … > ~/folio-qa/long.md` from the fixtures.

## Scenario 5: Outline, status bar, zoom (US5, P5)

1. Open `~/folio-qa/stats.md` (restore its original content `one two three⏎four five⏎` first).
   **Expect** the status bar `5 words · 24 chars · 3 lines · ~1 min read`; compare with `wc -w`
   (5) and `wc -m` (24). Type in source mode. **Expect** the numbers to change on every keystroke.
2. Help ▸ Markdown Formatting Tour, then `Ctrl/Cmd+Alt+O` (or the **Outline** button). **Expect** a
   sidebar of headings indented by level and the Outline button highlighted. Click **Tables**.
   **Expect** a smooth scroll to that heading.
3. Press `Ctrl/Cmd++` repeatedly. **Expect** the whole window (page, sidebar, status bar) to grow in
   10% steps and to stop at 250%, with the status bar always visible at the bottom. Press
   `Ctrl/Cmd+-` down to 50%, with no dead space below the status bar. `Ctrl/Cmd+0` returns to 100%.
4. Windows/Linux only: check `Ctrl+=`, `Ctrl+Shift+=`, numpad `+`, `-` and `0`, both on the page and
   with the source editor focused.
5. Set a non-default zoom, quit, and relaunch. **Expect** the zoom to be restored and the outline hidden
   (startup layout, 003).

## Scenario 6: Export to PDF (US6, P6)

1. Help ▸ Markdown Formatting Tour, then File ▸ Export to PDF…. **Expect** the suggested name
   `Markdown Formatting Tour.pdf`. Save it, then open the PDF. **Expect** the rendered, themed page
   with backgrounds and A4 paper (210 × 297 mm) under the Dynamic or A4 page width.
2. Themes ▸ Page Width ▸ US Letter (004), then export again. **Expect** 8.5 × 11 in paper. Restore the
   page width.
3. Enter source mode and export. **Expect** Folio to switch to the rendered page first, and the PDF to
   show the rendered document.
4. Cancel the export dialog. **Expect** no file to be written.
5. **Unverified-risk check** (research.md finding 11a): export `~/folio-qa/long.md` with the outline
   visible. Confirm that the PDF has many pages covering all 200 sections, and that neither the
   outline nor the status bar appears in it. Record the result.

## Scenario 7: Constitution gates

| Gate | Check | Expected |
|---|---|---|
| 1. Build | `npm run build:renderer` | Completes without esbuild errors. |
| 2. Smoke + unsaved guard | Scenarios 1–6, especially Scenario 2 steps 5–6 | All expectations met. |
| 3. Light/Dark and Style families | Themes ▸ Appearance ▸ Light and Dark (004) × Style ▸ Fluent, GitHub, Microsoft Word; repeat Scenario 1 steps 2–3 and Scenario 5 step 2 | Page, source editor, status bar, outline and front-matter box are legible in every combination. |
| 4. Packaging | Not required for this feature. Optionally, with `npm run dist` (002), confirm that the packaged Welcome is the real document, not the stub (the `9c3abe5` regression). | Real Welcome renders. |
| 5. Principle III review | Scenario 3, plus a code review of `src/renderer/index.html` (CSP keeps `script-src 'self'`), `renderPreview()` (`DOMPurify.sanitize` before `innerHTML`), `open-external` (`^https?://` only), and `setWindowOpenHandler` / `will-navigate` in `createWindow()` | No document code executes; only `http(s)` reaches the browser. |

## Known-gap check (documents shipped behavior)

Open a file, make an unsaved edit, then choose any entry from File ▸ Open Recent. **Shipped behavior**:
the document is replaced **without** the save prompt (research.md finding 4). When a follow-up spec
fixes this, the expected result becomes the standard Save / Don't Save / Cancel prompt.
