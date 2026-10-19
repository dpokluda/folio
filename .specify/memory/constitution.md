<!--
Sync Impact Report
==================
Version change: unratified template → 1.0.0
Bump rationale: Initial ratification. Every template placeholder is replaced with
  concrete, project-specific rules, so this is the 1.0.0 baseline.

Principles (template slot → ratified title):
  - [PRINCIPLE_1_NAME] → I. Typora Theme Compatibility (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Complement Typora: View and Lightly Edit
  - [PRINCIPLE_3_NAME] → III. Untrusted Documents, Hardened Shell
  - [PRINCIPLE_4_NAME] → IV. Never Lose the User's Work
  - [PRINCIPLE_5_NAME] → V. Cross-Platform Parity
  - (added)            → VI. Lean, Local, and Self-Contained
Added sections:
  - Technology & Platform Constraints (template [SECTION_2_NAME])
  - Development Workflow & Quality Gates (template [SECTION_3_NAME])
Removed sections: none

Evidence base (brownfield adoption): these rules codify practices already present
in the code since the initial commit on 2026-07-09. They are not new aspirations.
  README.md: product purpose, theming contract, features, platform notes, licensing
  src/main.js: webPreferences, navigation guards, openExternalTarget, per-window
    Session, unsaved-changes guards, file watcher, familyLayers/STYLE_FAMILIES
  src/preload.js: folioAPI contextBridge surface
  src/renderer/renderer.js: DOMPurify sanitization, Mermaid securityLevel 'strict'
  src/renderer/highlight.js: Typora-identical CodeMirror 5 token classes
  src/renderer/index.html: Content-Security-Policy
  src/store.js: JSON settings in userData, legacy-theme migration
  src/folder.js: Electron-free module with bounded scans and searches
  docs/macos-gatekeeper.md: supported Electron line
  .gitignore and package.json build config: font licensing, packaging targets

Templates requiring updates:
  ✅ .specify/templates/plan-template.md: no change. /speckit-plan derives the
     "Constitution Check" gates from this file at runtime.
  ✅ .specify/templates/spec-template.md: no change. No mandatory section conflicts.
  ✅ .specify/templates/tasks-template.md: no change. Tests stay OPTIONAL, which
     matches the manual verification gates below.
  ✅ .specify/templates/checklist-template.md: no change.
  ✅ .github/skills/speckit-*/SKILL.md: no change. They read this file at runtime.

Follow-up TODOs: none. No placeholders are deferred.
-->

# Folio Constitution

## Core Principles

### I. Typora Theme Compatibility (NON-NEGOTIABLE)

Folio exists so that existing Typora CSS themes style both the rendered page and the
source editor. The DOM and styling contract below is a public interface. It MUST NOT be
broken:

- Rendered Markdown MUST be injected into the element with `id="write"`.
- The source editor MUST mount under `#typora-source` and carry the legacy `.CodeMirror`
  compatibility class, so that `#typora-source .CodeMirror*` theme rules apply.
- `<body>` MUST carry the `typora-sourceview-on` class while source mode is active, and
  only then.
- Code fences in the preview MUST be tokenized into the same CodeMirror `.cm-*` classes
  Typora emits, so a theme's `--color-cm-*` palette colors them.
- A theme MUST be composed from ordered `<link class="folio-theme">` layers:
  `themes/base.css`, then an optional style-family overlay, then a page-width overlay.
  Later layers win. Folio's own chrome (`src/renderer/app.css`) loads before the theme
  layers, so a theme wins on shared selectors.
- Appearance (Light, Dark, System) MUST be applied by switching Chromium's
  `prefers-color-scheme` through Electron `nativeTheme`. It MUST NOT be applied by
  swapping theme files. Every new stylesheet and every new chrome element MUST provide
  both light and dark palettes.
- A new Style family MUST follow the symmetric `themes/<family>/` layout, with
  `dynamic.css`, `a4.css` and `us-letter.css` overlays. It MUST be registered in
  `familyLayers` and `STYLE_FAMILIES` in `src/main.js`, with a matching radio item in
  `src/menu.js`.

**Rationale**: "The CSS themes I already use just work" is the product's core promise.
Folio cannot test every third-party theme, so any drift in the DOM or the layer order
breaks themes silently.

### II. Complement Typora: View and Lightly Edit

Folio is a viewer with light editing. It complements Typora on machines that have no
Typora license. It is not a Typora replacement.

- Every feature MUST serve viewing, navigating, searching, lightly editing, or exporting
  local Markdown files.
- Editing happens in the CodeMirror source mode. The rendered preview is not an editing
  surface. Turning the preview into a WYSIWYG editor is out of scope unless this
  constitution is amended.
- Where Typora has an established convention (source-mode toggle `Ctrl/Cmd+/`, status
  bar, outline, paged sheet), Folio SHOULD follow it, so users can move between the two
  apps without surprises.
- README.md MUST keep the non-affiliation disclaimer. "Typora" is named only to
  describe compatibility.

**Rationale**: The README states that Folio is for viewing and lightly editing Markdown
with the familiar paged, themeable look. A tight scope keeps the app lightweight and
keeps it from competing with the product it complements.

### III. Untrusted Documents, Hardened Shell

Every opened document, every linked file and every opened folder is untrusted input. The
renderer is a privileged Electron surface.

- Windows MUST be created with `contextIsolation: true` and `nodeIntegration: false`.
- The renderer MUST reach the main process only through the `window.folioAPI`
  contextBridge in `src/preload.js`. A new capability MUST be added as a narrow IPC
  channel with a specific purpose. Generic file-system, shell or eval bridges are
  prohibited.
- Rendered HTML MUST be sanitized with DOMPurify before it is injected into `#write`.
  Content drawn after sanitization, such as Mermaid diagrams, MUST use that library's
  strictest mode (`securityLevel: 'strict'`).
- The Content-Security-Policy in `src/renderer/index.html` MUST keep `script-src 'self'`.
  Remote scripts and inline scripts are prohibited.
- The renderer MUST NOT be able to open new windows (`window.open`) or navigate the top
  frame away from the local app shell. Only `http(s)` URLs MAY be passed to the system
  browser.
- When a document link points to a local file that is not Markdown, Folio MUST refuse
  UNC and remote paths and executable or script file types. For any other file, Folio
  MUST ask for confirmation and show the resolved absolute path before opening it.
- Main-process IPC handlers MUST validate their input. They MUST resolve the calling
  window's session from the event sender and MUST NOT rely on state supplied by the
  renderer.

**Rationale**: Markdown routinely embeds raw HTML and links. Behind a privileged preload
bridge, a single unsanitized document could otherwise read files or launch programs.

### IV. Never Lose the User's Work

- Every action that replaces or discards the current document MUST pass through the
  unsaved-changes guard (save, discard or cancel). This covers New, Open, Open Recent,
  Open Folder, Close Folder, link or explorer navigation, Back/Forward, Reload from
  Disk, built-in documents, closing a window and quitting. Choosing cancel MUST leave
  the current state unchanged.
- Unsaved state MUST be visible in the title bar (the `•` indicator).
- When an open file changes on disk, Folio MAY reload it silently if there are no
  unsaved edits. If there are unsaved edits, Folio MUST ask first and default to keeping
  the user's changes.
- Per-document state (path, dirty flag, folder, history, file watcher) MUST live on the
  `Session` that belongs to that window and MUST be looked up per window. Only app-wide
  preferences (theme axes, recent files, window size, view toggles) live in the shared
  settings store.
- Bundled documents (Welcome, Markdown Formatting Tour) MUST open as untitled, so that
  Save becomes Save As and the shipped copy is never overwritten.
- Settings MUST be persisted as JSON in Electron's `userData` directory. When the shape
  of a setting changes, the store MUST migrate the legacy value rather than drop it.
  Unreadable settings MUST fall back to defaults without crashing.

**Rationale**: A lightweight editor only earns trust if it never drops edits or
preferences without asking, and that matters most when several windows are open.

### V. Cross-Platform Parity

- Every user-facing feature MUST work on macOS, Windows and Linux. Where a platform
  behaves differently, the difference MUST be explicit in the UI (for example a disabled
  or hidden menu item) and documented in README.md. The per-OS `folio` command install
  is an example.
- Menu accelerators MUST use `CmdOrCtrl` semantics. Platform-native alternatives are
  added where conventions differ, such as `Cmd+[` and `Cmd+]` for Back and Forward on
  macOS.
- A platform-specific workaround MUST be isolated behind a platform check and commented
  with the reason and the evidence for it.
- Launching from the command line MUST behave the same on every platform. A file path
  opens that document. A folder path opens folder mode. A second launch opens a new
  window in the instance that is already running.
- `npm run dist` MUST be able to package Folio on every platform without administrator
  rights or Developer Mode. Unsigned builds are acceptable, and known signing and
  notarization pitfalls are documented in `docs/`.

**Rationale**: Folio exists to run the same way across many machines: work and home
desktops, laptops and remote boxes, on all three operating systems.

### VI. Lean, Local, and Self-Contained

- Folio MUST work fully offline on local files. It MUST NOT require an account, a cloud
  service or network access, and it MUST NOT collect telemetry.
- Runtime assets (fonts, KaTeX, Mermaid, highlighting modes) MUST be bundled or
  self-hosted. Loading from a CDN is prohibited.
- A new runtime dependency MUST be justified in the feature's plan. A small in-repo module
  is preferred when it can replace a heavy or ESM-only package; `src/store.js` replacing
  electron-store is the precedent.
- The current architecture MUST be kept: CommonJS main-process modules in `src/`, a
  single esbuild-bundled renderer, and no UI framework. Introducing a UI framework, a
  transpiled language or another process type requires either a constitution amendment
  or a justified entry in the plan's Complexity Tracking table.
- Logic that does not need Electron SHOULD live in Electron-free modules, as
  `src/folder.js` does, so it can run and be tested in plain Node.
- Potentially expensive work, such as folder scans and Find in Files, MUST be bounded
  with depth caps, result caps and caching, so a very large folder cannot hang the app.

**Rationale**: A small codebase with few dependencies stays maintainable by a single
maintainer and keeps installs and startup fast. Working offline matches the goal of
viewing Markdown on any machine.

## Technology & Platform Constraints

- **Runtime**: Electron, kept on a supported major line. Electron patches only the latest
  three majors, and an end-of-life runtime can have its macOS notarization revoked (see
  `docs/macos-gatekeeper.md`). electron-builder is upgraded together with Electron.
- **Toolchain**: Node.js LTS in the range stated in README.md. `scripts/ensure-electron.js`
  repairs a broken Electron install and MUST remain a no-op when the install is healthy.
- **Language and modules**: JavaScript only. The main process uses CommonJS
  (`src/main.js`, `src/menu.js`, `src/preload.js`, `src/folder.js`, `src/store.js`). The
  renderer uses ES modules that `build.js` bundles with esbuild into
  `src/renderer/bundle.js`. That bundle is generated and git-ignored and MUST NOT be
  edited by hand.
- **Rendering stack**: markdown-it with the task-list, footnote, emoji and KaTeX
  (`@vscode/markdown-it-katex`) plugins. Code fences are highlighted with
  `@codemirror/legacy-modes` through `src/renderer/highlight.js`. Diagrams use Mermaid
  and sanitization uses DOMPurify. The source editor is CodeMirror 6.
- **Settings**: one JSON file, `folio-settings.json`, in Electron `userData`, owned by
  `src/store.js`.
- **Packaging**: electron-builder produces NSIS (Windows), DMG (macOS), and AppImage plus
  deb (Linux) into `release/`. Markdown file associations use the document icon. Icons
  are generated from the SVG sources in `build/icons/` with `npm run icons`, and the
  generated files are committed.
- **Licensing**: Folio is MIT-licensed. Third-party assets that may not be redistributed,
  such as the Microsoft Aptos fonts, MUST stay git-ignored and excluded from packages.
  Themes based on third-party work MUST be credited in the README Acknowledgements.

## Development Workflow & Quality Gates

**Spec-driven changes.** New features and behavior changes follow the Spec Kit flow:
`/speckit-specify`, then `/speckit-clarify` if ambiguity remains, then `/speckit-plan`,
`/speckit-tasks`, `/speckit-analyze`, `/speckit-implement` and `/speckit-converge`.
Small fixes (bug fixes, dependency bumps, copy edits) MAY skip the flow, but they MUST
still satisfy the principles above.

**Spec persistence (flow-forward).** Each `specs/NNN-<name>/` directory is the
historical record of one feature. A completed feature directory is not rewritten. New
or changed requirements get a new feature directory that names the earlier spec it
extends or supersedes. Directories that document functionality built before Spec Kit
was adopted are marked as retroactive in their headers and cite their source commits.

**Verification gates.** Folio has no automated test suite yet. Until it has one, every
change MUST pass these gates:

1. `npm run build:renderer` completes without esbuild errors.
2. A smoke test with `npm start` exercises every changed user flow. Where the change can
   replace a document, the smoke test includes the unsaved-changes guard.
3. Changes to UI or rendering are checked in both Light and Dark appearance, and in
   every Style family the change can affect.
4. Changes to packaging, file associations, launch arguments or OS integration are
   verified with `npm run dist` on at least the host platform. The change description
   lists any platform that was not verified.
5. Changes to IPC channels, the preload surface, the CSP, sanitization or external
   opening get an explicit review against Principle III.

Automated tests are OPTIONAL, as the tasks template states, until the project adopts a
test runner. Keeping logic in Electron-free modules keeps that option open.

**Documentation.** README.md is the user manual. Any user-visible change (features,
menus, shortcuts, settings, platform notes, build steps) MUST update README.md in the
same change. Platform troubleshooting belongs in README.md or `docs/`. Code comments
explain why something is done, especially for platform workarounds, not what the code
does.

## Governance

- For planning and review, this constitution overrides any conflicting convention.
- Every `/speckit-plan` MUST complete the Constitution Check against these principles.
  Every violation MUST be justified in the plan's Complexity Tracking table, or the plan
  is not ready for `/speckit-tasks`.
- `/speckit-analyze` treats a conflict with any MUST rule as CRITICAL.
- Amendments are made with `/speckit-constitution` and recorded in its Sync Impact
  Report. The version follows semantic versioning:
  - MAJOR: a principle or governance rule is removed or redefined incompatibly.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications and wording changes.
- Compliance is reviewed for every change merged to `main`, and again whenever Electron
  or another major dependency is upgraded.
- README.md remains the runtime guide for users. This constitution governs how changes
  are specified, planned and reviewed.

**Version**: 1.0.0 | **Ratified**: 2026-10-18 | **Last Amended**: 2026-10-18
