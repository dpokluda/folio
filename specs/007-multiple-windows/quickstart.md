# Quickstart: Validate Multiple Independent Windows

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [menu-commands](./contracts/menu-commands.md), [ipc-channels](./contracts/ipc-channels.md), [window-lifecycle](./contracts/window-lifecycle.md) | **Data model**: [data-model.md](./data-model.md)

This is a manual validation guide. Folio has no automated test runner, so these scenarios and the constitution's quality gates are how the feature is verified. Each scenario names the user story (US) and the requirements (FR/SC) it proves. Expected results describe the shipped behavior.

## Prerequisites

- Node.js LTS (Node 18 or later; see README.md) and a checkout of the repository.
- Install the dependencies once:

  ```sh
  npm install
  ```

- Create a scratch folder with linked documents for the folder and history checks. On Windows, use the PowerShell equivalents or create the files by hand:

  ```sh
  mkdir -p ~/folio-windows-test/notes
  printf '# Notes\n\n- [Alpha](alpha.md)\n- [Beta](beta.md)\n' > ~/folio-windows-test/notes/_index.md
  printf '# Alpha\n\nSee [Beta](beta.md).\n' > ~/folio-windows-test/notes/alpha.md
  printf '# Beta\n\nBack to [Alpha](alpha.md).\n' > ~/folio-windows-test/notes/beta.md
  cp samples/formatting-tour.md ~/folio-windows-test/tour.md
  ```

## Run

```sh
npm start                                   # builds the renderer bundle, then launches Folio on Welcome
npm start -- ~/folio-windows-test/tour.md   # launch with a file (or hand it to a running Folio)
npx electron . ~/folio-windows-test/notes   # like npm start, but skips the rebuild (useful for a second launch)
```

## Scenario 1: New Window gives an independent document (US1; FR-001, FR-002, FR-003; SC-001)

1. Run `npm start`. Window A shows Welcome.
2. In A, choose File > Open… and pick `~/folio-windows-test/tour.md`.
3. Choose File > New Window (`Ctrl/Cmd+Shift+N`).
   - **Expected**: window B opens on **Welcome**. A still shows `tour.md`.
4. In B, choose File > Open Folder… (`Ctrl/Cmd+Shift+O`) and pick `~/folio-windows-test/notes`.
   - **Expected**: B shows the explorer and `_index.md`. A has no explorer.
5. In A, toggle source mode (`Ctrl/Cmd+/`) and type a word.
   - **Expected**: A's title becomes `• tour.md - Folio`. B's title stays `_index.md - Folio`, and B's content and explorer do not change.

## Scenario 2: Commands follow the window in front (US1; FR-004, FR-005, FR-006)

1. Bring B to the front and open the File menu.
   - **Expected**: Close Folder and Reload from Disk are enabled.
2. Bring A to the front and open the File menu.
   - **Expected**: Close Folder is disabled.
3. In B, click `alpha.md` in the explorer, then the **Beta** link, then Go > Back (`Alt+Left`, or `Cmd+[` on macOS).
   - **Expected**: B returns to Alpha. With A in front, Go > Back is disabled and A's document is unchanged.
4. In B, press `Ctrl/Cmd+Shift+F` and search for `Alpha`.
   - **Expected**: the results come from B's folder.
5. Bring A to the front and press `Ctrl/Cmd+Shift+F`.
   - **Expected**: A shows the "Find in Files searches an open folder" hint, attached to A.
6. With B in front, choose View > Toggle Source Code Mode.
   - **Expected**: only B switches mode.

## Scenario 3: Unsaved guard per window, save isolation and quitting (US1; FR-007 to FR-010; SC-007)

1. Close the dirty window A with its close button (or `Cmd+W` on macOS).
   - **Expected**: A asks "Do you want to save the changes you made?" with Save / Don't Save / Cancel. B is not prompted.
2. Choose **Cancel**.
   - **Expected**: A stays open with its edits and the `•` marker.
3. Close A again and choose **Save**.
   - **Expected**: `tour.md` on disk now contains A's edit, B's document is unchanged, and A closes.
4. Make B dirty, open a third window C with File > New Window and leave it clean, then quit (File > Quit on Windows/Linux, Folio > Quit Folio on macOS).
   - **Expected**: C closes without a prompt and B asks. Cancel keeps B open with its edits.
5. Open `notes/alpha.md` in two windows. Edit and save it in one window.
   - **Expected**: the other window, if clean, reloads the file within about 2 seconds (1-second poll). If the other window has unsaved edits, it asks **Reload / Keep My Changes** on itself, and Keep My Changes is the default.

## Scenario 4: A second launch opens a new window (US2; FR-012 to FR-016; SC-002)

1. With Folio running and one window dirty, run this from a second terminal in the repository:

   ```sh
   npx electron . ~/folio-windows-test/tour.md
   ```

   - **Expected**: the second process exits at once. The running Folio opens **a new window** on `tour.md` in front, cascaded from an existing Folio window. The dirty window keeps its edits, and no prompt appears.
2. Run `npx electron . ~/folio-windows-test/notes`.
   - **Expected**: a new window opens in folder mode on `notes` (explorer and `_index.md`).
