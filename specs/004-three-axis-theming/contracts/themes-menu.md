# Contract: Themes Menu

**Feature**: [../spec.md](../spec.md) | **Introduced by**: `1f452ec` (replaces 001's folder-scanned theme list) | **Source**: `buildMenu()` in `src/menu.js`, `rebuildMenu()` and `actions` in `src/main.js`

## Placement

- Top-level menu labelled **Themes**, on every platform.
- At `1f452ec` the menu bar order is: (macOS only) **Folio** app menu → **File** → **Edit** → **View** → **Themes** → **Help**. Later features insert their own menus elsewhere (the **Window** menu from [007-multiple-windows](../../007-multiple-windows/spec.md) sits between Themes and Help); the Themes menu's content is unaffected.

## Items (in order)

| # | Label | Type | Enabled | Checked when | Click |
|---|-------|------|---------|--------------|-------|
| 1 | Style | normal (group header) | no | — | — |
| 2 | Fluent | radio | yes | `styleFamily === 'fluent'` | `actions.setStyleFamily('fluent')` |
| 3 | GitHub | radio | yes | `styleFamily === 'github'` | `actions.setStyleFamily('github')` |
| 4 | Microsoft Word | radio | yes | `styleFamily === 'word'` | `actions.setStyleFamily('word')` |
| 5 | — | separator | — | — | — |
| 6 | Appearance | normal (group header) | no | — | — |
| 7 | Light | radio | yes | `appearance !== 'dark'` | `actions.setAppearance('light')` |
| 8 | Dark | radio | yes | `appearance === 'dark'` | `actions.setAppearance('dark')` |
| 9 | — | separator | — | — | — |
| 10 | Page Width | normal (group header) | no | — | — |
| 11 | Dynamic | radio | yes | `pageWidth === 'dynamic'` | `actions.setPageWidth('dynamic')` |
| 12 | A4 | radio | yes | `pageWidth === 'a4'` | `actions.setPageWidth('a4')` |
| 13 | US Letter | radio | yes | `pageWidth === 'letter'` | `actions.setPageWidth('letter')` |

- **Grouping**: the disabled header rows (and separators) end Electron's implicit radio group, so each block of radios is an independent one-of group.
- **Accelerators**: none. Every option is reached by mouse or by the platform's menu keyboard navigation.
- **Enable/disable rules**: radios are always enabled (they do not depend on a document, folder or window state); headers are always disabled.
- **Platform differences**: none — the same template is built for macOS, Windows and Linux.

## Actions (main process)

| Action | Effects, in order |
|--------|-------------------|
| `setStyleFamily(family)` | `store.set('styleFamily', family)` → push the composed layer list to the renderer (`pushTheme()`; `pushThemeAll()` to every window since `8062af5`) → `rebuildMenu()` |
| `setAppearance(appearance)` | `store.set('appearance', appearance)` → `applyAppearance()` (sets `nativeTheme.themeSource`) → `rebuildMenu()` |
| `setPageWidth(width)` | `store.set('pageWidth', width)` → `pushTheme()` / `pushThemeAll()` → `rebuildMenu()` |

`rebuildMenu()` passes `styleFamily`, `appearance` and `pageWidth` from the store into `buildMenu()`, so the checked radios always mirror the persisted selection (including after a migration at startup).

## Superseded behaviour (001)

`buildMenu({ themes, activeTheme })` listed every top-level `themes/*.css` as a radio item labelled by `titleCaseTheme()` ("fluent-a4.css" → "Fluent A4"), showed "(No themes found)" when the folder was empty, and called `actions.setTheme(file)`. All three were removed in `1f452ec`.

## Later extension (not part of this feature)

[011-system-appearance](../../011-system-appearance/spec.md) (`0bbcf84`) adds a **System** radio after Dark and changes Light's check rule to `appearance !== 'dark' && appearance !== 'system'`.
