# Feature Specification: Three-Axis Theming: Style × Appearance × Page Width

**Feature Branch**: `004-three-axis-theming`

**Created**: 2026-07-14

**Status**: Implemented (retroactive)

**Input**: User description: "Replace the flat list of theme files with three independent choices in the Themes menu that combine into the active look: a Style (Fluent, GitHub, Microsoft Word), an Appearance (Light or Dark, applied to the whole app including the source editor, the app chrome and code colours), and a Page width (Dynamic, A4, US Letter). Remember the selection between launches and carry over the theme an existing user had already picked. Existing Typora themes must keep working unchanged, adding my own Typora theme as a new Style should be straightforward, and PDF export should use the page size of the selected width."

**Retroactive Record**: Documented 2026-10-18 from the shipped implementation. Delivered in `1f452ec` (2026-07-14: Style × Appearance × Page width, the new GitHub Style, dark palettes, settings migration, PDF page size from the Page width) and `4f48e69` (2026-07-16: symmetric theme folder layout). Supersedes the flat single-theme selection of [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md); extended by [011-system-appearance](../011-system-appearance/spec.md); related specs: [007-multiple-windows](../007-multiple-windows/spec.md) (theme changes reach every window), [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md) (diagram colours follow the Appearance), [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md) (themes shipped inside installers).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose the page look from a Style and a Page width (Priority: P1)

A Folio user opens the **Themes** menu and, instead of scanning a list of pre-combined theme files, picks a **Style** (Fluent, GitHub or Microsoft Word) and, separately, a **Page width** (Dynamic, A4 or US Letter). Folio combines the two into one look for both the rendered page and the source editor, so every Style is available at every width without anyone having to build a dedicated theme for each pairing.

**Why this priority**: This is the core of the feature and the smallest slice that replaces the old flat list. It unlocks nine Style × Page width looks from a handful of building blocks and adds the new GitHub Style. Appearance, persistence, PDF sizing and custom Styles all build on this composition.

**Independent Test**: Open Help ▸ Markdown Formatting Tour, then step through all three Styles and all three Page widths from the Themes menu. Each choice restyles the page (and the source editor when source mode is on) immediately, and only the mark in the group that was used moves.

**Acceptance Scenarios**:

1. **Given** Folio is open on any document, **When** the user opens the Themes menu, **Then** instead of the old list of theme files it shows a labelled Style group (Fluent, GitHub, Microsoft Word) and, last, a labelled Page Width group (Dynamic, A4, US Letter), with exactly one option marked in each group.
2. **Given** Style Fluent and Page width A4 are selected, **When** the user chooses Style ▸ GitHub, **Then** the page is restyled with GitHub's Markdown look on the same A4 sheet, and the marks in the other groups do not change.
3. **Given** any Style is selected, **When** the user chooses Page width Dynamic, **Then** the document is shown on a sheet that fills the window with an equal margin on every side and grows or shrinks as the window is resized.
4. **Given** any Style is selected, **When** the user chooses A4 or US Letter, **Then** the writing column is capped at that paper's width (210 mm or 8.5 in) on a centred sheet that floats on a tinted backdrop.
5. **Given** source mode is on, **When** the user changes the Style or the Page width, **Then** the source editor takes the new Style immediately and stays full-width, without a page sheet.
6. **Given** the open document has unsaved edits, **When** the user changes any theme choice, **Then** the edits and the unsaved-changes indicator remain exactly as they were and no save prompt appears.
7. **Given** Microsoft Word is chosen on a computer without the Aptos fonts, **When** the page renders, **Then** it uses Segoe UI or Inter instead while keeping Word's monochrome text, heading treatment and spacing.
8. **Given** two Folio windows are open (see [007-multiple-windows](../007-multiple-windows/spec.md)), **When** the user changes the Style or the Page width from either window, **Then** both windows restyle.

---

### User Story 2 - Switch the whole app between Light and Dark (Priority: P2)

Reading late at night, the user chooses **Appearance ▸ Dark**. The page and the backdrop around it, the source editor, Folio's own outline sidebar and status bar, and the colours used for code all switch to dark palettes together, whichever Style and Page width are active. Choosing **Light** switches everything back.

