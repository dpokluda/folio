# Feature Specification: Follow the OS Light/Dark Setting (System Appearance)

**Feature Branch**: `011-system-appearance`

**Created**: 2026-09-30

**Status**: Implemented (retroactive)

**Input**: User description: "Add a System option to Themes > Appearance that follows the operating system's light/dark setting live, including automatic switches such as macOS Auto appearance or a scheduled light/dark change on Windows, without restarting Folio. Diagrams should re-render in the matching palette when the appearance flips."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `0bbcf84` (2026-09-30) as a third choice on the Appearance axis defined by [004-three-axis-theming](../004-three-axis-theming/spec.md). The diagram redraw it relies on was already in place for manual Light/Dark switches since `1ce68e0` (2026-08-12, [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md)). Related: [007-multiple-windows](../007-multiple-windows/spec.md) (app-wide preferences are shared by all windows).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Let the operating system decide Light or Dark (Priority: P1)

A reader who already runs their operating system in Dark (or Light) mode wants Folio to match it without changing Folio separately. They open the **Themes** menu and, under **Appearance**, pick **System** instead of Light or Dark. Folio immediately takes on the operating system's current light/dark setting in every open window, the menu shows System as the selected Appearance, and the choice is remembered the next time Folio starts.

**Why this priority**: This is the feature in its smallest useful form: one menu choice that hands the light/dark decision to the operating system. On its own it already gives a user whose operating system is in Dark mode a dark Folio on every launch, with no further trips to the Themes menu.

**Independent Test**: Set the operating system to Dark while Folio is on Light, choose Themes ▸ System, and confirm Folio turns dark at once in every window; quit and relaunch, and confirm System is still selected and Folio starts dark.

**Acceptance Scenarios**:

1. **Given** the operating system is set to Dark and Folio's Appearance is Light, **When** the user chooses Themes ▸ System, **Then** every open Folio window switches to the dark palette immediately, without a restart or a reload of the document, and System is the only Appearance shown as selected.
2. **Given** the operating system is set to Light and Folio's Appearance is Dark, **When** the user chooses System, **Then** every open window switches to the light palette.
3. **Given** System is selected, **When** the user quits and relaunches Folio or opens a new window, **Then** System is still selected and the window opens in the operating system's current appearance.
4. **Given** System is selected, **When** the user chooses Light or Dark, **Then** Folio stops following the operating system and uses the explicit choice immediately.
5. **Given** Folio has never been configured (first launch), **When** it starts, **Then** it opens in Light as before; System is used only once the user picks it.
6. **Given** the saved Appearance is a value Folio does not recognize, **When** Folio starts, **Then** it starts normally in Light and shows Light as the selected Appearance.

---

### User Story 2 - Follow the operating system's changes live (Priority: P2)

With System selected, the user's operating system changes between light and dark during the day: they flip it by hand, macOS's *Auto* appearance switches at dusk, or a scheduling tool switches Windows between light and dark at set times. Folio follows each change while it is running, in every open window, including windows in the background, without a restart and without the user touching Folio.

**Why this priority**: Live tracking is what makes System better than picking Light or Dark by hand, and the request explicitly asks for it (automatic switches, no restart). It builds directly on the choice made in Story 1.

**Independent Test**: With System selected and two windows open behind another application, change the operating system's appearance and confirm both windows switch within 2 seconds with no interaction with Folio; repeat with Dark selected explicitly and confirm nothing changes.

**Acceptance Scenarios**:

1. **Given** System is selected and Folio shows a document in Light, **When** the operating system switches to Dark, by hand or automatically, **Then** within 2 seconds the rendered page (or the source editor, if it is showing) and Folio's own panels (outline, file explorer, status bar, find bar) all show the dark palette, with no restart.
2. **Given** System is selected and several windows are open, some behind other applications or minimized, **When** the operating system's appearance changes, **Then** every window shows the new appearance; minimized windows show it as soon as they are restored.
3. **Given** Light or Dark is selected explicitly, **When** the operating system's appearance changes, **Then** Folio's appearance does not change.
4. **Given** System is selected on macOS and Folio is running with no window open, **When** the operating system's appearance changes and the user then opens a window, **Then** the new window opens in the operating system's current appearance.

