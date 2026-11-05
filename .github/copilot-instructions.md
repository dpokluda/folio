# Folio project instructions

## Product version

Increment the product version once for every project change set, not for every file or packaging invocation.
Before making changes, ask the user which version update applies unless they have already specified the category or target version:

- **Major:** a breaking change; increment `MAJOR` and reset minor and build to zero.
- **Minor:** a non-breaking feature update; increment `MINOR` and reset build to zero.
- **Build (patch):** a bug fix with no new feature; increment the third number.

Use the `MAJOR.MINOR.BUILD` numeric format accepted by npm's semantic versioning.
"Build" here means the patch component, not `+build` metadata.
For example, a minor update from `1.0.1` is `1.1.0`.
Do not choose the category without the user's answer or increment it again while refining the same change set.

Keep `package.json` and both product-version fields in `package-lock.json` synchronized.
Use `npm version <version> --no-git-tag-version --ignore-scripts` to update them without creating a commit or tag.
Update current-version examples in the README and user guide.
Version changes do not authorize staging, committing, pushing, or changing branches.

## Document output

PDF export and printing must contain only document content, not the Folio application interface.
Use the shared document-only output window, preserve unsaved text and editor state, and wait for fonts, images, and diagrams before output.
Source printing must include the complete Markdown text rather than CodeMirror's virtualized viewport.
