# Contract: `appearance` setting

**Feature**: [011-system-appearance](../spec.md) | **Source**: `DEFAULTS` and the `Store` class in `src/store.js`; `APPEARANCES` and `applyAppearance()` in `src/main.js`

## Schema (fragment of `folio-settings.json`)

```json
{
  "styleFamily": "fluent",
  "appearance": "system",
  "pageWidth": "dynamic"
}
```

| Key | Type | Allowed values | Default | Since |
|---|---|---|---|---|
| `appearance` | string | `"light"`, `"dark"`, `"system"` | `"light"` | key added in `1f452ec`; `"system"` added in `0bbcf84` |

- **Location**: `folio-settings.json` in `app.getPath('userData')`, written as 2-space-indented JSON on every `store.set`.
- **Writer**: only `actions.setAppearance` (Themes ▸ Appearance menu; see [menu-commands.md](./menu-commands.md)).

## Read and validation contract

| Stored state | Applied appearance | Checked menu item | File rewritten? |
|---|---|---|---|
| `"light"` / `"dark"` / `"system"` | as stored | matching item | no |
| key missing | Light (default) | Light | no; the next `store.set` writes the default back with the rest of the data |
| any other value (e.g. `"sepia"`, `null`, `1`) | Light | Light | not until the user picks an Appearance |
| file unreadable or invalid JSON | Light (all defaults) | Light | on the next write |

**Guarantee**: Folio always starts; no `appearance` value can break startup.

## Effect contract (seen by stylesheets)

| Stored value | `nativeTheme.themeSource` | `@media (prefers-color-scheme: dark)` matches |
|---|---|---|
| `"light"` | `'light'` | never |
| `"dark"` | `'dark'` | always |
| `"system"` | `'system'` | whenever the OS is in dark mode, re-evaluated live |
| anything else | `'light'` | never |

- **Theme authors** need nothing new. A Typora theme with `@media (prefers-color-scheme: dark)` variables is "Dark-aware automatically" (README), and therefore System-aware too.
- **Stylesheets** must not assume the colour scheme stays fixed for the lifetime of the page.
- **Script** that bakes colours (Mermaid) must re-read the scheme when it receives `appearance-changed` (see [ipc-channels.md](./ipc-channels.md)).

## Compatibility

- **Forward**: settings written before `0bbcf84` contain only `"light"` or `"dark"` and load unchanged.
- **Backward**: a pre-`0bbcf84` build opens a file containing `"system"` in Light (old mapping `=== 'dark' ? 'dark' : 'light'`) and does not fail.
- **Legacy**: the single-file `theme` migration (004) continues to produce `"light"`.
