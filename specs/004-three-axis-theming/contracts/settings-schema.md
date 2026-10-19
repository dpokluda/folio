# Contract: Theme Settings Schema

**Feature**: [../spec.md](../spec.md) | **Changed by**: `1f452ec` | **Source**: `DEFAULTS`, `migrateLegacyTheme()` and the `Store` constructor in `src/store.js` | **Model**: [../data-model.md](../data-model.md)

File: `folio-settings.json` in Electron's `userData` directory (JSON, 2-space indented, rewritten in full on every `Store.set()`).

## Keys owned by this feature

| Key | Type | Allowed values | Default | Consumer |
|-----|------|----------------|---------|----------|
| `styleFamily` | string | `"fluent"`, `"github"`, `"word"` | `"fluent"` | Themes menu checks, `composeThemeFiles()` |
| `appearance` | string | `"light"`, `"dark"` | `"light"` | Themes menu checks, `applyAppearance()` |
| `pageWidth` | string | `"dynamic"`, `"a4"`, `"letter"` | `"dynamic"` | Themes menu checks, `composeThemeFiles()`, `pageSizeForWidth()` (`"letter"` → Letter, else A4) |

Retired key: `theme` (string, 001 default `"fluent.css"`).

## Example — before and after the first launch of this version

Before (written by 001):

```json
{
  "theme": "microsoft-word-us-letter.css",
  "recentFiles": [],
  "window": { "width": 1100, "height": 820 },
  "sourceMode": false,
  "outlineVisible": false,
  "zoom": 0
}
```

After (`migrateLegacyTheme()` + one `_flush()`):

```json
{
  "styleFamily": "word",
  "appearance": "light",
  "pageWidth": "letter",
  "recentFiles": [],
  "window": { "width": 1100, "height": 820 },
  "sourceMode": false,
  "outlineVisible": false,
  "zoom": 0
}
```

## Rules

1. Migration runs only if `theme` is a string and `styleFamily` is absent; it never overwrites saved three-axis keys.
2. Mapping (lower-cased substring tests): Style `word` → `"word"`, else `github` → `"github"`, else `"fluent"`; width `letter` → `"letter"`, else `a4` → `"a4"`, else `"dynamic"`; `appearance` is always `"light"`.
3. `theme` is deleted from the in-memory settings on every load; the file is rewritten immediately only when a migration happened, otherwise at the next settings write (`set()`, `addRecent()`, `clearRecent()`).
4. Unreadable or invalid JSON → in-memory defaults, error logged, no crash.
5. Values outside the allowed sets are kept in the file; readers substitute the defaults (`fluent`, `light`, `dynamic`; PDF uses A4).

## Later extension (not part of this feature)

[011-system-appearance](../../011-system-appearance/spec.md) adds `"system"` to `appearance`; the migration still produces `"light"`.
