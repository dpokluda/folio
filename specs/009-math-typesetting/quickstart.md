# Quickstart: Math Typesetting (TeX)

Validation guide for [spec.md](./spec.md). Grammar, DOM and asset details live in [contracts/math-syntax.md](./contracts/math-syntax.md), [contracts/rendered-math-dom.md](./contracts/rendered-math-dom.md) and [contracts/offline-assets-and-csp.md](./contracts/offline-assets-and-csp.md); transient state is described in [data-model.md](./data-model.md). The bundled samples (`samples/welcome.md`, `samples/formatting-tour.md`) contain no math, so the scenarios use a scratch document.

## Prerequisites

- Node.js LTS as stated in README.md (Node 18+; developed on Node 20/24) and npm.
- `npm install` in the repository root. It installs `katex` and `@vscode/markdown-it-katex` with the other dependencies.
- A scratch folder outside the repository, for example `~/folio-math-check/` (on Windows use a full path such as `%USERPROFILE%\folio-math-check\`).

## Build and run

1. `npm run build:renderer` (constitution Gate 1). Expected console lines: `[folio] KaTeX assets copied.` and `[folio] renderer bundle built.`, with no esbuild errors. Then confirm that `src/renderer/katex/katex.min.css` exists, that `src/renderer/katex/fonts/` holds 20 `KaTeX_*.woff2` files, and that `git status` does not list `src/renderer/katex/`.
2. `npm start -- ~/folio-math-check/math-check.md` (the `start` script rebuilds the renderer first, so step 1 is implied).

## Test document

Save the following as `~/folio-math-check/math-check.md` (UTF-8, no trailing spaces):

````markdown
# Math check $E = mc^2$

## 1. Inline and display

The area is $\pi r^2$. Pythagoras: $a^2 + b^2 = c^2$, and the $x$-axis.

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$

The value $$x+1$$ sits mid-sentence.

Inline align: $\begin{align} a &= b \\ c &= d \end{align}$

Not a dash: $a--b$ versus prose a--b.

## 2. Containers

- List item with $\sqrt{2}$
  $$
  \lim_{h \to 0} \frac{f(x+h)-f(x)}{h}
  $$

> Quote with $\alpha + \beta$

| Formula | Meaning |
| ------- | ------- |
| $e^{i\pi} + 1 = 0$ | Euler |

Footnote with math.[^m]

[^m]: Footnote formula $\vec{F} = m\vec{a}$.

## 3. Errors and refused commands

Before $x^2$, broken $\frac{1}{$, after $y^2$.

Unknown command: $\foo + 1$

Refused: $\href{https://example.com}{x}$ and $\includegraphics{x.png}$

Runaway: $\def\a{\a}\a$

$$
\frac{1}{
$$

This paragraph after the broken display equation must render normally.

<img src="x" onerror="alert(1)">

## 4. Literal dollars and code

It costs $5 and $10. Salaries: $20,000 and $30,000. US$5 and US$10.

Escaped: \$x\$ and plurals: $x$s

Spaces pair up: costs $ 5 and $ 10

Inline code `echo $HOME` and:

```sh
echo "$PATH costs $5"
```

```math
\pi
```

\begin{equation} x \end{equation}

<div>$x$ inside an HTML block</div>
````

## Scenario 1: Typeset formulas in the preview (User Story 1, SC-001, SC-007)

1. Open the test document as above.
2. **Expected, section 1**: π r² inline before the period; a² + b² = c²; "the x-axis" with the hyphen outside the formula; the integral and the sum each centered on their own line in display style; `x+1` as a centered display equation that splits its sentence; the two aligned rows typeset in display style; `$a--b$` shows two minus signs while the prose "a--b" shows an en dash.
3. **Expected, section 2**: the formulas in the list item (including its indented display block), the quote, the table cell and the footnote are typeset in place.
4. **Expected, heading**: the H1 shows a typeset E = mc². No valid formula is ever painted as raw TeX first; formulas appear already typeset. Open `View > Toggle Outline`: the entry shows the formula as flat, repeated text (known limitation, see research.md).
5. Press `Ctrl/Cmd +` three times, then `Ctrl/Cmd 0`. **Expected**: formulas grow and shrink with the text.
6. Press `Ctrl/Cmd+/`. **Expected**: the editor shows the TeX exactly as typed. Change `\pi r^2` to `\pi r^3` and click **Exit Source**. **Expected**: the preview shows π r³ and the title bar shows the `•` unsaved marker. Undo the edit (`Ctrl/Cmd+Z` in source mode) or discard it when closing.

## Scenario 2: A broken formula stays contained (User Story 2, SC-002)

1. Scroll to section 3.
2. **Expected**: x² and y² are typeset, and between them `\frac{1}{` appears in red. Resting the pointer on it shows a tooltip starting with `ParseError: KaTeX parse error:`.
3. **Expected**: in `$\foo + 1$`, `\foo` is red and `+ 1` is typeset.
4. **Expected**: `\href` and `\includegraphics` appear as red command names; no link cursor, no image, no network request.
5. **Expected**: the runaway macro shows as red source and the app stays responsive (scrolling and menus work).
6. **Expected**: the broken display equation shows `\frac{1}{` in red, and the following paragraph renders normally.
7. **Expected**: no alert dialog appears for the `<img onerror>` line (only a broken-image placeholder), while all formulas stay typeset.
8. In source mode change `$\frac{1}{$` to `$\frac{1}{2}$` and exit source mode. **Expected**: ½ is typeset.

## Scenario 3: Export to PDF (User Story 3, SC-005)

1. In the preview choose `File > Export to PDF…` and save `math-check.pdf`.
2. **Expected**: the PDF contains every formula from scenarios 1 and 2 typeset exactly as in the preview, including the red error formulas.
3. Choose `Themes > Page Width > A4`, export again, then `Themes > Page Width > US Letter` and export again. **Expected**: the page size follows the setting and the formulas are intact in both files.
4. Press `Ctrl/Cmd+/` to enter source mode, then choose `File > Export to PDF…`. **Expected**: the window returns to the rendered preview before the save dialog appears, and the PDF contains typeset formulas, not TeX source.

## Scenario 4: Offline and packaged builds (User Story 4, SC-004, SC-008, constitution Gate 4)

1. Turn off every network connection (Wi-Fi off, cable unplugged).
2. Launch with `npm start -- ~/folio-math-check/math-check.md`. **Expected**: formulas render with the math typefaces (upright serif digits, italic math letters, large operators), identical to an online run.
3. Choose `View > Toggle Developer Tools` and run in the Console:
   - `performance.getEntriesByType('resource').map(e => e.name)` **Expected**: every entry, including `katex.min.css` and each `KaTeX_*.woff2`, starts with `file://`.
   - `[...document.fonts].filter(f => f.family.startsWith('KaTeX') && f.status === 'loaded').length` **Expected**: greater than 0.
   - The Console shows no Content-Security-Policy violation.
4. Run `npm run dist` on the host platform, launch the packaged app from `release/` while still offline, and open the test document. **Expected**: identical rendering. Record any platform that was not verified, as Gate 4 requires.
5. Measure the generated assets, for example `du -sh src/renderer/katex`. **Expected**: below 0.5 MB (about 320 KB).

## Scenario 5: Literal dollar signs and code (User Story 5, SC-003)

1. Scroll to section 4.
2. **Expected**:
   - The first paragraph reads exactly `It costs $5 and $10. Salaries: $20,000 and $30,000. US$5 and US$10.`
   - The second reads `Escaped: $x$ and plurals: $x$s` with no formula.
   - `costs $ 5 and $ 10` **is** typeset as a formula (italic "5and"), which is the documented pairing caution; escaping with `\$` avoids it.
   - `echo $HOME` and the `sh` block show their dollar signs as code.
   - The `math` fence is an ordinary code block, the `\begin{equation} x \end{equation}` line is plain text, and the HTML block shows `$x$ inside an HTML block` literally.

## Scenario 6: Light/Dark and Style families (constitution Gate 3, SC-006)

1. With the test document open, choose `Themes > Appearance > Light`, then `Dark`, then `System`.
2. **Expected**: each time, formulas, fraction bars, root signs and the integral sign take the new text colour in the same moment as the text, with no reload.
3. Repeat step 1 under `Themes > Style > Fluent`, `GitHub` and `Microsoft Word`. **Expected**: same result in every family. The red error colour stays the same in Dark, which is a known limitation (research.md).

## Constitution gates covered

- **Gate 1 (build)**: "Build and run" step 1.
- **Gate 2 (smoke test)**: scenarios 1 to 5. Math never replaces a document, so the unsaved-changes guard is not part of this feature; scenario 1 step 6 nevertheless leaves an unsaved edit, and closing the window must show the Save / Don't Save / Cancel prompt owned by [001](../001-markdown-viewer-editor/spec.md).
- **Gate 3 (Light/Dark and every Style family)**: scenario 6.
- **Gate 4 (`npm run dist`)**: scenario 4 step 4, because packaged contents gain `src/renderer/katex/`.
- **Gate 5 (Principle III review)**: confirm that the CSP in `src/renderer/index.html` is unchanged, that `renderPreview()` sanitizes after `md.render()` so math is inside the sanitized string, that no KaTeX `trust` option is passed, and that scenario 2 steps 4 and 7 and scenario 4 step 3 hold.
