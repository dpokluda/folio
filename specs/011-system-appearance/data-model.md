# Data Model: Follow the OS Light/Dark Setting (System Appearance)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

The feature adds one persisted value and one derived runtime state. Everything else listed here already existed (from 004 and 010) and is only read.

## Entity: Appearance preference (persisted)

| Field | Type | Allowed values | Default | Lives in |
|---|---|---|---|---|
| `appearance` | string | `'light'` \| `'dark'` \| `'system'` | `'light'` | `DEFAULTS` in `src/store.js`; persisted in `folio-settings.json` (Electron `userData`) |

- **Written by**: `actions.setAppearance(value)` in `src/main.js` → `store.set('appearance', value)`, which flushes the file synchronously. Only the three Themes ▸ Appearance radio items in `src/menu.js` call it, each with a literal value.
- **Read by**: `applyAppearance()` in `src/main.js` (on every `createWindow()` and every `setAppearance`) and `rebuildMenu()` → `buildMenu({ appearance })`.
- **Validation rules**:
  - The value is validated when it is used, not when it is loaded. A value not in `APPEARANCES` (missing, non-string or unknown) is applied as `'light'` and shown with Light checked.
  - The raw value is not rewritten until the user picks an Appearance.
  - A missing key takes the default through `{ ...DEFAULTS, ...parsed }` in the `Store` constructor; an unreadable file falls back to all defaults and Folio still starts.
- **Scope**: App-wide. One value is shared by every window and is not stored on `Session` (constitution Principle IV; see [007-multiple-windows](../007-multiple-windows/spec.md)).
- **History**: The key was introduced in `1f452ec` with the values `'light' | 'dark'`; `0bbcf84` added `'system'`.
- **Compatibility**: Builds before `0bbcf84` read `'system'` as Light (`=== 'dark' ? 'dark' : 'light'`). The legacy single-file `theme` migration (`migrateLegacyTheme()` in `src/store.js`, owned by 004) still produces `'light'`.

## Entity: Appearance allow-list

`const APPEARANCES = ['light', 'dark', 'system'];` in `src/main.js` (it was `['light', 'dark']` from `1f452ec` until `0bbcf84`).

- It is the only definition of which stored values may reach `nativeTheme.themeSource`.
- Its siblings, `STYLE_FAMILIES` and `PAGE_WIDTHS` (004), validate the other two axes in `composeThemeFiles()`.

## Derived state: Effective appearance (runtime, not stored)

| Stored `appearance` | `nativeTheme.themeSource` | Effective appearance | Changes when… |
|---|---|---|---|
| `'light'` | `'light'` | Light | the user picks another Appearance |
| `'dark'` | `'dark'` | Dark | the user picks another Appearance |
| `'system'` | `'system'` | the OS's current light/dark setting | the user picks another Appearance **or the OS setting changes** |
| missing / unknown | `'light'` | Light | the user picks an Appearance |

- **Process-wide**: a single `nativeTheme` serves every window, so all windows always share the effective appearance.
- **Seen by stylesheets** through `prefers-color-scheme`: the `@media (prefers-color-scheme: dark)` blocks in `themes/` and `src/renderer/app.css`.
- **Seen by renderer script** through `prefersDark = window.matchMedia('(prefers-color-scheme: dark)')`, which `initMermaid()` reads once per Mermaid pass (`theme: prefersDark && prefersDark.matches ? 'dark' : 'default'`). This code came with `1ce68e0`.
- The main process never reads `nativeTheme.shouldUseDarkColors`; it only reacts to the `'updated'` event.

## Derived state: Appearance radio group

`buildMenu()` in `src/menu.js` derives the checked item from the raw stored value:

| Stored `appearance` | Light | Dark | System |
|---|---|---|---|
| `'light'` | ● | ○ | ○ |
| `'dark'` | ○ | ● | ○ |
| `'system'` | ○ | ○ | ● |
| missing / unknown | ● | ○ | ○ |

- **Invariant**: exactly one item is checked.
- The menu is rebuilt after every `setAppearance`. It is **not** rebuilt on OS-driven flips: System stays checked while the effective appearance changes.

## Existing state reused (owned by 010)

| State | Where | Role in this feature |
|---|---|---|
| `mermaidGeneration` (counter) | `src/renderer/renderer.js` | Each redraw caused by an appearance change increments it. An in-flight pass with an older generation stops, so rapid flips cannot leave diagrams in mixed palettes. |
| `mermaidPending` (Promise) | `src/renderer/renderer.js` | `whenMermaidSettled()` awaits it for `prepare-export`, so an export started during a redraw waits for that redraw to finish. |
| `state.sourceMode` (boolean) | `src/renderer/renderer.js` | While it is true, `refreshMermaid()` skips the redraw; `setSourceMode(false)` re-renders the preview later. |
| `state.docText` / `currentText()` | `src/renderer/renderer.js` | The redraw renders from this in-memory text, so unsaved edits are kept and nothing is re-read from disk. |

## State transitions

### Appearance preference (user-driven)

```text
            Themes ▸ Light           Themes ▸ Dark           Themes ▸ System
   any ─────────────────────▶ light ────────────────▶ dark ──────────────────▶ system
   (each pick: store.set → applyAppearance → rebuildMenu; persisted immediately)
```

Any value can move to any other. Picking the item that is already selected re-applies the same value.

### Effective appearance under `'system'` (OS-driven)

```text
OS light/dark setting changes
 ├─ every renderer: prefers-color-scheme re-evaluates → CSS restyles page, source editor and chrome
 └─ main: nativeTheme emits 'updated'
      → send(session, 'appearance-changed') for every live Session (destroyed windows skipped)
      → renderer: setTimeout(refreshMermaid, 0)
           ├─ state.sourceMode?                  → skip (diagrams redrawn on return to preview)
           ├─ no [data-folio-mermaid] in preview? → skip (CSS restyle was enough)
           └─ renderPreview() → renderMermaidBlocks() (new mermaidGeneration)
                → initMermaid() reads prefersDark.matches → diagrams redrawn in the matching palette
```

An explicit menu pick follows the same lower branch, because setting `themeSource` also emits `'updated'`.
