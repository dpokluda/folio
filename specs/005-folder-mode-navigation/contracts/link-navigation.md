# Contract: Link Navigation, External Targets, Anchors & Hover Hint

**Feature**: [../spec.md](../spec.md) | **Source**: `src/renderer/renderer.js` (`wireLinks`, `navigateTo`, `githubSlug`, `assignHeadingIds`, `scrollToAnchor`, `linkHintText`), `src/folder.js` (`resolveNavTarget`, `folderIndexDoc`), `src/main.js` (`navigate` handler, `openExternalTarget`, `UNSAFE_OPEN_EXTENSIONS`, `createWindow` guards)

## 1. Which links exist

Only anchors that survive the 001 pipeline are wired: markdown-it (`linkify: true`, default link validation) followed by `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })`. Consequences for this contract: Markdown-syntax `file:` links and `<file:…>` autolinks render as plain text (markdown-it link validation); DOMPurify's default URI allow-list strips any remaining `href` that uses `file:` (raw HTML) or a drive letter such as `C:/…` (Markdown or raw HTML); relative, `/`-rooted, `//`-prefixed, `http(s)`, `mailto:`, `tel:` and `ftp:` links survive.

## 2. Click classification (renderer, `wireLinks()` after every `renderPreview()`)

Applied to every `#write a[href]` with a non-empty `href`; every handler calls `preventDefault()`.

| `href` pattern | Handling |
|----------------|----------|
| `^(https?:\|mailto:)` (case-insensitive) | `folioAPI.openExternal(href)`; main opens only `http(s)` (see [ipc-channels.md](./ipc-channels.md)) |
| Starts with `#` | `scrollToAnchor(href.slice(1))` in the current document; no main-process round trip, no history entry |
| Anything else | `navigateTo({ href, fromPath: state.path })` → `navigate` |

## 3. Target resolution (main, `resolveNavTarget(payload)`)

1. `{ path }` → `targetPath = path`.
2. `{ href }` → split at the first `#` (`anchor` is the remainder, not decoded). Empty remainder → `null`.
3. `href` starting with `file://` (case-insensitive) → `fileURLToPath(href)`; a throw → `null`. (Unreachable from rendered documents; see §1.)
4. Otherwise `decodeURIComponent(href)` (raw on error), every `/` → `path.sep`; absolute → as-is; relative with `fromPath` → `path.resolve(path.dirname(fromPath), decoded)`; relative without `fromPath` (untitled document) → `null`.
5. `fs.statSync(targetPath)` fails → `{ kind: 'missing', path }`.
6. Directory → `folderIndexDoc()` hit → `{ kind: 'markdown', path: index, anchor }`, else `{ kind: 'folder-empty', path }`.
7. `isMarkdownFile()` → `{ kind: 'markdown', path, anchor }`; anything else → `{ kind: 'external', path }`.

## 4. Outcomes (main, `navigate` handler)

| Kind | Guard | UI |
|------|-------|----|
| `markdown` | `confirmDiscardIfDirty()`; Cancel → `{ ok: false, canceled: true }` | `loadFile(path, anchor)` → `load-document`, history recorded, explorer synced |
| `folder-empty` | none | Info box, title "Folio", message "Nothing to display for this folder.", detail `<path>` + "Add an _index.md (or README.md) to make the folder viewable." |
| `missing` | none | Warning box, title "Folio", message "Cannot find the linked item.", detail `<path>` |
| `external` | none (the document is not replaced) | `openExternalTarget(session, path)`, §5 |

## 5. External-open guard (`openExternalTarget()`, `8062af5`)

Checks run in this order; the first match wins.

| Step | Condition | Result |
|------|-----------|--------|
| 1 | `target` starts with `\\` or `//` (UNC or remote; tested with a regular expression anchored at the start) | Warning "Blocked opening a network location.", detail `<target>` + "Folio does not open UNC or remote paths from document links." Nothing opened. |
| 2 | Lower-cased extension in `UNSAFE_OPEN_EXTENSIONS` | Warning "Blocked opening an executable or script.", detail `<target>` + "For safety, Folio does not launch this type of file from a document link." Nothing opened. |
| 3 | Otherwise | Question box, title "Open external file?", message "Open this file with its default application?", detail `path.resolve(target)`, buttons **Open** / **Cancel**, `defaultId` and `cancelId` = Cancel. **Open** → `shell.openPath(target)`. |

`UNSAFE_OPEN_EXTENSIONS` (28): `.exe .bat .cmd .com .msi .scr .pif .cpl .ps1 .psm1 .vbs .vbe .js .jse .wsf .wsh .hta .jar .reg .lnk .sh .bash .zsh .py .rb .pl .app .command`.

Before `8062af5`, the `external` kind called `shell.openPath(target.path)` with no checks (`e2e2877`).

## 6. Window guards (`createWindow()`, `8062af5`)

| Hook | Behavior |
|------|----------|
| `webContents.setWindowOpenHandler` | Always `{ action: 'deny' }`; `http(s)` URLs are passed to `shell.openExternal()` |
| `webContents.on('will-navigate')` | URLs not starting with `file://` are cancelled; `http(s)` ones are passed to `shell.openExternal()`. `file://` navigations are not cancelled by this hook (preview links never trigger one; see §1 and §2). |

## 7. Heading identifiers and anchors (`e2e2877`)

- `githubSlug(text)`: `text.toLowerCase().trim()`, remove `[^\w\s-]`, replace `\s+` with `-`.
- `assignHeadingIds(h1…h6)` (called by `buildOutline()` on every render): keep an existing `id`; else base = slug or `section`; first use keeps the base, repeats get `-1`, `-2`, …. Replaces the earlier `slugify(text, index)` ids (`bd8f5ef`).
- `scrollToAnchor(raw)`: decode with `decodeURIComponent` (raw on error); target = `getElementById(id)` → `getElementById(githubSlug(id))` → first heading whose `githubSlug(textContent)` equals the slug; `scrollIntoView({ behavior: 'smooth', block: 'start' })`; no match → no scroll.
- Cross-document anchors: `load-document.anchor` → `state.pendingAnchor`; when the preview (not source mode) renders, `requestAnimationFrame(() => scrollToAnchor(anchor))` runs after the scroll position is reset to the top.

## 8. Hover hint (`f8f17fa`)

| Input `href` | Hint text (`linkHintText()`) |
|--------------|------------------------------|
| Empty | No hint |
| Starts with `#` | The `href` as written |
| No scheme, not `//`-prefixed, and `state.baseUrl` set | `new URL(href, state.baseUrl)`; for `file:` URLs `decodeURIComponent(pathname)` (raw `pathname` on error), otherwise the resolved `href` |
| Anything else (scheme, `//`, no base URL) | `decodeURI(href)` (raw on error) |

Lifecycle: `setupLinkHint()` (once, from `boot()`) delegates `mouseover`/`mouseout` on `#write` (`closest('a[href]')`) and hides on `#folio-preview` `mouseleave`; `hideLinkHint()` also runs on every `renderPreview()` (right after the sanitized HTML is injected) and when `setSourceMode(true)` hides the preview. Presentation is defined in [explorer-ui.md](./explorer-ui.md).
