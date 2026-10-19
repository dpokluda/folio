# Contract: Menu Commands

**Feature**: [../spec.md](../spec.md) | **Implements**: FR-016

**Code**: `shellCommandItems` in `buildMenu()` in `src/menu.js`; `canInstallShellCommand()`, `rebuildMenu()` and `actions.installShellCommand` in `src/main.js`.

**Introduced/changed by**: `8563975` (macOS only, gated by `isMac`), `5c59ebc` (gated by `canInstallShellCommand`; Linux AppImage), `ac1ff4a` (Windows).

## File > Install 'folio' Command in PATH…

| Property | Value |
|---|---|
| Label | `Install 'folio' Command in PATH…` (single quotes; ends with the `…` character) |
| Menu | File |
| Position | After **Export to PDF…**, preceded by its own separator, followed by the separator before **Close** (macOS) or **Quit** (Windows/Linux) |
| Accelerator | none, on every platform |
| Enabled | always, when present |
| Action | `actions.installShellCommand()` → `installShellCommand()`; dialogs are parented to the focused window when there is one. Per-OS behavior is in [install-command.md](./install-command.md). |

### Visibility

The item is **omitted** (not disabled) when unavailable. The availability flag is recomputed on every `rebuildMenu()`.

| Platform | Shown when | Rationale (from the code comments) |
|---|---|---|
| macOS | always | "the .app bundle isn't on PATH" |
| Windows | always | "the NSIS installer does NOT touch PATH, so a packaged install is not reachable from a terminal until a shim is dropped somewhere on PATH" |
| Linux | `process.env.APPIMAGE` is set | "only when running as an AppImage (the single-file executable we can symlink to)"; a `.deb` install already provides `folio` |
| other | never | no launcher implementation |

No other menu item was added or changed by this feature. Launching from the command line has no menu surface.