**Why this priority**: Dark is the main capability Folio did not have before, and it works the same for every Style. It needs nothing beyond the Themes menu from User Story 1.

**Independent Test**: With the Formatting Tour open, toggle Appearance between Light and Dark for each of the nine Style × Page width combinations, in both the rendered view and source mode. Under Dark no light sheet, backdrop or panel remains.

**Acceptance Scenarios**:

1. **Given** Folio is open, **When** the user opens the Themes menu, **Then** a labelled Appearance group (Light, Dark) sits between the Style and Page Width groups, with exactly one option marked.
2. **Given** Appearance is Light, **When** the user chooses Dark, **Then** the rendered page, the backdrop around the sheet, the source editor, the outline sidebar, the status bar, the editor's selection highlight and the code colours all switch to dark palettes at once, and Dark is marked in the menu.
3. **Given** Dark with Style GitHub, **When** the page renders, **Then** text, links, borders and code use GitHub's dark palette.
4. **Given** Dark with Style Microsoft Word, **When** the page renders, **Then** the sheet becomes a dark page on a darker desk with light-grey monochrome text.
5. **Given** Dark is active, **When** the user changes the Style or the Page width, **Then** the new combination appears directly in its dark form without choosing Dark again.
6. **Given** Dark is active, **When** the user chooses Light, **Then** every surface returns to its light palette.
7. **Given** several Folio windows are open, **When** the Appearance changes, **Then** every window switches together.

---

### User Story 3 - Keep my theme across launches and upgrades (Priority: P3)

Folio remembers the Style, Appearance and Page width and restores them at the next launch. A user upgrading from the version that offered a flat list of theme files finds the theme they had picked translated into the matching Style and Page width, so their look carries over without any action.

**Why this priority**: Re-picking the look on every launch, or losing an established choice on upgrade, would be a regression from the earlier single-theme version, which already remembered the theme. It depends only on the saved preferences, not on the visual work of the other stories.

**Independent Test**: Choose GitHub, Dark and US Letter, quit and relaunch: the same three options are marked and applied. Then, with Folio closed, replace the saved choices with an earlier-version preference such as "Microsoft Word US Letter" and launch: Microsoft Word, Light and US Letter are selected and saved.

**Acceptance Scenarios**:

1. **Given** the user chose GitHub, Dark and US Letter, **When** Folio is quit and launched again, **Then** the same three options are marked and the window opens in that look.
2. **Given** Folio is launched for the first time with no saved preferences, **When** the window opens, **Then** it uses Fluent, Light and Dynamic.
3. **Given** an upgrade from the earlier version in which "Microsoft Word US Letter" was selected, **When** the new version starts for the first time, **Then** Microsoft Word, Light and US Letter are selected and saved, and the old single-theme preference is discarded.
4. **Given** an upgrade in which the plain Fluent theme (no paper size in its name) was selected, **When** the new version starts for the first time, **Then** Fluent, Light and Dynamic are selected.
5. **Given** the three choices have already been saved, **When** Folio starts and an old single-theme preference is also present, **Then** the saved three choices are kept unchanged and the old preference is ignored.

---

### User Story 4 - Export PDFs on the selected paper size (Priority: P4)

When the user exports a document to PDF, the paper size follows the chosen Page width: US Letter produces Letter pages and A4 produces A4 pages. Dynamic, which has no paper size of its own, produces A4 pages.

**Why this priority**: It keeps printed output consistent with the on-screen sheet, but it only refines the existing Export to PDF command (from 001) and needs the Page width choice to exist first.

**Independent Test**: Export the same document three times, with Dynamic, A4 and US Letter selected, and inspect the page size of each PDF.

**Acceptance Scenarios**:

1. **Given** Page width US Letter, **When** the user exports to PDF, **Then** every page is 8.5 × 11 in.
2. **Given** Page width A4, **When** the user exports to PDF, **Then** every page is A4 (210 × 297 mm).
3. **Given** Page width Dynamic, **When** the user exports to PDF, **Then** every page is A4.
4. **Given** any Style and Appearance, **When** the user exports to PDF, **Then** the paper size depends only on the Page width.

