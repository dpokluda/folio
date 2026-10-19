# Quickstart: Folder Mode, Link Navigation & Back/Forward History

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/) | **Data model**: [data-model.md](./data-model.md)

Manual validation guide for the shipped feature. Folio has no automated test runner, so these scenarios, together with the constitution's verification gates, are the acceptance procedure. Each scenario maps to a user story in the spec; exact dialog texts, accelerators and rules are defined in the contracts and are not repeated here.

## Prerequisites

- Node.js LTS (README: Node 18+) and a checkout of the repository.
- Dependencies installed once: `npm install`.
- A desktop session on macOS, Windows or Linux. Note your platform's keys: Open Folder `Ctrl/Cmd+Shift+O`, Close Folder `Ctrl/Cmd+Shift+W`, Toggle File Explorer `Cmd+Alt+E` (macOS) or `Ctrl+Alt+E`, Back/Forward `Cmd+[`/`Cmd+]` (macOS) or `Alt+Left`/`Alt+Right`.

## Run

```sh
npm run build:renderer            # gate 1: must finish without esbuild errors
npm start                         # Welcome document, no explorer
npm start -- "$HOME/folio-qs-005" # opens straight into folder mode (launch behavior: 003)
```

## Fixture

The bundled `samples/` documents contain no links between files, so create a scratch folder. In a POSIX shell (macOS, Linux, Git Bash or WSL on Windows):

```sh
QS="$HOME/folio-qs-005"
mkdir -p "$QS/guide" "$QS/no-index" "$QS/assets-only" "$QS/.hidden" "$QS/node_modules/pkg"
cat > "$QS/README.md" <<'MD'
# Folio QS

- [Guide folder](guide/)
- [Chapter 2, second section](guide/chapter%202.md#second-section)
- [Folder without index](no-index/)
- [Missing file](nope.md)
- [Script](run.sh)
- [Data](data.csv)
- [Web](https://example.com)
- [Mail](mailto:someone@example.com)
- [Jump to Notes](#notes)

## Notes

The end of the entry document.
MD
printf '# Guide index\n\n[Chapter 2](chapter%%202.md#second-section)\n\n[Home](../README.md)\n' > "$QS/guide/_index.md"
printf '# Guide README\n\nShown only if _index.md is missing.\n' > "$QS/guide/README.md"
{
  printf '# Chapter 2\n\n[Back to README](../README.md) · [Second copy](#second-section-1)\n\n'
  for i in $(seq 1 40); do printf 'Filler paragraph %s.\n\n' "$i"; done
  printf '## Second Section\n\nFirst heading with this text.\n\n'
  for i in $(seq 1 40); do printf 'More filler %s.\n\n' "$i"; done
  printf '## Second Section\n\nDuplicate heading, addressed as #second-section-1.\n'
} > "$QS/guide/chapter 2.md"
printf '# Page\n\nThis folder has Markdown but no index file.\n' > "$QS/no-index/page.md"
printf 'not markdown\n' > "$QS/assets-only/notes.txt"
printf '# Secret\n' > "$QS/.hidden/secret.md"
printf '# Package\n' > "$QS/node_modules/pkg/README.md"
printf '#!/bin/sh\necho should never run\n' > "$QS/run.sh"
printf 'a,b\n1,2\n' > "$QS/data.csv"
for f in a2 a10 B1; do printf '# %s\n' "$f" > "$QS/$f.md"; done
```

Optional plain-Node check of the Electron-free module (constitution VI), from the repository root:

```sh
node -e "const f=require('./src/folder.js');const t=f.scanFolder(process.argv[1]);console.log(t.map(n=>n.name), f.entryDocFor(t))" "$HOME/folio-qs-005"
```

Expected: `[ 'guide', 'no-index', 'a2.md', 'a10.md', 'B1.md', 'README.md' ]` and the path of `README.md`.

## Scenario 1: Browse a folder (US1)

1. `npm start`, then File > Open Folder… and pick `folio-qs-005`.
   - The explorer appears at the left, titled `FOLIO-QS-005`, listing collapsed `guide` and `no-index`, then `a2.md`, `a10.md`, `B1.md`, `README.md`.
   - `.hidden`, `node_modules`, `assets-only`, `run.sh` and `data.csv` are absent.
   - `README.md` is displayed and highlighted; the **Files** status-bar button is highlighted.
2. Expand `guide`: it lists `_index.md`, `chapter 2.md`, `README.md`. Click `chapter 2.md`: it is displayed and highlighted. Hover an entry: the tooltip shows its full path.
3. Press the Toggle File Explorer key, then click **Files**: the pane hides and shows again, and the button's highlight follows.
4. Unsaved-changes guard (gate 2): press `Ctrl/Cmd+/`, type a character (the title shows `•`), click `a2.md`. Expect the Save / Don't Save / Cancel prompt. **Cancel** keeps the edited document; repeat and choose **Don't Save**: `a2.md` is displayed.
5. Open Folder on `folio-qs-005/no-index`: `page.md` opens (first-Markdown fallback). Open Folder on `folio-qs-005/assets-only`: the pane shows "No markdown files", the previous document stays, and Go > Back is disabled.
6. Open `folio-settings.json` in Electron's `userData` directory (for example under `~/Library/Application Support/` on macOS, `%APPDATA%` on Windows, `~/.config/` on Linux, in the folder named after the app): `folder` holds the last opened folder and `filesVisible` is `true`. Quit and run `npm start` without arguments: Folio starts on Welcome without the explorer (startup is defined by 003).

