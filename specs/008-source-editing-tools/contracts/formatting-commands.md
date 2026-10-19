# Contract: Formatting Commands (text transformations)

**Feature**: [spec.md](../spec.md) | **Source**: `toggleWrap`, `setHeading`, `insertLink`, `insertFencedBlock`, `applyFormat` in `src/renderer/renderer.js` | **Introduced in**: `68e67be`

## Notation

| Symbol | Meaning |
|---|---|
| `‹…›` | The current selection |
| `\|` | The caret (empty selection) |
| `⏎` | A line break |

Offsets are document character offsets. The source editor has exactly one selection range.

## Common rules (all commands)

1. **Preconditions**:
   - The command acts only when source mode is active and the editor exists.
   - Otherwise a menu invocation shows the toast "Switch to Source mode (Ctrl/Cmd+/) to format text" and the document is unchanged.
   - Keyboard invocations reach the commands only while the editor has keyboard focus.
2. **Atomicity**: each invocation dispatches one editor transaction. It is recorded in the undo history, and the update listener marks the document dirty if the text now differs from the saved text.
3. **Focus**: a menu invocation ends with `editor.focus()`.
4. **Range handling**: inline, link and fenced-block transforms use `changeByRange`, and headings iterate over `selection.ranges`. With the single-range editor, this means "the selection".

## Inline wrap: Bold, Italic, Underline, Strikethrough, Inline Code, Inline Math

Mark pairs come from `INLINE_FORMATS`:

| Command | Opening mark | Closing mark |
|---|---|---|
| Bold | `**` | `**` |
| Italic | `*` | `*` |
| Underline | `<u>` | `</u>` |
| Strikethrough | `~~` | `~~` |
| Inline Code | `` ` `` | `` ` `` |
| Inline Math | `$` | `$` |

The rules are evaluated in order for a range `[from, to)`. The first match wins.

| Rule | Condition | Change | Resulting selection |
|---|---|---|---|
| **U1** unwrap outside | `from ≠ to`, the text before `from` ends with `before`, and the text after `to` starts with `after` | Delete both marks | The same text, shifted left by `before.length` |
| **U2** unwrap inside | The selected text has length ≥ `before.length + after.length`, starts with `before` and ends with `after` | Replace the selection with its inner text | The inner text |
| **W** wrap | Otherwise | Insert `before` at `from` and `after` at `to` | An empty range becomes a caret at `from + before.length`; otherwise the original text, now inside the marks |

**Examples**:

| Command | Before | After |
|---|---|---|
| Bold | `make ‹this› bold` | `make **‹this›** bold` |
| Bold | `make **‹this›** bold` | `make ‹this› bold` (U1) |
| Bold | `make ‹**this**› bold` | `make ‹this› bold` (U2) |
| Bold | `x\|y` | `x**\|**y` |
| Bold | `**\|**` | `****\|****` (no toggle with an empty selection) |
| Italic | `**‹word›**` | `*‹word›*` (U1 matches one `*` on each side) |
| Underline | `‹text›` | `<u>‹text›</u>` |
| Strikethrough | `‹old›` | `~~‹old›~~` |
| Inline Code | `run ‹npm start›` | ``run `‹npm start›` `` |
| Inline Math | `‹x^2›` | `$‹x^2›$` |
| Bold, two lines | `‹a⏎b›` | `**‹a⏎b›**` (one pair around the whole selection) |

## Headings: Heading 1 … Heading 6

- **Input**: level N, and every line from the line containing `from` to the line containing `to`, for each range, with duplicates removed.
- **Recognized prefix**: `^(#{1,6})[ \t]+`. The current level is the number of `#`, or 0 when the prefix does not match.

| Rule | Condition | Change |
|---|---|---|
| **H-off** | Current level = N | Delete the whole prefix, including all its spaces or tabs |
| **H-set** | Current level ≠ N | Replace the prefix (or insert at line start when there is none) with `#` × N + one space |

The dispatch uses `scrollIntoView: true`. The selection is mapped through the changes.

**Examples**:

| Command | Before | After |
|---|---|---|
| Heading 2 | `Intro\|` | `## Intro\|` |
| Heading 3 | `## Intro` | `### Intro` |
| Heading 3 | `###   Intro` | `Intro` |
| Heading 1 | `‹A⏎## B⏎# C›` | `# A⏎# B⏎C` (each line evaluated on its own) |
| Heading 1 | a blank line inside the selection | `# ` (an empty heading) |
| Heading 1 | `  # Indented` | `#   # Indented` (an indented `#` is not a heading prefix) |
| Heading 2 | `#NoSpace` | `## #NoSpace` |

## Link

| Case | Change | Resulting caret |
|---|---|---|
| Empty selection | Insert `[]()` | `from + 1` (between `[` and `]`) |
| Non-empty selection `S` | Replace with `[S]()` | `from + S.length + 3` (between `(` and `)`) |

Link never toggles. With the caret inside the parentheses of `[Folio](|)`, Link inserts another template: `[Folio]([|]())`.

## Fenced blocks: Code Block, Math Block

| Command | `open` | `close` |
|---|---|---|
| Code Block | ```` ``` ```` (no info string) | ```` ``` ```` |
| Math Block | `$$` | `$$` |

- **Change**: the range is replaced with `lead + open + ⏎ + body + ⏎ + close`.
  - `body` is the selected text, which may be empty.
  - `lead` is empty when `from` is the start of its line, and `⏎` otherwise.
  - No trailing line break is added.
- **Resulting selection**: `body`, starting at `from + lead.length + open.length + 1`. An empty body leaves a caret on the empty body line.

**Examples**:

| Command | Before | After |
|---|---|---|
| Code Block | caret on an empty line `\|` | ```` ```⏎\|⏎``` ```` |
| Code Block | `text\|` (end of line) | ```` text⏎```⏎\|⏎``` ```` |
| Math Block | `‹E = mc^2›` (whole line) | `$$⏎‹E = mc^2›⏎$$` |
| Code Block | `ab\|cd` (mid-line) | ```` ab⏎```⏎\|⏎```cd ```` (known limitation: trailing text is glued to the closing fence) |

Fenced blocks never toggle. The TeX inserted by Inline Math and Math Block is rendered by [009-math-typesetting](../../009-math-typesetting/spec.md).
