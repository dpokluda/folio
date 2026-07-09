# Welcome to Folio :wave:

**Folio** is a lightweight, themeable Markdown editor & viewer with a *Typora-like* look.
Edit the source, preview it rendered, and swap CSS themes — this very document is a quick tour.

> Tip: press **Ctrl/Cmd + /** to toggle **Source Code Mode**, and use the **Themes** menu to
> restyle both the preview *and* the source editor. Try switching to **Fluent A4** or
> **Microsoft Word A4** to see the paged "sheet" look.

## Formatting basics

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

## Tables

| Feature        | Preview | Source mode |
| -------------- | :-----: | :---------: |
| Themeable      |   ✅    |     ✅      |
| Syntax colours |   ✅    |     ✅      |
| Export to PDF  |   ✅    |     —       |

## Code

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

## Blockquote

> "Simplicity is the ultimate sophistication."
>
> Themes control the page, the type, and the source editor — Folio just wires it together.

## Emoji

Ship it :rocket:  ·  Looks good :sparkles:  ·  Coffee first :coffee:

---

Folio is **not affiliated with, endorsed by, or sponsored by the Typora team**.
"Typora" is a trademark of its respective owner and is referenced here solely to describe
theme compatibility.

[^1]: Footnotes work too — handy for references and asides.