---

### User Story 3 - Diagrams follow the flip (Priority: P3)

A document with diagrams (fenced code blocks marked `mermaid`) is open when the operating system switches between light and dark. Diagrams carry their own colours, so restyling the page alone would leave light-palette diagrams on a dark page, or the reverse. Folio redraws them in the palette that matches the new appearance, in every open window, without reloading the file and without losing unsaved edits.

**Why this priority**: Without it, the live switch from Story 2 leaves mismatched diagrams on the page until the document is reopened. It only matters for documents that contain diagrams, so it ranks after the switch itself.

**Independent Test**: With System selected, open Help ▸ Markdown Formatting Tour (it contains two diagrams), scroll to its Diagrams section, and flip the operating system's appearance; confirm both diagrams are redrawn in the matching palette within 2 seconds.

**Acceptance Scenarios**:

1. **Given** System is selected and a previewed document shows diagrams, **When** the operating system switches appearance, **Then** every diagram in every open window's preview is redrawn in the palette matching the new appearance, without reloading the document from disk.
2. **Given** the document has unsaved edits, **When** its diagrams are redrawn after an appearance change, **Then** the edits are kept and the unsaved indicator remains in the title bar.
3. **Given** a window is showing the source editor when the operating system switches appearance, **When** the user returns to the preview, **Then** the diagrams appear in the palette matching the current appearance.
4. **Given** System is selected, **When** the user exports the document to PDF, **Then** Folio does not switch the appearance for the export, the export uses the appearance in effect when the page is captured, and the on-screen appearance is unchanged afterwards.

---

### Edge Cases