---

### User Story 5 - Keep using my Typora themes and add one as a new Style (Priority: P5)

Folio's promise is that the Typora themes the user already relies on "just work". The bundled Styles are themselves built from Typora themes, and a user who wants another Typora theme in the menu follows the README: place the theme in its own Style folder with one layer per Page width, register the new Style with Folio and add it to the Themes menu. The new Style then combines with every Page width and Appearance, and if the theme already carries a dark palette it follows Dark automatically.

**Why this priority**: It matters for long-term flexibility, but it is an occasional, developer-level task, and the three bundled Styles already cover everyday use.

**Independent Test**: Following only the README, add a copy of a bundled Style under a new name, run Folio, choose the new Style and check it with all three Page widths and both Appearances, without editing any existing theme file.

**Acceptance Scenarios**:

1. **Given** a Typora theme that pulls in its own imported files, embedded fonts and images by relative reference, **When** it is loaded as a Style layer, **Then** those resources resolve from the theme's own folder and the theme styles the page and the source editor without modification.
2. **Given** the README procedure, **When** a developer adds a Style folder containing the theme plus its Dynamic, A4 and US Letter layers and registers the Style with Folio and in the Themes menu, **Then** the new Style appears in the Style group and combines with every Page width and Appearance.
3. **Given** the added theme defines a dark palette for the system's dark colour scheme, **When** Appearance is Dark, **Then** the theme shows that dark palette with no additional files.
4. **Given** a self-contained Typora theme, **When** it is registered as its own foundation, **Then** Folio loads it on its own, followed by its Page-width layer, without the shared foundation.
5. **Given** the bundled themes, **When** their folder is inspected, **Then** every Style follows the same layout — one folder per Style with its own layer (if any) and one layer each for Dynamic, A4 and US Letter — and Fluent's look is carried by the shared foundation.

---

### Edge Cases