3. Minimize every Folio window, then run `npx electron .` with no path, or `npx electron . does-not-exist.md`.
   - **Expected**: no new window. The most recently used Folio window is restored and comes to the front.
4. macOS only, with a packaged build that is registered for `.md` (see 002): while Folio runs, double-click a `.md` file in Finder.
   - **Expected**: it opens in a new window.
5. macOS only: close every window, then run `folio` (003) or `npx electron .` with no path.
   - **Expected**: a new Welcome window opens.

## Scenario 5: Shared preferences (US3; FR-017 to FR-020; SC-003)

1. Open three windows. From the middle one, choose Themes > Style > GitHub, then Themes > Page Width > A4, then Themes > Appearance > Dark.
   - **Expected**: every change shows in **all three** windows immediately, and the Themes check marks match whichever window is in front. Switch back to Light.
2. Open `notes/beta.md` in window 1, then open File > Open Recent in window 3.
   - **Expected**: `beta.md` is listed.
3. Resize window 3 to a clearly different size and close it, then choose File > New Window.
   - **Expected**: the new window has window 3's size, and windows 1 and 2 keep their sizes.
4. In window 1, turn on source mode and View > Show Line Numbers, then choose File > New Window.
   - **Expected**: the new window starts in source mode with line numbers. Window 2 stays as it was.

## Scenario 6: Cascade placement (US4; FR-021 to FR-023; SC-004)

1. Restart Folio.
   - **Expected**: the first window opens at the OS default position. Positions are not remembered.
2. Press `Ctrl/Cmd+Shift+N` repeatedly.
   - **Expected**: each new window's top-left corner is 30 points right of and below the window in front, and each has the remembered size.
3. Keep going until the next offset would cross the right or bottom edge of the usable screen area.
   - **Expected**: that window starts at the top-left corner of the usable area (below the macOS menu bar, clear of the Windows taskbar), and no window extends past the right or bottom edge.
4. With two displays, move a window to the secondary display, focus it and press `Ctrl/Cmd+Shift+N`.
   - **Expected**: the new window cascades on that display.

## Scenario 7: Window menu and switching (US5; FR-024 to FR-028; SC-005, SC-006)

1. Open three windows in this order: `tour.md`, `notes` (folder) and Welcome. Open the Window menu.
   - **Expected**: the list shows `tour.md`, `_index.md` and `Welcome` in that order, with a mark on the window in front.
2. Choose another entry.
   - **Expected**: that window comes to the front and the mark follows it.
3. Use Window > Minimize on one window (the menu item has no shortcut), then choose that window from the list.
   - **Expected**: it is restored and focused.
4. Press `Ctrl+Tab` on Windows/Linux or `` Cmd+` `` on macOS repeatedly.
   - **Expected**: focus cycles through the windows in list order and wraps from the last to the first. `Ctrl+Shift+Tab` / `` Cmd+Shift+` `` cycles backwards.
5. Type in the `tour.md` window, then save it, then Save As `tour-copy.md`.
   - **Expected**: its entry shows `• tour.md`, then `tour.md`, then `tour-copy.md`.
6. Close windows until only one is left.
   - **Expected**: each closed window drops out of the list. With one window, Select Next Window and Select Previous Window are disabled.
7. macOS only: try Window > Zoom and Window > Bring All to Front.
   - **Expected**: Zoom toggles the zoomed size of the front window, and Bring All to Front raises every Folio window. On Windows/Linux these items are absent.
8. In source mode, press `Ctrl/Cmd+M`.
   - **Expected**: inline math is inserted (008); the window is not minimized.

## Scenario 8: The last window closes (FR-011, FR-029; SC-008)

- **Windows/Linux**: close every window.
  - **Expected**: Folio quits, and the `npm start` terminal returns to its prompt.
- **macOS**: close every window.
  - **Expected**: Folio stays running (Dock and menu bar), and the Window menu shows **(No open windows)**.
  - View > Toggle Source Code Mode does nothing.
  - File > Open… opens a new window and shows the dialog on it. Cancel, then close that window.
  - Clicking the Dock icon opens a Welcome window.
  - README.md says the app quits here on every platform. This scenario documents the shipped behavior; see [research.md, finding 1](./research.md#retroactive-findings).

## Constitution quality gates for this feature

1. **Build**: `npm run build:renderer` completes without esbuild errors, because `src/renderer/renderer.js` gained `handleMainRequest`.
2. **Smoke test**: run scenarios 1 to 8 with `npm start`, including the unsaved-changes guard in scenario 3.
3. **Light/Dark**: repeat scenario 5, step 1 in Light and Dark for every Style family (Fluent, GitHub, Microsoft Word), and confirm that every open window follows.
4. **Packaging and launch integration**: `second-instance` routing and macOS `open-file` changed, so run `npm run dist` on the host platform. Install or launch the packaged app and repeat scenario 4 with the packaged binary (and the `folio` command from 003). List any platform that was not verified.
5. **Principle III review**: review the new `folio-request`/`folio-response` pair and `folioAPI.onRequest` against [contracts/ipc-channels.md](./contracts/ipc-channels.md). Confirm that every Session-scoped handler resolves `event.sender`, and note the open follow-up on reply-sender checking ([research.md, finding 4](./research.md#retroactive-findings)).