- **No saved preference** (first launch or reset settings): Folio starts in Light; System is opt-in.
- **Unrecognized saved preference** (for example a hand-edited or damaged value): treated as Light and shown with Light selected; Folio starts normally and the value is replaced as soon as the user picks an Appearance.
- **System chosen while the operating system already matches the current choice**: nothing visible changes except which Appearance item is selected.
- **Switching from System back to Light or Dark**: Folio stops following the operating system at once; diagrams are redrawn if the palette changes.
- **Operating-system change while the source editor is showing**: the editor and panels switch immediately; diagrams catch up as soon as the preview is shown again.
- **Operating-system change while Folio is in the background**: every window is updated, not only the focused one, so background windows are already correct when the user returns to them.
- **Document without diagrams**: only the colours change; the page is not redrawn, so the reading position and any text selection are untouched.
- **Diagram that fails to parse**: its fallback (the diagram source plus the error message) is redrawn and the message colour follows the new appearance.
- **Several windows**: Appearance is one app-wide preference, so all windows always show the same appearance.
- **Operating-system change while the PDF save prompt is open**: Folio waits for diagrams before asking where to save; a change that arrives while the prompt is open starts a redraw the export does not wait for, so that export may miss diagrams that were still being redrawn. Exporting again resolves it.
- **Desktops that do not report a light/dark preference or do not announce changes**: Folio can only follow what the desktop reports (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Appearance group of the Themes menu MUST offer three mutually exclusive choices, Light, Dark and System, in that order, identically on macOS, Windows and Linux.
- **FR-002**: Exactly one Appearance choice MUST be shown as selected at any time: System when System is saved, Dark when Dark is saved, and Light in every other case, including a missing or unrecognized saved value.
- **FR-003**: Choosing System MUST immediately apply the operating system's current light/dark setting to every open window, without a restart and without reloading the document.
- **FR-004**: Folio MUST save the System choice as the Appearance preference as soon as it is chosen and MUST restore it on the next launch and for every new window. When no preference has been saved, Folio MUST start in Light.
- **FR-005**: A saved Appearance value other than Light, Dark or System MUST be treated as Light, both in what is displayed and in what is shown as selected, and MUST NOT prevent Folio from starting.
- **FR-006**: While System is selected, Folio MUST follow every change of the operating system's light/dark setting for as long as it runs, whether the change is made by hand or automatically (macOS *Auto* appearance, a scheduled light/dark switch on Windows), in every open window including background and minimized ones, with no action in Folio.
- **FR-007**: An appearance change driven by the operating system MUST restyle the same surfaces as an explicit Light or Dark choice, all together: the rendered page, the source editor, and Folio's own panels, hints and notifications (outline, file explorer, status bar, find bar, link preview hint, confirmation toasts), using the light and dark palettes the active Style already carries. Unmodified Typora themes that carry a dark palette MUST need no change to support System.
- **FR-008**: While Light or Dark is selected explicitly, changes to the operating system's light/dark setting MUST NOT change Folio's appearance.
- **FR-009**: Whenever the appearance in effect changes, including an operating-system-driven change under System, every diagram in an open window's preview MUST be redrawn in the palette matching the new appearance, from the document as currently held in that window: no reload from disk, and unsaved edits are kept.
- **FR-010**: If a window shows the source editor when the appearance changes, its diagrams MUST be drawn in the current palette as soon as the user returns to the preview.
- **FR-011**: Export to PDF MUST NOT change the Appearance preference or temporarily force Light; under System the export MUST use whichever appearance is in effect when the page is captured.

### Key Entities

- **Appearance preference**: the user's saved choice on the Appearance axis: Light, Dark or System. One value is shared by all windows, defaults to Light, and is remembered between launches together with the other theme choices (Style, Page width).
- **Effective appearance**: what Folio actually shows at a given moment, always Light or Dark. It equals the preference when that is Light or Dark; under System it equals the operating system's current light/dark setting and changes whenever that setting changes. It determines the palette of the page, the source editor, Folio's panels and the diagrams.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching Folio to follow the operating system takes one menu selection (Themes ▸ System), and every open window shows the operating system's current appearance within 1 second, with no restart.
- **SC-002**: With System selected, when the operating system's light/dark setting changes, by hand or on a schedule, 100% of open Folio windows show the matching appearance within 2 seconds (minimized windows as soon as they are restored), with zero restarts and zero interactions with Folio.
- **SC-003**: In a document with a handful of diagrams, such as the two in the bundled Markdown Formatting Tour, every diagram is redrawn in the matching palette within 2 seconds of the appearance change, and no unsaved edit is lost.
- **SC-004**: The System choice is restored on 100% of relaunches, and an unrecognized saved Appearance value leads to a normal start in Light in 100% of cases.
- **SC-005**: With Light or Dark selected explicitly, operating-system changes cause 0 changes to Folio's appearance, and exporting a PDF causes 0 changes to the appearance shown on screen.

## Assumptions

- This feature extends the Appearance axis of [004-three-axis-theming](../004-three-axis-theming/spec.md). The Style and Page width axes, the Themes menu layout, and the way Light and Dark palettes are applied are defined there and are unchanged here.
- Diagram rendering itself (supported diagram types, the parse-failure fallback, waiting for diagrams before PDF export) is defined by [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md); this spec only requires diagrams to follow appearance changes, including those driven by the operating system.
- Appearance is an app-wide preference shared by all windows, consistent with [007-multiple-windows](../007-multiple-windows/spec.md); a per-window appearance is out of scope.
- "The operating system's light/dark setting" means: on macOS, System Settings ▸ Appearance (Light, Dark or Auto); on Windows, the default *app* mode under Settings ▸ Personalization ▸ Colors, which scheduling tools such as PowerToys switch; on Linux, the light/dark style preference the desktop environment reports to applications. Folio can only follow what the desktop reports; live switching on Linux depends on the desktop environment announcing the change and was not separately verified.
- Light stays the default so that first launches look as they did before this feature; System is opt-in.
- High-contrast and forced-colour accessibility modes are out of scope.
- No keyboard shortcut is provided for the Appearance choices, consistent with the other Themes menu choices.
