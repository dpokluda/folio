<div align="center">

<svg width="112" height="112" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Folio logo">
  <defs>
    <linearGradient id="folioBg" x1="160" y1="96" x2="864" y2="928" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EEF1F4"/>
    </linearGradient>
    <linearGradient id="folioCaret" x1="0" y1="332" x2="0" y2="692" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0EA5A3"/>
    </linearGradient>
  </defs>
  <rect x="96" y="96" width="832" height="832" rx="216" fill="url(#folioBg)"/>
  <rect x="97.5" y="97.5" width="829" height="829" rx="214.5" fill="none" stroke="#D3D9DF" stroke-width="3"/>
  <g transform="translate(523 512) scale(1.26) translate(-523 -512)">
    <g fill="#2D333B">
      <rect x="356" y="316" width="86" height="392" rx="30"/>
      <rect x="356" y="316" width="270" height="84" rx="30"/>
      <rect x="356" y="470" width="210" height="80" rx="28"/>
    </g>
    <rect x="656" y="332" width="34" height="360" rx="17" fill="url(#folioCaret)"/>
  </g>
</svg>

# Folio

**A lightweight, themeable Markdown editor &amp; viewer with a _Typora-like_ look.**

_Edit the source · preview it rendered · swap CSS themes_

</div>

---

## Getting started

**Open a file**

- **File ▸ Open…** &nbsp;(`Ctrl/Cmd + O`) — pick any `.md` / `.markdown` / `.txt` file.
- **File ▸ Open Recent** — jump back to something you edited before.
- **From your terminal** — launch Folio with a path and it opens straight away:
  ```sh
  folio path/to/notes.md
  ```
  (Or drop a file onto the app / `Folio.exe`.)

**Light-edit it**

1. Toggle **Source Code Mode** — press `Ctrl/Cmd + /`, or click **`</>` Source** in the status bar.
2. Make your edits in the themed CodeMirror editor (undo/redo, find, cut/copy/paste all work).
3. **Save** with `Ctrl/Cmd + S` (or **Save As…** with `Ctrl/Cmd + Shift + S`).
4. Click **Exit Source** to jump back to the rendered preview.

**Make it yours**

- **Themes menu** — restyle both the preview _and_ the source editor. Try **Fluent A4** or
  **Microsoft Word A4** for the paged "sheet" look.
- **File ▸ Export to PDF** — export the rendered page, honoring the theme's paper size.
- **View ▸ Toggle Outline** — navigate long documents by their headings.

> Tip: the status bar (bottom) shows live **word / character / line counts** and an estimated
> reading time as you type.

---

## A quick formatting tour

You get the usual Markdown: **bold**, *italic*, ~~strikethrough~~, `inline code`,
[links](https://github.com/dpokluda/Folio), and footnotes.[^1]

- Bullet lists
  - with nesting
- and more items

1. Ordered lists
2. count
3. automatically

### Task lists

- [x] Render Markdown into `#write`
- [x] Themeable CodeMirror source editor under `#typora-source`
- [ ] Add your own Typora themes

### Tables

| Feature        | Preview | Source mode |
| -------------- | :-----: | :---------: |
| Themeable      |   ✅    |     ✅      |
| Syntax colours |   ✅    |     ✅      |
| Export to PDF  |   ✅    |     —       |

### Code

```js
// Fenced code is highlighted with highlight.js in the preview.
function greet(name) {
  return `Hello, ${name}! Welcome to Folio.`;
}

console.log(greet('world'));
```

```python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

### Blockquote

> "Simplicity is the ultimate sophistication."
>
> Themes control the page, the type, and the source editor — Folio just wires it together.

### Emoji

Ship it :rocket:  ·  Looks good :sparkles:  ·  Coffee first :coffee:

---

Folio is **not affiliated with, endorsed by, or sponsored by the Typora team**.
"Typora" is a trademark of its respective owner and is referenced here solely to describe
theme compatibility.

[^1]: Footnotes work too — handy for references and asides.
