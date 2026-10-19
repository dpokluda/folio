# Quickstart: Follow the OS Light/Dark Setting (System Appearance)

This guide validates [spec.md](./spec.md) end to end. Interfaces are defined in [contracts/menu-commands.md](./contracts/menu-commands.md), [contracts/settings-schema.md](./contracts/settings-schema.md) and [contracts/ipc-channels.md](./contracts/ipc-channels.md); state and transitions are in [data-model.md](./data-model.md).

## Prerequisites

- Node.js LTS (see README.md) and `npm install` run in the repository root.
- A way to change the OS light/dark setting while Folio runs:
  - **macOS**: System Settings ▸ Appearance ▸ Light / Dark / Auto. To toggle quickly from Terminal: `osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode'`.
  - **Windows 10/11**: Settings ▸ Personalization ▸ Colors ▸ Choose your mode. With *Custom*, Folio follows *Choose your default app mode*. For scheduled switching, use a tool such as PowerToys Light Switch.
  - **Linux (GNOME)**: Settings ▸ Appearance ▸ Style, or `gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'` (and `'default'` to switch back).
- For scenario 2, the settings file: `folio-settings.json` in Folio's user-data folder, which is `~/Library/Application Support/<app>/` on macOS, `%APPDATA%\<app>\` on Windows and `~/.config/<app>/` on Linux. `<app>` is the application name: `folio` under `npm start`, possibly `Folio` for a packaged build.

## Run

```sh
npm start                                  # opens the Welcome document
npm start -- samples/formatting-tour.md    # a document with two Mermaid diagrams
```

## Validation scenarios

### 1. Choose System (User Story 1; FR-001–FR-004, SC-001)

1. Set the OS to **Dark**, start Folio, and choose **Themes ▸ Light** if it is not already selected.
2. Open **Themes**. **Expected**: the Appearance group lists Light, Dark and System, and only Light is checked.
3. Choose **System**. **Expected**: within 1 second the page, status bar and any open panels turn dark, and System is the only checked Appearance item.
4. Quit Folio and run `npm start` again. **Expected**: System is still checked and the window opens dark, matching the OS.
5. Choose **Light**. **Expected**: Folio turns light at once and stays light when the OS is flipped (also covered in scenario 3).

### 2. Default and fallback (User Story 1; FR-002, FR-004, FR-005, SC-004)

1. Quit Folio. In `folio-settings.json`, set `"appearance": "sepia"`. Start Folio with the OS in Dark.
2. **Expected**: Folio starts normally in **Light** and Themes shows **Light** checked. The file still contains `"sepia"`.
3. Quit, delete the `"appearance"` line and start again. **Expected**: Light again (the default for a missing value).
4. Choose **System**. **Expected**: Folio turns dark and the file now contains `"appearance": "system"`.

### 3. Live follow across windows (User Story 2; FR-006–FR-008, SC-002, SC-005)

1. With **System** selected, open a second window (**File ▸ New Window**, `Ctrl/Cmd+Shift+N`). Show the outline in one window (`Ctrl/Cmd+Alt+O`) and switch the other to source mode (`Ctrl/Cmd+/`).
2. Bring another application to the front so that both Folio windows are in the background, and minimize one of them.
3. Flip the OS appearance. **Expected**: within 2 seconds the visible Folio window shows the new palette in the page or source editor, outline and status bar. The minimized window shows it as soon as it is restored. Do not interact with Folio before checking.
4. Optional, automatic switch: set macOS to **Auto**, or create a PowerToys Light Switch schedule on Windows. **Expected**: Folio follows when the OS switches.
5. Choose **Themes ▸ Dark** and flip the OS. **Expected**: Folio stays dark. Choose **System** again. **Expected**: Folio immediately adopts the OS's current setting.
6. macOS only: close every window (Folio keeps running), flip the OS, then click the Dock icon. **Expected**: the new window opens in the OS's current appearance.

### 4. Diagrams follow the flip (User Story 3; FR-009, FR-010, SC-003)

1. With **System** selected, open **Help ▸ Markdown Formatting Tour** and scroll to **Diagrams** (a flowchart and a sequence diagram).
2. Flip the OS appearance. **Expected**: within 2 seconds both diagrams are redrawn in the matching diagram palette; there are no light diagram boxes on a dark page, and no dark ones on a light page.
3. Switch to source mode (`Ctrl/Cmd+/`) and type a character, so the title shows `•`. Flip the OS, then return to the preview (`Ctrl/Cmd+/`). **Expected**: the diagrams use the current palette, your edit is present and `•` remains.
4. Leave the same document in a background window and flip the OS again. **Expected**: when you return to that window, its diagrams already match.
5. Open `samples/welcome.md` (no diagrams), select a sentence and flip the OS. **Expected**: only the colours change; the selection and the scroll position stay put.
6. When closing the edited tour window, choose **Don't Save** at the unsaved-changes prompt.

### 5. PDF export under System (User Story 3; FR-011, SC-005)

1. With **System** selected and the OS in Dark, open the Formatting Tour.
2. Choose **File ▸ Export to PDF…** and save. **Expected**: no Folio window changes appearance during or after the export, and both diagrams are fully drawn in the PDF. Note the PDF's palette: the appearance in effect is used, not a forced Light one (see [research.md](./research.md#retroactive-findings), finding 3).
3. Repeat with the OS in Light and compare.

### 6. System when the OS already matches (edge case)

1. Set the OS to Light and choose **Themes ▸ Light**, then choose **System**. **Expected**: nothing visible changes except the checked item.

### 7. Constitution gates

- **Gate 1**: `npm run build:renderer` completes without esbuild errors. The renderer source is unchanged by this feature.
- **Gate 2**: Scenarios 1–6 are smoke-tested with `npm start`. Scenario 4, step 3 covers unsaved edits surviving a redraw.
- **Gate 3**: With **System** selected, flip the OS Light ↔ Dark under each **Style** (Fluent, GitHub, Microsoft Word) and each **Page width** (Dynamic, A4, US Letter). In every combination the page, the source editor and Folio's chrome switch together.
- **Gate 4**: N/A, because no packaging, file-association, launch or install code changed. Optionally repeat scenario 3 in a build produced by `npm run dist`.
- **Gate 5**: `git show --stat 0bbcf84` lists no `src/preload.js` or `src/renderer/` file. Review the reused channel against Principle III using [contracts/ipc-channels.md](./contracts/ipc-channels.md).
- **Documentation**: README.md lists "Light, Dark, System" in Features, How to use and the Themes table. The sentence "3 × 2 × 3 = 18 combinations" is stale (see [research.md](./research.md#retroactive-findings), finding 1).
