# Contract: Math Syntax (Authoring Grammar)

**Feature**: [spec.md](../spec.md) | **Introduced**: `68e67be` (2026-07-16) | **Implemented by**: `@vscode/markdown-it-katex` 1.1.2 with Folio's options (`throwOnError: false`, every `enable…` flag off), on markdown-it 14 with `html`, `linkify` and `typographer` on.

This is the contract between a Markdown author and the preview (and therefore the PDF export). "Word character" below means ASCII `[A-Za-z0-9_]`, the plugin's definition.

## 1. Inline math: `$…$`

| Rule | Detail |
|---|---|
| Opener | A `$` whose previous character is the start of the inline content, whitespace, or a non-word character (punctuation), and is neither `$` nor `\`. |
| Closer | The first later `$` preceded by an even number of backslashes (0, 2, …). It is valid only if the next character is the end of the content, whitespace or a non-word character, and is not `$`. |
| Failure | If there is no closer, or the first candidate is invalid, the opener is emitted as a literal `$` and parsing resumes right after it, so the rejected candidate may open a new formula. |
| Extent | One paragraph, heading, table cell or footnote paragraph. A formula may span soft line breaks but never a blank line. |
| Whitespace | Not restricted: `$ x $` is a formula. |
| Backtick form | `` $`…`$ ``: if the content starts and ends with a backtick (and is longer than two characters), the backticks are stripped. |
| Display environments | If the content contains `\begin{align}`, `\begin{equation}`, `\begin{gather}`, `\begin{CD}` or `\begin{alignat}` (case-insensitive, exact names, so `aligned` and `align*` do not count), it is typeset in display style. |

## 2. Display math: `$$…$$`

### 2.1 Block form (a line that starts with `$$`)

Recognized at block level, after indented code, fences and block quotes are ruled out: a line indented 4+ spaces is still code. It works inside list items and block quotes and can interrupt a paragraph.

| The rest of the opening line… | Result |
|---|---|
| contains exactly one `$$`, as its last two characters (`$$x$$`) | Single-line display equation. |
| contains two or more `$$` (`$$a$$ and $$b$$`) | Not a block: the line is parsed as inline text (§2.2). |
| contains no `$$` (empty, or TeX) | Multi-line block. It ends at the first following line whose trimmed text ends with `$$` (text before `$$` on that line belongs to the formula) or that contains `$$` elsewhere (that line's text is dropped). |
| contains exactly one `$$` that is not at the very end (text or trailing spaces follow it) | **Quirk**: treated as an open block that runs to the next line containing `$$`. |

A block that is never closed runs to the end of the document or of its container (list item, block quote), exactly like an unclosed code fence. Its content is typeset as one formula, which usually fails and shows as a red error (§5).

### 2.2 Display pair inside text

A `$$` that is not at the start of a line (or that the block form declined) opens a display formula when it is not preceded by `$` or `\` and not followed by a third `$`. It closes at the next `$$` preceded by an even number of backslashes, not preceded by `$` or `\` and not followed by `$`. The content must be non-empty (`$$$$` is literal), and without a closer the `$$` is literal. The result is a display equation that splits the paragraph: `The value $$x+1$$ follows.`

### 2.3 Presentation

Display equations are centered on their own line with a 1em vertical margin, in display style (large operators, full-height fractions). Equation tags written with `\tag{…}` appear at the right.

## 3. Escapes and literal dollar signs

| Input | Shown |
|---|---|
| `\$` outside a formula | A literal `$` (markdown-it's escape rule runs before the math rules). |
| `\$` inside a formula (`$\$5$`) | Part of the TeX: a typeset dollar sign. It does not close the formula. |
| `` `echo $HOME` `` | Code, untouched (a code span that starts before any `$` is protected). |
| Fenced or indented code containing `$` | Code, untouched. |
| `It costs $5 and $10.` | Literal: the candidate closer `$` is followed by a digit. |
| `$20,000 and $30,000` | Literal, for the same reason. |
| `US$5 and US$10` | Literal: a `$` right after a letter or digit never opens. |
| `$x$s` | Literal: the closer is followed by a letter. |
| `$x$-axis`, `($x$)`, `$x$.` | Formula; the punctuation stays outside. |
| `costs $ 5 and $ 10` | **A formula** (` 5 and `): the second `$` is followed by a space. Escape as `\$` when in doubt. |
| `a $$ b` (no closer) | Literal `$$`. |

## 4. Not recognized as math

| Input | Shown as |
|---|---|
| A fenced block labelled `math` | An ordinary code block (with the copy button added later by [010](../../010-mermaid-diagrams-code-blocks/spec.md)). |
| `\begin{env}…\end{env}` without dollar delimiters | Plain text. |
| `$…$` or `$$…$$` inside a raw HTML block (for example `<div>…</div>` on its own lines) | Literal text inside the HTML. |
| `$` directly after an inline HTML opening tag that has attributes or a name of three or more characters (`<span class="x">$x$</span>`, `<sup>$x$</sup>`) | Literal, until another Markdown token intervenes (the plugin assumes it is inside HTML). Short tags such as `<b>` or `<em>` do not trigger this. |
| `\ce{…}`, `\pu{…}` (chemistry) | Flagged as unknown commands (§5): the mhchem extension is not loaded. |

## 5. Errors and refused commands

| Situation | Shown in place |
|---|---|
| TeX that cannot be parsed (`$\frac{1}{$`) | The formula's TeX source in `#cc0000`; the hover tooltip shows `ParseError: KaTeX parse error: …`. |
| Unknown command (`$\foo + 1$`) | `\foo` in `#cc0000`; the rest is typeset. |
| Command refused because untrusted: `\href`, `\url`, `\includegraphics`, `\htmlClass`, `\htmlId`, `\htmlStyle`, `\htmlData` | The command name in `#cc0000`; no link, image or attribute is produced. |
| Runaway macro expansion (`$\def\a{\a}\a$`) | A parse error ("Too many expansions …") after 1000 expansions. |
| Any other exception inside the typesetter | The exception text in the normal text colour; the tooltip shows the TeX source. |
| Scope | Only the affected formula. Everything else in the document renders normally. |

## 6. Isolation from other Markdown processing

- Typographic replacements (`--`, `...`, `(c)`, smart quotes), emoji shortcodes (`:smile:`) and automatic link detection never modify formula content: `$a--b$` shows two minus signs.
- Macro definitions (`\def`, `\gdef`, `\newcommand`) are local to the formula that contains them.
- Explicit colours (`\color`, `\textcolor`) override the inherited text colour and do not adapt to Dark appearance.

## 7. Authoring helpers (owned by [008](../../008-source-editing-tools/spec.md))

- `Format > Inline Math` (`Ctrl/Cmd+M`) wraps the selection in `$…$`, or removes the wrapping (toggle).
- `Format > Math Block` (`Ctrl/Cmd+Shift+M`) inserts `$$`, the selected text and `$$` on separate lines, which is the multi-line block form of §2.1.
