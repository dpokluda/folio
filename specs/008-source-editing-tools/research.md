# Research: Source Formatting Commands, Line Numbers & Copy File Path

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Retroactive Record**: Reconstructed on 2026-10-18 from commit `68e67be` (2026-07-16), the code comments in `src/renderer/renderer.js`, `src/menu.js`, `src/main.js` and `src/renderer/app.css`, and the README section "How to use". The Technical Context in `plan.md` had no unresolved unknowns. The entries below record the design decisions as they were built.

### 1. Formatting edits the source text only; the rendered view answers with a hint

- **Decision**: Every Format command runs through `applyFormat(kind)` in `src/renderer/renderer.js`. That function acts only when `state.sourceMode && editor` holds. Otherwise it calls `showToast('Switch to Source mode (Ctrl/Cmd+/) to format text')` and returns without touching the document. The Format menu items have no `enabled` flag, so they stay available in both views.
- **Rationale**: The code comment reads: "Formatting edits markdown text, so these only act while the CodeMirror source editor is active; in the read-only rendered preview they no-op." Constitution Principle II rules out turning the preview into an editing surface. A hint keeps the menu discoverable and teaches the source-mode toggle, and it needs no `rebuildMenu()` on every mode switch.
- **Alternatives considered**: (a) Switch to source mode automatically and apply the command. Rejected because a selection in the rendered HTML does not map to offsets in the Markdown source. (b) Disable the Format menu in the preview. That would need a menu rebuild on every toggle and would not tell the user why the commands are unavailable. (c) Do nothing silently, which looks broken.

### 2. The editor owns the keystrokes; menu accelerators are display-only

- **Decision**: In `src/menu.js`, the `fmt(label, accel, kind)` helper builds each Format item with `registerAccelerator: false` and `click: () => actions.format(kind)`. The real key handling is `formattingKeymap` (`Mod-b`, `Mod-i`, `Mod-u`, `Mod-Shift-x`, `Mod-e`, `Mod-Shift-e`, `Mod-m`, `Mod-Shift-m`, `Mod-k`, `Mod-1`…`Mod-6`). `createEditor()` installs it as `Prec.highest(keymap.of(formattingKeymap))`, before `keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap])`. Each `run` returns `true`, so CodeMirror stops the event. Menu clicks travel `actions.format(kind)` → `sendFocused('command', { name: 'format', format: kind })` → `handleCommand` → `applyFormat`.
- **Rationale**: Comments in `src/menu.js` and `src/renderer/renderer.js` say "the actual keyboard handling lives in the CodeMirror editor so the shortcuts work uniformly and aren't swallowed by the browser's native Ctrl+B/I/U". They add: "Formatting shortcuts win over CodeMirror defaults". The highest precedence matters because CodeMirror binds some of the same keys. Its `defaultKeymap` maps `Mod-i` to `selectParentSyntax` and its `historyKeymap` maps `Mod-u` to `undoSelection`. With a single handler per keystroke, each command applies exactly once.
- **Alternatives considered**: (a) Registered menu accelerators. They would capture keys before the editor and send every keystroke on a round trip through the main process. (b) The keymap at default precedence. CodeMirror's own `Mod-i` and `Mod-u` bindings would win. (c) A document-level `keydown` listener. It would also fire outside the editor, in the preview, the find bar and the explorer search box.

### 3. Inline marks: wrap, insert with the caret inside, or unwrap