- **Custom theme chosen in the earlier version**: a theme file the user had added themselves is mapped to Fluent (unless its name mentions "word" or "github") with a Page width guessed from its name. That theme is no longer offered in the menu until it is registered as a Style (User Story 5).
- **Plain Fluent from the earlier version**: the old plain Fluent theme capped the column width instead of filling the window; it maps to Fluent + Dynamic, the closest of the three widths.
- **Unrecognised saved values**: if the saved Style or Page width is not one of the offered options (for example after hand-editing the preferences), Folio renders Fluent or Dynamic instead and keeps the stored value until the user picks an option; an unrecognised Appearance is treated as Light.
- **Unreadable preferences**: if the saved preferences cannot be read, Folio starts with Fluent, Light and Dynamic instead of failing.
- **Aptos fonts missing**: the Microsoft Word Style falls back to Segoe UI, then Inter, then the system's interface font; nothing breaks and no prompt appears.
- **Incomplete custom Style**: if a registered Style lacks one of its Page-width layers, the look is built from the remaining layers (the column then follows the foundation's own width rules) and no error is shown.
- **Small and very wide windows**: the A4 and US Letter column narrows to fit windows smaller than the paper width (a window can be as narrow as 640 px) and stays at paper width, centred, on very wide windows; Dynamic always fills the window minus its margin.
- **Unsaved edits**: changing a theme choice never replaces the document, so no unsaved-changes prompt appears and nothing is lost.
- **Source mode**: every Page width shows a full-width editor without the page sheet; under Dark the editor background darkens with the rest of the app.
- **Windows opened later**: a new window starts with the current Style, Appearance and Page width.
- **PDF with Dynamic**: Dynamic has no paper size, so PDFs use A4.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Themes menu MUST replace the earlier flat list of theme files with three labelled single-choice groups — Style, Appearance and Page Width — shown in that order and visually separated.
- **FR-002**: The Style group MUST offer Fluent, GitHub and Microsoft Word; the Appearance group MUST offer Light and Dark; the Page Width group MUST offer Dynamic, A4 and US Letter.
- **FR-003**: Choosing an option MUST change only that group's choice, and immediately afterwards the menu MUST mark the current choice of each group.
- **FR-004**: The Themes menu and its three groups MUST be available and behave the same on macOS, Windows and Linux.
- **FR-005**: The active look MUST be composed, in order, from (1) a shared foundation, (2) the chosen Style's own layer — omitted for Fluent, whose look is the foundation itself — and (3) the chosen Style's layer for the chosen Page width; later layers MUST take precedence over earlier ones, and the theme MUST take precedence over Folio's own default styling where both style the same element.
- **FR-006**: Changing the Style or the Page width MUST restyle the rendered page and the source editor of every open window immediately, without a restart, without reloading the document and without affecting unsaved edits.
- **FR-007**: Dynamic MUST present the document as a sheet that fills the window with an equal margin on every side and resizes with the window; A4 and US Letter MUST cap the writing column at the paper's width (210 mm and 8.5 in respectively) on a centred sheet, narrowing it to fit smaller windows; in source mode every Page width MUST show a full-width editor without the sheet.
- **FR-008**: Fluent MUST provide the Fluent look carried by the shared foundation; GitHub MUST re-skin the page in GitHub's Markdown look (system interface font, GitHub's greys and blues, rules under first- and second-level headings, GitHub-style block quotes, tinted code and bordered tables); Microsoft Word MUST provide a Word-like look with Aptos typography and monochrome text while code highlighting and emoji keep their colours.
- **FR-009**: The Appearance MUST apply app-wide, to every open window at once, covering the rendered page and its backdrop, the source editor, Folio's own interface (outline sidebar, status bar, editor selection highlight) and code colours.
- **FR-010**: The Appearance MUST be applied by switching the app-wide light/dark colour-scheme preference that themes and Folio's interface respond to, and MUST NOT be applied by loading different theme files; consequently any theme that defines a dark palette for the system's dark colour scheme, as Typora themes commonly do, MUST follow Dark automatically.
- **FR-011**: Every bundled theme layer that sets colours MUST provide a dark palette, so that all nine Style × Page width combinations have a complete dark form with no light sheet, backdrop, table striping or source-mode background left under Dark.
- **FR-012**: Folio MUST save each of the three choices as an app-wide preference as soon as it changes and MUST restore and apply them at the next launch; when nothing has been saved, the choices MUST default to Fluent, Light and Dynamic.
- **FR-013**: A saved Style or Page width that is not one of the offered options MUST be rendered as Fluent or Dynamic respectively, an unrecognised Appearance MUST be treated as Light, and unreadable preferences MUST fall back to the defaults without crashing.
- **FR-014**: On the first launch after upgrading from the single-theme version, when a single theme choice was saved but no three-axis choice exists yet, Folio MUST derive the Style from the saved theme's name (Microsoft Word if it mentions "word", otherwise GitHub if it mentions "github", otherwise Fluent), the Page width from the same name (US Letter if it mentions "letter", otherwise A4 if it mentions "a4", otherwise Dynamic), ignoring letter case, and MUST set the Appearance to Light.
- **FR-015**: Migrated choices MUST be saved immediately, the obsolete single-theme preference MUST be discarded, and migration MUST never overwrite three-axis choices that already exist.
- **FR-016**: Export to PDF MUST use US Letter paper when the Page width is US Letter and A4 paper otherwise (A4 and Dynamic), regardless of the Style and Appearance.
- **FR-017**: This feature MUST leave unchanged the page and editor structure that Typora themes target (defined in 001), so that existing Typora themes style the rendered page, the source editor and the source-mode background without modification.
- **FR-018**: Each theme layer MUST be loaded from its own location inside the themes folder, so that a Typora theme's imported files, embedded fonts and relative asset references resolve against that theme's own folder.
- **FR-019**: The bundled themes MUST follow one symmetric folder layout: a shared foundation plus one folder per Style holding that Style's own layer (if any) and exactly one layer each for Dynamic, A4 and US Letter.
- **FR-020**: The README MUST document how to add a Typora theme as a new Style — create the Style's folder with the theme and its Page-width layers, register the Style in Folio's list of Styles and add it to the Themes menu — including how a self-contained theme can serve as its own foundation and how a dark palette makes it follow Dark.
- **FR-021**: The Aptos font files used by the Microsoft Word Style MUST NOT be stored in the repository or shipped in installers; when they are absent the Word Style MUST fall back to Segoe UI and then Inter, and both the README and the Word Style's fonts folder MUST explain how users can supply their own copies.

