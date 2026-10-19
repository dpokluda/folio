# Contract: Markdown file associations

**Feature**: [../spec.md](../spec.md) (User Story 3) | **Data model**: [../data-model.md](../data-model.md) §5, §6

This contract covers what Folio declares to each operating system about the files and folders it can open, and which icon those files get. Handling what the OS then delivers belongs to other specs: [003](../../003-command-line-launch/spec.md) for paths in argv or `open-file`, file versus folder, and the `folio` command, and [007](../../007-multiple-windows/spec.md) for opening a new window when Folio is already running.

## Windows: the NSIS installer

**Declared in**: `package.json` → `build.win.fileAssociations` (59f97be).

```json
{
  "ext": ["md", "markdown", "mdown", "mkd", "mkdn"],
  "name": "Folio.Markdown",
  "description": "Markdown Document",
  "mimeType": "text/markdown",
  "role": "Editor",
  "icon": "build/icons/document.ico"
}
```

Guaranteed effect after install (README "Markdown file associations"):

- The five extensions are associated with the `Folio.Markdown` file type.
- Explorer shows these files as **Markdown Document**, with `document.ico` as the type's `DefaultIcon`, not the app icon.
- Double-clicking a file starts Folio with the file path as its argument, as described in 003.

Exception: a per-user "Open with → Always use this app" override created before installing still resolves to the raw executable icon. The documented remedy is to choose **Open with → Choose another app → Folio → Always** once. Windows then uses the registered `Folio.Markdown` type and shows the document icon.

## macOS: `Info.plist` `CFBundleDocumentTypes`

**Declared in**: `package.json` → `build.mac.extendInfo` (61017d1; `CFBundleTypeIconFile` added in 59f97be).

| Name | Role | `LSHandlerRank` | Content types | Icon |
|---|---|---|---|---|
| Markdown Document | Editor | Alternate | `net.daringfireball.markdown`, `public.plain-text` | `document.icns` |
| Folder | Viewer | None | `public.folder` | none |

The icon resource is `build/icons/document.icns`, copied by `build.mac.extraResources` to `Folio.app/Contents/Resources/document.icns`.

Guarantees:

- Folio is listed under Finder's **Open With** for Markdown and plain-text files. At `Alternate` rank, it does not displace an existing default app.
- When the user makes Folio the app for Markdown files, Finder shows them with the document icon.
- Folio can receive folders, for example when one is dropped on its Dock icon, delivered as `open-file`. At rank `None` it is never a folder's default app.

## Linux: AppImage and .deb

Nothing is declared: there is no `fileAssociations` entry at the top level or under `build.linux`, so the desktop entry advertises no Markdown MIME type. Files are opened from inside Folio or passed on the command line (003). README doesn't mention this difference (research finding 5).

## Icons used

| OS | Files of the associated type show | Comes from |
|---|---|---|
| Windows | Document icon | `build/icons/document.ico` |
| macOS | Document icon, when Folio is the handler | `build/icons/document.icns` |
| Linux | No change; the system's default icon for Markdown files | none |

The document icon is generated with the app icon by `npm run icons` ([icon-pipeline.md](./icon-pipeline.md)).
