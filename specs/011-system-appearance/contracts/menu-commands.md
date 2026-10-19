# Contract: Themes ▸ Appearance menu items

**Feature**: [011-system-appearance](../spec.md) | **Source**: `themeSubmenu` in `src/menu.js`; `actions.setAppearance` and `applyAppearance()` in `src/main.js`

**Changed by `0bbcf84`**: the **System** item was added, and **Light**'s checked rule was narrowed. The Appearance block, the Light and Dark items and `actions.setAppearance` date from `1f452ec` ([004-three-axis-theming](../../004-three-axis-theming/spec.md)).

## Placement

The Appearance block is the middle block of the top-level **Themes** menu, on every platform:

```text
Themes
  Style              (disabled header)
  ○ Fluent  ○ GitHub  ○ Microsoft Word
  ─────────────
  Appearance         (disabled header)
  ○ Light
  ○ Dark
  ○ System           ← added in 0bbcf84
  ─────────────
  Page Width         (disabled header)
  ○ Dynamic  ○ A4  ○ US Letter
```

The disabled header rows and the separators delimit independent radio groups ("Disabled header rows also break Electron's implicit radio grouping so each block toggles independently"), so Light, Dark and System form one group.

## Items

| Label | Type | Checked when (`appearance` = stored value) | Click | Accelerator | Enabled | Platforms |
|---|---|---|---|---|---|---|
| Light | radio | `appearance !== 'dark' && appearance !== 'system'` (changed in `0bbcf84`; was `appearance !== 'dark'`) | `actions.setAppearance('light')` | none | always | macOS, Windows, Linux |
| Dark | radio | `appearance === 'dark'` | `actions.setAppearance('dark')` | none | always | macOS, Windows, Linux |
| System | radio | `appearance === 'system'` | `actions.setAppearance('system')` | none | always | macOS, Windows, Linux |

**Invariant**: exactly one item is checked for any stored value, including a missing or unknown one (see [data-model.md](../data-model.md), "Derived state: Appearance radio group").

## Action semantics

`actions.setAppearance(value)` in `src/main.js` (unchanged by `0bbcf84`):

1. `store.set('appearance', value)`: the value is persisted immediately.
2. `applyAppearance()`: `nativeTheme.themeSource = APPEARANCES.includes(value) ? value : 'light'` (rewritten in `0bbcf84`). It takes effect in every window, because `nativeTheme` is process-wide.
3. `rebuildMenu()`: the menu is rebuilt so the new item shows as checked.

- **Side effect**: setting `themeSource` emits `nativeTheme` `'updated'`, which redraws diagrams in every window that previews any (see [ipc-channels.md](./ipc-channels.md)).
- **Unsaved changes**: no document is replaced, so the unsaved-changes guard is not involved.
- **Access**: the renderer has no route to this action.

## Behavior on OS changes

- When the OS flips under System, the menu is **not** rebuilt; System stays checked while the effective appearance changes.
- Under Light or Dark, OS flips have no effect on Folio.