### Key Entities *(include if feature involves data)*

- **Theme selection**: the three app-wide choices — Style, Appearance and Page width — that together define the active look. Defaults: Fluent, Light, Dynamic. Saved with Folio's other preferences and shared by all windows.
- **Style**: a named look (Fluent, GitHub, Microsoft Word) consisting of an optional Style layer on top of the shared foundation plus one layer per Page width. Each layer that sets colours carries both a light and a dark palette.
- **Page width**: Dynamic (window-filling sheet), A4 (210 mm column) or US Letter (8.5 in column). Also determines the PDF paper size (Dynamic uses A4).
- **Theme layer stack**: the ordered list of two or three theme layers derived from the current Style and Page width; rebuilt whenever either changes. The Appearance does not change the stack.
- **Earlier single-theme preference**: the single theme file name saved by the previous version; read once to derive the three choices, then discarded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the 18 looks (3 Styles × 2 Appearances × 3 Page widths) can be reached from the Themes menu with at most 3 menu selections, and selecting an option in one group never changes the other two groups (verified for all 18).
- **SC-002**: After any theme choice, the rendered page and the source editor of every open window show the new look in under 1 second, with no restart and 0 characters of unsaved edits lost.
- **SC-003**: In 100% of relaunches, the Style, Appearance and Page width that are marked and applied match the ones chosen before quitting.
- **SC-004**: For each of the 7 theme choices offered by the previous version, the first launch after upgrading selects the corresponding Style and Page width (plain Fluent → Fluent + Dynamic) in Light, with 0 user actions.
- **SC-005**: Under Dark, 0 light page sheets, backdrops, source-editor backgrounds, outline or status-bar surfaces, or light-only code palettes remain visible in any of the 9 Style × Page width combinations.
- **SC-006**: 100% of PDF exports use 8.5 × 11 in pages when US Letter is selected and 210 × 297 mm pages when A4 or Dynamic is selected.
- **SC-007**: A new Style can be added by following only the README, with 0 edits to existing theme files and no changes beyond the new Style's folder and its registration with Folio and the Themes menu; it then works with all 3 Page widths and both Appearances.
- **SC-008**: Installers built from a clean checkout contain 0 Aptos font files, and the Microsoft Word Style still renders readable text on computers without them.

## Assumptions

- Builds on [001-markdown-viewer-editor](../001-markdown-viewer-editor/spec.md): the rendered page, the source editor, the Typora-compatible page and editor structure, saved preferences and Export to PDF already exist. This feature supersedes 001's flat, single-file theme selection.
- Theme choices are app-wide preferences, not per window or per document. Multiple windows are defined by [007-multiple-windows](../007-multiple-windows/spec.md); with a single window, "every open window" means the current one.
- Only Light and Dark are in scope. Following the operating system's light/dark setting is added later as a third Appearance option by [011-system-appearance](../011-system-appearance/spec.md).
- Diagram colours following the Appearance are owned by [010-mermaid-diagrams-code-blocks](../010-mermaid-diagrams-code-blocks/spec.md); shipping the themes folder inside installers, and excluding font files from it, is part of [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md).
- Adding a Style is a developer-level customisation: it needs a source checkout, small registration edits and, for an installed copy, a rebuild. The earlier "drop a theme file into the themes folder and restart" behaviour is intentionally retired in favour of a fixed, labelled menu.
- Dynamic has no physical paper size, so A4 (the earlier default) is used for PDF export.
- The Fluent Style looks best with the free Inter and JetBrains Mono fonts installed but degrades to system fonts; Folio does not bundle them.
- The GitHub and Microsoft Word Styles imitate the public look of GitHub's Markdown rendering and of Microsoft Word documents; they do not depend on either product being installed.
