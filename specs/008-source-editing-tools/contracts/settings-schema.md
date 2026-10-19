# Contract: Settings Schema (`folio-settings.json`)

**Feature**: [spec.md](../spec.md) | **Source**: `src/store.js` (`DEFAULTS`, `Store`), `src/main.js` (`state-changed`, `get-init`, `rebuildMenu`) | **Introduced in**: `68e67be`

**File**: `folio-settings.json` in Electron's `userData` directory, written by `Store._flush()` as pretty-printed JSON.

## New key

| Key | Type | Default | Written by | Read by |
|---|---|---|---|---|
| `lineNumbers` | boolean | `false` | The `state-changed` handler, only when the incoming value is a boolean | `get-init` (`settings.lineNumbers`) and `rebuildMenu()` (`!!store.get('lineNumbers')`) |

`DEFAULTS` gives the key this comment: `lineNumbers: false, // optional source-editor gutter line numbers`.

**Semantics**: `true` shows a line-number gutter in the source editor. The setting is app-wide, shared by all windows, and survives restarts. It has no effect in the rendered view.

**Compatibility**:

- **Older settings files**: a file without the key loads it from `DEFAULTS`, because the store spreads `{ ...DEFAULTS, ...parsed }`. No migration is needed.
- **Unreadable or invalid files**: the store logs the error and uses `DEFAULTS`, so the key is `false`.
- **Hand-edited non-boolean values**: these are read with JavaScript truthiness, because both the menu and the renderer coerce with `!!`. The first toggle writes a proper boolean back.

**Example (excerpt)**:

```json
{
  "styleFamily": "fluent",
  "appearance": "light",
  "pageWidth": "dynamic",
  "sourceMode": true,
  "outlineVisible": false,
  "filesVisible": false,
  "lineNumbers": true,
  "folder": null,
  "zoom": 0
}
```
