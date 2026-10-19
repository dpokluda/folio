# Contract: Icon pipeline and window icon

**Feature**: [../spec.md](../spec.md) (User Stories 2 and 3) | **Data model**: [../data-model.md](../data-model.md) §4

## Command

```sh
npm run icons        # node scripts/generate-icons.js
```

It needs the dev-only packages `sharp` (`^0.35.3`) and `png2icons` (`^2.0.1`), which `npm install` installs. It takes no arguments and runs on any OS.

## Inputs

| Source | Since | Purpose |
|---|---|---|
| `build/icons/icon.svg` | c5171da (glyph f96fc39, artwork 68e67be) | App icon |
| `build/icons/document.svg` | 59f97be | Markdown-document icon |

The script processes them in the order of `SOURCES = ['icon', 'document']`.

## Processing per source `<name>`

1. If `build/icons/<name>.svg` doesn't exist, throw `Missing source icon: <absolute path>`.
2. Render `sharp(svg).resize(1024, 1024).png()` into a master buffer and write it to `<name>.png`.
3. Call `png2icons.createICO(master, png2icons.BICUBIC, 0, false)` to get an ICO with BMP-encoded entries, and write `<name>.ico`. A falsy result throws `Failed to build <name>.ico`.
4. Call `png2icons.createICNS(master, png2icons.BICUBIC, 0)` and write `<name>.icns`. A falsy result throws `Failed to build <name>.icns`.
5. Log `[icons] wrote <name>.png, <name>.ico, <name>.icns`.

**Failure**: the script prints `[icons] <message>` and exits with code 1. Files already written for an earlier source in the same run stay written.

## Outputs and consumers

| File | Consumed by |
|---|---|
| `icon.ico` | `build.win.icon` (executable icon); `appIconPath()` on Windows |
| `icon.icns` | `build.mac.icon` (bundle icon) |
| `icon.png` | `build.linux.icon` (desktop entry); `appIconPath()` on macOS and Linux |
| `document.ico` | `build.win.fileAssociations[0].icon`, the `Folio.Markdown` type icon ([file-associations.md](./file-associations.md)) |
| `document.icns` | `build.mac.extraResources` → `Contents/Resources/document.icns` → `CFBundleTypeIconFile` |
| `document.png` | No consumer (research finding 5) |

**Commit policy**: generated files are committed next to their sources and regenerated only when an SVG changes (README). `scripts/build.ps1` regenerates them by default, unless `-SkipIcons` is given.

## Runtime window icon: `appIconPath()` in `src/main.js` (c5171da)

```text
appIconPath() → <src>/../build/icons/icon.ico   when process.platform === 'win32'
              → <src>/../build/icons/icon.png   otherwise
              → undefined                       when that file does not exist
```

- `createWindow()` passes the result as the `icon` of every `BrowserWindow`.
- `undefined` means the window uses the default icon, and the window still opens.
- The path resolves both in development and inside the packaged app, because `build/icons/**` is part of `build.files`.
- Per the code comment, the window icon mainly matters for `npm start` and Linux. Packaged Windows builds use the icon embedded in `Folio.exe`, and packaged macOS builds use the bundle's `icon.icns`.

## Artwork invariants

- Both drawings use a 1024×1024 canvas, the same `#808A96` 26 px frame and the same glyph: an F in `#2D333B` with a teal caret from `#2DD4BF` to `#0EA5A3`.
- The app icon is a rounded tile with the glyph at 1.45×.
- The document icon is a page with a folded upper-right corner and the glyph at 1.3×, so a Markdown file never looks like the app tile.