- **Decision**: `toggleWrap(view, before, after)` reads its marks from `INLINE_FORMATS`: bold `**`, italic `*`, underline `<u>`/`</u>`, strikethrough `~~`, code `` ` `` and math `$`. It applies them through `state.changeByRange`, checking three cases in order:
  1. If the selection is non-empty and the marks sit immediately outside it, remove them.
  2. If the selection itself starts with the opening mark and ends with the closing mark, remove them.
  3. Otherwise, wrap the selection and keep the original text selected. With an empty selection, put the caret between the inserted marks.
- **Rationale**: The approach is plain text inspection. It is predictable and does not depend on the Markdown syntax tree. Keeping the user's text selected lets commands be chained, for example Bold then Strikethrough. Because the transform works through `changeByRange`, it would handle every selection range if multiple selections were ever enabled. Underline uses `<u>…</u>` because, per the code comment, "Underline has no native markdown, so — like Typora — it falls back to inline <u></u> HTML."
- **Alternatives considered**: (a) A syntax-tree-aware toggle that detects the enclosing emphasis node from the editor's Markdown parse. It could remove bold with only the caret inside the word, but it is more complex. (b) `++…++` (non-standard) or `_…_` (that is italic) for underline. Both were rejected.

### 4. Headings replace or toggle the ATX prefix of each touched line

- **Decision**: `setHeading(view, level)` collects every line number from `doc.lineAt(range.from)` to `doc.lineAt(range.to)` for each range and removes duplicates. Each line is matched against `^(#{1,6})[ \t]+`. If the current level equals `level`, the prefix is stripped. Otherwise the prefix is replaced with `'#'.repeat(level) + ' '`, or prepended when there is none. All of this happens in one transaction with `scrollIntoView: true`.
- **Rationale**: The comment reads: "Set (or toggle off) the ATX heading level of every line the selection touches. Pressing the level a line already has strips the heading." Replacing the prefix instead of stacking it avoids `## ## Title`. Pressing the same level again returns the line to a paragraph without a separate command.
- **Alternatives considered**: (a) A Typora-style Paragraph command on Ctrl/Cmd+0. That shortcut is already View > Reset Zoom in Folio. (b) Increase/decrease-level commands. (c) Recognizing Setext (`===`/`---`) headings. None of these were added.

### 5. Links and fenced blocks put the caret at the next place to type

- **Decision**: `insertLink(view)` inserts `[]()` with the caret between the brackets. With a selection, it inserts `[selection]()` with the caret between the parentheses (`from + selected.length + 3`). `insertFencedBlock(view, open, close)` inserts `${lead}${open}\n${body}\n${close}`, where `lead` is `\n` unless the selection starts at a line start, and selects the body (or leaves the caret on the empty body line). Code Block uses ```` ``` ```` with no info string, and Math Block uses `$$`. None of these three commands toggles.
- **Rationale**: From the code comments: "With a selection: `[selected]()` with the caret in the URL parens. Without one: `[]()` with the caret in the link-text brackets." and "A leading newline is added when the caret isn't already at the start of a line so the fence isn't glued to text." Either way, the caret lands where the user types next.
- **Alternatives considered**: (a) Toggling links and blocks off, which would require parsing link and fence structure. (b) Prompting for a URL or a code language. (c) Prefilling the address from the clipboard. (d) Always appending a trailing newline after the closing fence. That was not done; see the findings.

### 6. Shortcut assignments, and freeing Ctrl/Cmd+Shift+E

- **Decision**: All Format shortcuts use `CmdOrCtrl`:

  | Command | Key |
  |---|---|
  | Bold | B |
  | Italic | I |
  | Underline | U |
  | Strikethrough | Shift+X |
  | Inline Code | E |
  | Code Block | Shift+E |
  | Link | K |
  | Inline Math | M |
  | Math Block | Shift+M |
  | Heading 1–6 | 1–6 |

  View > Toggle File Explorer moves from `CmdOrCtrl+Shift+E` (set by `e2e2877`) to Ctrl/Cmd+Alt+E, and View > Toggle Outline moves from `CmdOrCtrl+Shift+K` (set by `356cf20`) to Ctrl/Cmd+Alt+O. Both items use `ctrlAltItem(label, letter, onClick)`. On macOS it keeps the native accelerator `Cmd+Alt+<letter>`. On Windows and Linux it sets the label to `<label>\tCtrl+Alt+<letter>` with no accelerator, and a `keydown` listener in `boot()` handles the keystroke. The listener requires `ctrlKey && altKey`, no Shift or Meta, and `e.code` `KeyE` or `KeyO`. The status-bar tooltips in `src/renderer/index.html` follow the new shortcuts.
- **Rationale**: Code Block's Ctrl/Cmd+Shift+E collided with the explorer toggle. The `ctrlAltItem` comment says "Chromium's Windows menu renderer prints Ctrl+Alt accelerators in a non-standard 'Alt+Ctrl+…' order", so the conventional text is written into the label instead. Typora's published shortcuts match for Bold, Italic, Underline, Hyperlink, Heading 1–6, and Math Block on Windows/Linux (Ctrl+Shift+M). That keeps Folio close to Typora's conventions, as Principle II asks. The commit records no separate reason for moving Outline, beyond pairing both pane toggles on Ctrl/Cmd+Alt.
- **Alternatives considered**: (a) Typora's exact chords for the remaining commands: Ctrl+Shift+` (code), Alt+Shift+5 (strike) and Ctrl+Shift+K (code fences). They were not adopted, and no reason is recorded. Typora's Ctrl/Cmd+Shift+C means "Copy as Markdown", while Folio uses it for Copy File Path. (b) Native `Ctrl+Alt` accelerators on Windows, which display as "Alt+Ctrl+E".
- **Later effects**: The Window menu added for 007 in `5b4fe2e` deliberately gives Minimize no accelerator, because "the conventional Cmd+M belongs to Format ▸ Inline Math here". The zoom fix in `664668d` reused the label-plus-renderer technique for View > Zoom.

### 7. Line numbers use a CodeMirror compartment and an app-wide setting

- **Decision**: `createEditor()` mounts `lineNumbersCompartment.of(state.lineNumbers ? lineNumbers() : [])`.
  - `setLineNumbers(on)` reconfigures the compartment with `lineNumbersCompartment.reconfigure(...)` when the editor exists, then calls `persistState()`.
  - In the main process, `state-changed` stores `lineNumbers` only when `typeof state.lineNumbers === 'boolean'` and calls `rebuildMenu()`. `get-init` returns the stored value. `boot()` restores `state.lineNumbers` before the editor is lazily created.
  - `src/renderer/app.css` styles `#typora-source .cm-lineNumbers .cm-gutterElement` with `color: currentColor; opacity: 0.38; padding: 0 8px 0 12px`. The gutter itself stays transparent and borderless through an earlier `#typora-source .cm-gutters` rule.
- **Rationale**: The compartment comment reads "Held in a compartment so the toggle reconfigures without rebuilding the editor", so the document, selection and undo history survive a toggle. A second comment explains the restore order: "Restore the line-numbers preference before the editor is lazily created". View toggles are app-wide preferences under Principle IV. The default is off, which keeps the clean Typora-like source view. The bundled themes style CodeMirror 5's `.CodeMirror-gutters` (for example `themes/fluent/dynamic.css`), which the CodeMirror 6 editor never emits, so Folio has to style the gutter itself.
- **Alternatives considered**: (a) Rebuilding the `EditorView`, which would lose undo history and the selection. (b) Hiding an always-present gutter with CSS, which still lays out a gutter on every render. (c) A per-window setting, which would need new `Session` state.

### 8. Copy File Path is implemented in the main process

- **Decision**: `actions.copyPath` calls `copyDocumentPath()` in `src/main.js`, which works as follows:
  1. Resolve the window with `focusedSession()`.
  2. If `session.currentPath` is null, send `{ name: 'toast', text: 'Save the document first to copy its path' }` and stop.
  3. Otherwise run `clipboard.writeText(session.currentPath)` and send `{ name: 'toast', text: 'Path copied to clipboard' }`.

  The menu item is `enabled: !!hasFile`. `rebuildMenu()` already runs on window focus, open, New, built-in documents and Save As, so the enabled state stays current.
- **Rationale**: The path lives on the per-window `Session` in the main process (Principle IV). Writing the clipboard there needs no new renderer→main channel (Principle III) and no renderer clipboard permission. `clipboard` was already imported for the "Copy Command" button of the shell-command installer. The comment reads "No-op with a gentle hint when the document is untitled (never saved to disk)."
- **Alternatives considered**: (a) `navigator.clipboard.writeText` in the renderer. The renderer would have to hold the path, and the call requires focus or permission. (b) A native notification or message box as confirmation, which is too heavy for a routine action. (c) Copying a `file://` URL or a folder-relative path, which was not requested.

### 9. One reusable, accessible toast

- **Decision**: The toast is `<div id="folio-toast" hidden role="status" aria-live="polite">` inside `#folio-content`. `showToast(text)` works like this:
  - It ignores empty text, clears both pending timers and sets the message with `textContent`.
  - It unhides the element and restarts the CSS transition by removing `folio-toast-show`, forcing a reflow (`void $toast.offsetWidth`) and re-adding the class.
  - After 1600 ms it removes the class, and 220 ms later it sets `hidden`.

  The CSS makes a bottom-centered pill: `bottom: 24px`, `max-width: min(80%, 520px)`, nowrap with ellipsis, `pointer-events: none`, `user-select: none`, and 0.18 s opacity and transform transitions. A dark-appearance override sits in the `prefers-color-scheme: dark` block. The main process sends messages as `{ name: 'toast', text }` on the existing `command` channel, and the renderer raises its own formatting hint directly.
- **Rationale**: From the comments: "Transient toast (bottom-center). Used for lightweight confirmations such as 'Path copied to clipboard'", "Restart the fade-in transition even on rapid repeats", and "Non-interactive; fades in/out". A polite live region announces messages to screen readers without stealing focus.
- **Alternatives considered**: (a) A status-bar message; the status bar is already taken by the document statistics. (b) OS notifications, which are too intrusive and may require permission. (c) A modal dialog, which interrupts the user.

## Retroactive findings

Findings from comparing README.md, code comments and code on 2026-10-18. The code describes shipped behavior; the spec follows the code.

1. **README drift, toggling**: README says "Pressing the same shortcut on already formatted text (or a heading of the same level) toggles it back off." In the code, only the six inline commands and the headings toggle. The inline commands toggle only when the formatted text is selected. Link, Code Block and Math Block always insert.
2. **README imprecision, Math Block**: README says Math Block "wraps in `$$…$$`". The command puts each `$$` delimiter on its own line, like a code fence, with a leading line break when the selection starts mid-line.
3. **Undocumented in README**:
   - Choosing a Format menu command in the rendered view shows the hint "Switch to Source mode (Ctrl/Cmd+/) to format text".
   - File > Copy File Path is disabled for untitled documents, and its fallback notice reads "Save the document first to copy its path".
   - The Format shortcuts act only while the source editor has keyboard focus.
4. **Code-comment drift**: The formatting section's comment says the commands no-op in the preview "with a hint the first time". The hint appears every time a Format menu command is chosen there, with no first-time tracking. On Windows and Linux, pressing a shortcut in the preview gives no hint at all (see item 6).
5. **Gutter styling does not work as commented** (cascade analysis; not checked visually):
   - The `app.css` comment says the numbers follow "the theme's text colour via currentColor so they read in both light and dark appearances". But `color: currentColor` on `.cm-gutterElement` inherits the color of `.cm-gutters`. CodeMirror's base theme sets that to `#6c6c6c` under its light flag, and Folio never marks the editor as dark. The numbers are therefore the same grey at 38% opacity in Light and Dark appearance, and contrast may be weak on dark themes.
   - The `#typora-source .cm-activeLineGutter` rule never applies, because the editor does not enable `highlightActiveLineGutter()`.
   - The spec describes only the observable behavior: muted numbers on a transparent, borderless gutter. A follow-up feature could set the gutter color explicitly.
6. **Platform nuance, macOS menu key equivalents** (inferred, not verified on hardware): Electron documents `registerAccelerator` as Windows/Linux only, so on macOS the Format items' key equivalents remain registered.
   - In source mode, a shortcut is applied once whether the editor keymap or the menu item receives it first, because both paths run the same transform.
   - In the rendered view, an unhandled ⌘B probably reaches Format ▸ Bold and shows the hint. On Windows and Linux the same keystroke does nothing.
   - On every platform, the document is never changed in the rendered view, which is what the spec requires.

   The later Window menu comment in `5b4fe2e` ("a registered role accelerator would swallow it") suggests that the developer observed menu key equivalents winning on macOS.
7. **Potential limitation, Windows AltGr** (inferred, not reproduced): On Windows, AltGr reaches the page as Ctrl+Alt. The non-macOS handler for Ctrl+Alt+E / Ctrl+Alt+O calls `preventDefault()`. On keyboard layouts that type characters with AltGr+E or AltGr+O (for example `€` on German or Czech layouts, `ę`/`ó` on Polish), that keystroke would likely toggle the file explorer or outline instead of typing the character, including in the source editor.
8. **Known limitations, as designed** (also listed in the spec's Edge Cases):
   - With only a caret inside formatted text, the inline command inserts a second, nested empty pair instead of removing the formatting.
   - `*` is a prefix of `**` and `$` of `$$`, so Italic applied to bold text converts it to italic.
   - Blank lines inside a heading selection become empty headings, and a selection that ends at the start of a line includes that line.
   - Text after a mid-line Code Block or Math Block insertion is glued to the closing fence.
9. **Line numbers across windows**:
   - Each window's renderer keeps its own `state.lineNumbers`, and the store holds a single value. Toggling in one window does not update the others.
   - The View checkbox shows the stored value, which can differ from the focused window's gutter. Clicking it toggles that window's own value.
   - Every `persistState()` call sends all view fields, so a window that persists another view change (source mode, zoom, panes) writes its own `lineNumbers` back to the store.
10. **Single selection**: `EditorState.allowMultipleSelections` is not enabled, and CodeMirror's default is one range. The range-aware transforms therefore always see one selection.