## Scenario 2: Follow links in place (US2)

Reopen `folio-qs-005`; `README.md` is displayed.

1. Click **Guide folder**: `guide/_index.md` opens (preferred over `guide/README.md`), the `guide` folder expands and the entry is highlighted.
2. Click **Chapter 2**: `chapter 2.md` opens scrolled to the first "Second Section". Click **Second copy**: the preview scrolls smoothly to the duplicate heading (`#second-section-1`).
3. Back in `README.md` (explorer click), click **Folder without index**: the "Nothing to display for this folder." message names `no-index`; `README.md` stays. Click **Missing file**: "Cannot find the linked item." shows the resolved `…/nope.md`.
4. Click **Jump to Notes**: the preview scrolls to "Notes" without reloading.
5. Untitled documents: File > New, `Ctrl/Cmd+/`, type `[rel](README.md)` and `[abs](</full/path/to/folio-qs-005/README.md>)`, press `Ctrl/Cmd+/` again. Clicking **rel** does nothing. Clicking **abs** shows the unsaved-changes prompt (the new document was edited); **Don't Save** opens `README.md`.
6. Guard: edit `README.md` in source mode, return to the preview, click **Chapter 2, second section**, choose **Cancel**: nothing changes.

## Scenario 3: Web links and other files (US3)

From `README.md`:

1. **Web** opens `https://example.com` in the default browser; Folio keeps showing `README.md`.
2. **Script** shows "Blocked opening an executable or script."; nothing runs.
3. **Data** asks "Open this file with its default application?" and shows the absolute path of `data.csv`; Cancel is the default button. **Open** launches the system's default application for `.csv`.
4. **Mail** does nothing.
5. Optional, Windows: add `[Share](//localhost/c$/Windows/win.ini)` to a saved document and click it. Expect "Blocked opening a network location." when the administrative share is reachable, otherwise "Cannot find the linked item.". On macOS and Linux the same link reports "Cannot find the linked item.".

## Scenario 4: Back and Forward (US4)

1. Reopen `folio-qs-005`: Go > Back and Go > Forward are both disabled.
2. Click **Guide folder**, then **Chapter 2**. Press Back: `_index.md`. Press Back: `README.md`, and Back is now disabled. Press Forward twice: `chapter 2.md`, scrolled to "Second Section" again. The explorer highlight follows every step.
3. Press Back once (`_index.md`), then click **Home**: Forward becomes disabled (the forward entry was dropped).
4. Guard: edit the current document in source mode, press Back, choose **Cancel**: same document, same position.
5. Missing entry: click `a2.md`, then `a10.md` in the explorer, delete the file (`rm "$HOME/folio-qs-005/a2.md"`), press Back: "That document is no longer available." names `a2.md` and `a10.md` stays. Pressing Back again shows the same warning (see research.md, finding 5). Restore it: `printf '# a2\n' > "$HOME/folio-qs-005/a2.md"`.
6. Help > Welcome (choose **Don't Save** if prompted): Back and Forward are disabled.
7. Per window (007): File > New Window, open the folder there and follow a link; switch windows with the Window menu. The Go menu always reflects the focused window, and each window walks its own history.

## Scenario 5: Close Folder (US5)

1. With the folder open, File > Close Folder: the explorer is cleared and hidden, Welcome is shown (title "Welcome - Folio"), and Close Folder, Back and Forward are disabled.
2. Reopen the folder, edit the document, choose Close Folder, then **Cancel**: the folder and the edited document stay.
3. After closing, `folio-settings.json` holds `"folder": null` and `"filesVisible": false`. Pressing the Toggle File Explorer key shows the pane with "No folder open".

## Scenario 6: Hover hint (US6)

With `README.md` displayed:

1. Hover **Chapter 2, second section**: the bottom-left hint shows the decoded absolute path `…/folio-qs-005/guide/chapter 2.md` (the fragment is not shown).
2. Hover **Web**: `https://example.com`. Hover **Mail**: `mailto:someone@example.com`. Hover **Jump to Notes**: `#notes`.
3. Move the pointer off the link or out of the document area: the hint disappears. Hover again and press `Ctrl/Cmd+/`: it disappears.
4. Narrow the window and hover a long link: the text ends with an ellipsis, and clicking through the hint area still reaches the document.

## Constitution gates

| Gate | How this guide covers it |
|------|--------------------------|
| 1. Renderer build | `npm run build:renderer` in [Run](#run) |
| 2. Smoke test with the unsaved-changes guard | Scenarios 1.4, 2.6, 4.4 and 5.2 |
| 3. Light and Dark, every Style | Repeat Scenario 1.1 and Scenario 6.1 under Themes > Appearance > Light and Dark (and System), and under Style Fluent, GitHub and Microsoft Word: the explorer and the hint switch between their light and dark palettes and look the same under every Style |
| 4. Packaging and OS integration | N/A: this feature changes no packaging; the folder launch argument is validated by 003 |
| 5. Principle III review | Review `navigate`, `open-folder` and `open-external` against [contracts/ipc-channels.md](./contracts/ipc-channels.md), and the external-open and window guards against [contracts/link-navigation.md](./contracts/link-navigation.md) §5–6; Scenario 3 exercises them |

Clean up afterwards: `rm -rf "$HOME/folio-qs-005"`.
