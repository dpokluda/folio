# Feature Specification: Product Version, Consumer Guide, and Automated Cross-Platform Packages

**Feature Branch**: Not created; specification authored on `main`.

**Created**: 2026-10-19

**Status**: Implementation in progress; Linux and macOS CI targets pass, but both Windows jobs fail compiler provisioning. The shared engine-version correction is local; a complete successful CI run and remaining native qualification are pending.

**Input**: First update Folio's source-controlled product version to 1.0 and create a simple consumer-specific `README.md` that is distributed with the application.
These are product changes, not responsibilities of the pipeline.
With those changes in place, add a GitHub Actions-based pipeline that packages the product after each push or merge.
Build Windows `.zip` archives and Inno Setup installers, Linux/Fedora `.tar.gz` archives and AppImages, and macOS `.tar.gz` archives and DMGs.
Target x64 and arm64.
Use the [Anniversary user guide](https://github.com/dpokluda/anniversary/blob/main/Anniversary.Desktop/README.md) as an example of the intended audience and level of detail.

**Confirmed decisions**: Packages are published as GitHub Actions artifacts only, not GitHub Releases.
Windows switches to Inno Setup rather than retaining the existing NSIS installer.
The pipeline consumes the version and consumer guide from the checked-out source; it does not set the version or generate the guide.

**Scope and delivery order**:

1. Update the product version once, from `0.1.0` to `1.0.0`, in its source-controlled metadata.
2. Author the consumer-specific README as a maintained product asset and include it in local application packages.
3. Add automated cross-platform packaging that reads the declared product version and bundles the existing guide.
   Later product-version changes must not require editing the pipeline.

**Related specifications**: This feature extends [002-cross-platform-packaging](../002-cross-platform-packaging/spec.md).
It supersedes that feature's Windows installer choice, while preserving app identity, document icons, supported file types, and unrelated packaging behavior.
The launch and command-install behavior in [003-command-line-launch](../003-command-line-launch/spec.md) remains the contract the user guide must describe.
Earlier feature specifications remain historical records and are not rewritten.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Update the product version independently of automation (Priority: P1)

The maintainer updates Folio's declared product version from `0.1.0` to `1.0.0` in the source repository.
The application and locally produced packages report that version before the automated pipeline is introduced.
The product version remains a maintained source value, not a value selected or rewritten by a build run.

**Why this priority**: The requested version update is a product change with value independently of the packaging pipeline.
It establishes the version that both local builds and later automated builds consume.

**Independent Test**: With no automated workflow required, inspect the declared product version and its corresponding source metadata, then build Folio locally.
Confirm that the product reports `1.0.0` and that the build does not rewrite the declared version.

**Acceptance Scenarios**:

1. **Given** the source currently declares version `0.1.0`, **When** the product-version change is completed, **Then** its authoritative declaration and corresponding source metadata consistently declare `1.0.0`.
2. **Given** that source revision and no automated pipeline, **When** Folio is built locally, **Then** its application-visible and package version information represents `1.0.0`.
3. **Given** a maintainer later changes the declared product version, **When** the unchanged packaging workflow builds that revision, **Then** the application, packages, and download labels use the new declared version rather than a pipeline-specific `1.0.0`.

---

### User Story 2 - Learn to use Folio from a short local guide (Priority: P1)

A recipient can find and read a simple `README.md` that comes with the downloaded and installed application.
It explains which package to choose, how to start Folio, the main document workflows and shortcuts, and how to remove the application.
It is written for someone using Folio, not someone building it.
The guide is authored and maintained in the product source before automation is added, and local packaging includes it too.

**Why this priority**: The consumer guide is a separate product deliverable, not generated pipeline output.
Packages should be usable without returning to the source repository or reading developer-oriented build instructions.
A short guide also explains the expected unsigned-app warnings and Linux prerequisites before they become blockers.

**Independent Test**: Before adding the automated pipeline, create a local package and confirm that it includes the maintained consumer guide.
On a machine without a source checkout or network connection, locate the bundled guide after installation or archive extraction.
Use it to open a file or folder, edit and save a document, change the theme, and find the platform's launch and removal instructions.

**Acceptance Scenarios**:

1. **Given** the consumer guide is maintained in the product source, **When** a package is built locally without the automated pipeline, **Then** it includes that guide as `README.md`.
2. **Given** any of the 12 package files, **When** the recipient installs, extracts, or runs it as documented, **Then** a bundled `README.md` remains locally available with the application, including after the original archive is removed or the DMG is ejected.
3. **Given** an installed app or an AppImage, **When** the recipient follows its documented guide-access route, **Then** they can read the guide offline without a source checkout or manually unpacking application internals.
4. **Given** a new recipient, **When** they follow the guide, **Then** it explains opening files and folders, preview/source mode, saving, finding text, theme choices, PDF export, and opening another window using the existing commands and platform-appropriate shortcuts.
5. **Given** a recipient wants terminal access, **When** they read the command-line section, **Then** it explains the supported `folio` command setup and file/folder arguments, including differences between installed, AppImage, and archive-based use.
6. **Given** a platform blocks or cannot launch a package, **When** the recipient reads the troubleshooting section, **Then** it distinguishes normal unsigned-app approval from other launch failures and states the relevant prerequisites without promising that every warning can safely be bypassed.
7. **Given** reading the guide inside Folio would replace a document with unsaved edits, **When** the recipient opens it, **Then** the existing save/discard/cancel protection applies, and saving edits to the guide cannot overwrite its bundled original.

---

### User Story 3 - Get a complete package set after each main-branch push (Priority: P2)

The maintainer pushes a change to `main`, directly or by merging a pull request.
The project automatically builds the resulting revision for every supported operating system and processor architecture.
It reads the product version and bundles the consumer guide already maintained in that revision.
The maintainer can download the packages from that workflow run, identify their source revision, and tell whether the complete set succeeded.
No release preparation, manual packaging, version bump for each commit, or GitHub Release is needed.

**Why this priority**: Once the product version and consumer guide are in place, automatic delivery removes the need to rebuild and collect packages manually on several machines.
Automation distributes the prepared product rather than owning its version or documentation.

**Independent Test**: Push a revision containing the declared product version and maintained guide to `main` and inspect the resulting workflow run.
Confirm that it provides the 12 package files in the supported package matrix using those source inputs, without changing them or creating a release or tag.

**Acceptance Scenarios**:

1. **Given** a direct push or merged pull request updates `main`, **When** the push completes, **Then** packaging starts automatically for the resulting branch-tip revision and all six operating-system/architecture combinations.
2. **Given** all target builds succeed, **When** the maintainer opens that run's artifacts, **Then** all 12 required package files are available and their labels identify Folio, application version, operating system, architecture, and package type.
3. **Given** packages from two runs have the same application version, **When** the maintainer inspects their artifact records, **Then** each set remains attributable to its own source commit and workflow run rather than overwriting or mixing with the other set.
4. **Given** any required target build, package check, or artifact upload fails, **When** the run finishes, **Then** the overall result is unsuccessful and identifies the failed target or publication step rather than presenting a partial set as complete.
5. **Given** a successful run, **When** publication finishes, **Then** downloads exist only as workflow artifacts and no GitHub Release or Git tag has been created or moved.
6. **Given** a failed run can be rerun, **When** the maintainer reruns it, **Then** it builds the original source revision and does not mix its output with packages from another revision.
7. **Given** a revision contains a declared product version and consumer guide, **When** the workflow packages it, **Then** it uses that version and guide without rewriting source metadata or generating replacement guide content.

---

### User Story 4 - Choose an installable package or an unpack-and-run archive (Priority: P2)

A recipient selects the download for their operating system and processor.
They either use the platform's installation/distribution package or extract an archive and launch Folio without an installation step.
Both forms contain the complete application and provide the same document-viewing and editing capabilities.
The recipient does not need a source checkout, Node.js, npm, or developer tooling.

**Why this priority**: Producing files is not enough if recipients cannot choose or run them.
Both installation and archive-based use were explicitly requested.

**Independent Test**: For each target, use its two package forms on a matching supported machine.
Install or extract, launch Folio, open a Markdown file, switch between preview and source, save an edit, and confirm bundled themes work offline.

**Acceptance Scenarios**:

1. **Given** Windows on x64 or arm64, **When** the recipient runs the matching Inno Setup installer as a standard user, **Then** Folio installs for that user without administrator rights or Developer Mode, has a Start menu entry and an uninstaller, and launches successfully.
2. **Given** Windows on either supported architecture, **When** the recipient extracts the matching `.zip`, **Then** they can launch Folio from the extracted folder with all required companion files present, without running the installer.
3. **Given** an Intel or Apple Silicon Mac, **When** the recipient uses the matching DMG, **Then** they can copy Folio to Applications and launch it after following the documented first-launch approval steps.
4. **Given** the same Mac, **When** the recipient extracts the matching `.tar.gz`, **Then** it contains a usable Folio application bundle with its executable permissions and required bundle contents intact.
5. **Given** a supported Fedora desktop on x64 or arm64 with the documented system prerequisites, **When** the recipient makes the matching AppImage executable and runs it, **Then** Folio launches without a distribution-specific installer.
6. **Given** the same Fedora desktop, **When** the recipient extracts the matching `.tar.gz`, **Then** they can launch the included application directly from its extracted folder with its executable permissions intact.
7. **Given** either package form on any target, **When** Folio runs without a network connection, **Then** its bundled documents, themes, rendering assets, file opening, editing, and saving remain usable.
8. **Given** a Windows installer is used to upgrade or replace an existing Folio installation, **When** the documented upgrade procedure is followed, **Then** the user's documents and settings are preserved and obsolete installation entries do not remain as conflicting active installations.

### Edge Cases

- The maintainer changes the source version after the initial `1.0.0` update: the unchanged pipeline uses the newly declared version.
- The declared product version is missing, invalid, or inconsistent with corresponding source metadata: packaging fails clearly rather than substituting `1.0.0` or rewriting the source.
- The maintained consumer guide is missing: packaging fails rather than generating a substitute or publishing packages without it.
- A push contains several commits: the run builds the resulting `main` tip, not a separate package set for every intermediate commit.
- A push to a feature branch or an unmerged pull request does not publish this feature's package set.
- One architecture or format fails while others succeed: successful target outputs may remain downloadable, but the run is unsuccessful and the complete set is not claimed.
- Artifact upload fails after packaging succeeds: the run still fails because recipients cannot obtain the required output.
- A run is rerun or a newer push arrives before an older run finishes: outputs stay associated with their own revision and run.
- A recipient selects the wrong architecture: artifact labels and the guide explain the distinction, including Intel versus Apple Silicon.
- The extracted path contains spaces or non-ASCII characters: the application and documented launch commands still work.
- An archive omits a required runtime file or loses executable permissions: it is invalid even if an executable file exists inside it.
- Fedora lacks AppImage prerequisites such as compatible FUSE support: the guide explains the prerequisite or a supported alternative, and the `.tar.gz` remains a separately documented option.
- An unsigned application triggers operating-system protections: the guide describes supported first-launch approval, not disabling system-wide protections or ignoring malware findings.
- A Windows machine already has an NSIS-based Folio installation: a safe, documented transition preserves settings and avoids conflicting installations; automatic cross-installer migration is not assumed.
- An installed Windows build is running during an upgrade: installation must not claim success while leaving a partially replaced application.
- An artifact expires or is deleted under repository retention policy: the guide does not describe Actions artifacts as permanent release downloads.
- Personal Aptos font files exist in a maintainer's checkout: no package may redistribute them, including secondary copies of the themes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Packaging MUST run through GitHub Actions after every push that updates `main`, including pull-request merges and direct pushes, for the exact resulting revision.
- **FR-002**: Each successful run MUST produce the complete supported package matrix below: two package formats for each of six operating-system/architecture combinations, totaling 12 package files.
- **FR-003**: As a one-time product-source change completed before adding the pipeline, Folio's declared version MUST change from `0.1.0` to `1.0.0`, representing the requested version 1.0.
  The authoritative version declaration and corresponding source metadata MUST remain consistent.
  Local builds MUST reflect the declared product version independently of the automated pipeline.
- **FR-004**: The pipeline MUST read the product version from the checked-out source and use it consistently in application-visible version information, package metadata, installer metadata, and download labels.
  It MUST NOT hardcode `1.0.0`, increment the version, or rewrite source version metadata.
  Future maintainer-authored product-version changes MUST work without pipeline edits.
  Missing, invalid, or inconsistent product-version metadata MUST cause a clear failure rather than a fallback version.
  Source revision and workflow-run identity MUST distinguish repeated builds of the same product version without Git-tag changes.
- **FR-005**: Packages MUST be uploaded as GitHub Actions artifacts associated with their originating run.
  This feature MUST NOT publish GitHub Releases or create or move Git tags.
- **FR-006**: Download labels MUST unambiguously identify product, application version, operating system, architecture, and package type.
  All packages within a successful run MUST come from the same source revision.
- **FR-007**: A run MUST be unsuccessful if any required target, package validation, or artifact upload fails.
  Its result MUST identify the affected target or step, and MUST NOT represent an incomplete set as a successful delivery.
- **FR-008**: Windows installation packages MUST use Inno Setup and support native x64 and arm64 application payloads.
  Installation MUST support a standard user without administrator rights or Developer Mode, provide a Start menu entry and uninstall support, and retain the existing app and Markdown-document identity.
- **FR-009**: Replacing NSIS MUST preserve the existing Windows Markdown file-type registration and document icon for the supported extensions without forcibly overriding a user's chosen default application.
  A documented transition from earlier installations MUST preserve user documents and settings; automatic migration between installer technologies is not required.
- **FR-010**: Archive packages MUST include the complete runnable application, not only its primary executable.
  Extraction MUST preserve the platform's required application structure and executable permissions.
  Archive-based use MUST NOT require running an installer or promise a new portable-settings mode.
- **FR-011**: Every package MUST include the runtime and redistributable assets needed for Folio's existing offline behavior.
  Recipients MUST NOT need a development toolchain or separately installed application runtime; supported operating-system libraries and documented first-launch approval remain prerequisites.
- **FR-012**: A consumer-specific guide MUST be authored and maintained in the product source as a separate deliverable before adding the pipeline.
  Both local and automated packages MUST carry that guide as `README.md`.
  The pipeline MUST package the existing guide, not author, generate, or rewrite its contents.
  A missing guide MUST cause a clear packaging failure.
  The guide MUST remain available locally with the installed or standalone application rather than existing only on installation media or in the repository.
- **FR-013**: Recipients MUST have a documented way to find and read the bundled guide offline, including for AppImage and macOS application-bundle distributions, without manually extracting application internals.
- **FR-014**: The guide MUST concisely cover package and architecture selection, installation or extraction, first launch, core use and shortcuts, command-line access and its limitations, settings location, and removal.
  It MUST describe existing Folio behavior accurately and omit contributor setup and build instructions.
- **FR-015**: The guide MUST document unsigned Windows and macOS launch behavior and Fedora AppImage prerequisites, separating ordinary approval steps from actual launch errors.
  It MUST NOT instruct recipients to disable system-wide security protections.
- **FR-016**: Packaging MUST preserve app identity, icons, macOS document declarations, bundled documents and themes, and existing command-line behavior unless this specification explicitly changes them.
  Local guide access MUST honor existing unsaved-changes and bundled-document protections.
  Restricted personal fonts MUST remain excluded from every packaged copy.
- **FR-017**: The repository README MUST explain how to obtain the workflow artifacts, distinguish them from permanent releases, and point to the bundled user guide.
  It MUST retain the non-affiliation disclaimer and applicable acknowledgements.
  Existing local packaging instructions MUST stay accurate after the Windows installer change.
- **FR-018**: The published matrix MUST be validated for package completeness, declared architecture, version consistency, and presence of the user guide.
  Acceptance evidence MUST distinguish package inspection from actual launch verification on each target operating system and architecture.
- **FR-019**: The guide and maintainer documentation MUST identify the supported operating-system baselines and any required system packages established during planning and verification.
  Linux runtime compatibility MUST be verified on Fedora, not inferred solely from a successful build on another distribution.

### Supported Package Matrix

| Operating system | Architecture | Archive | Installation/distribution package |
| ---------------- | ------------ | ------- | --------------------------------- |
| Windows | x64 | `.zip` | Inno Setup `.exe` |
| Windows | arm64 | `.zip` | Inno Setup `.exe` |
| Linux, with Fedora compatibility | x64 | `.tar.gz` | `.AppImage` |
| Linux, with Fedora compatibility | arm64 | `.tar.gz` | `.AppImage` |
| macOS | x64, Intel | `.tar.gz` containing the application bundle | `.dmg` |
| macOS | arm64, Apple Silicon | `.tar.gz` containing the application bundle | `.dmg` |

GitHub Actions may wrap downloaded artifacts in its own transport archive.
The package files inside MUST retain the formats above.
An AppImage is a runnable distribution format, not a promise of automatic installation or desktop integration.

### Key Entities

- **Product version**: The source-controlled version declared for Folio, initially updated to `1.0.0` by this feature and subsequently maintained independently of the pipeline.
- **Build run**: Packaging of one source revision, identified by its commit and workflow run, with an overall result and per-target outcomes.
- **Target**: One supported operating-system/processor-architecture combination with two required package formats and a documented compatibility baseline.
- **Package**: A versioned, target-specific archive or installation/distribution file, containing the application and guide and linked to its originating run.
- **User guide**: One source-controlled end-user document, authored independently of the pipeline, distributed as `README.md` in local and automated packages, and readable locally after installation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each successful delivery provides exactly the 12 required package files covering all six targets, with no missing format or ambiguous target label.
- **SC-002**: For all 12 package forms, a recipient on a matching supported machine can install or extract, launch Folio, open a Markdown document, save an edit, and use a bundled theme offline without developer tooling.
- **SC-003**: All packages in a delivery represent the product version declared in their source revision and are traceable to that same revision.
  This holds for the initial `1.0.0` version and a representative subsequent source-version change without modifying the pipeline.
- **SC-004**: A failed target or missing download prevents a successful overall delivery in every exercised failure scenario; output from another revision never fills the gap.
- **SC-005**: The user guide is present and accessible offline in all 12 package forms, remains available after installation media is removed, and covers every topic required by FR-014 and FR-015.
- **SC-006**: A recipient using only the bundled guide can open a file or folder, switch to source mode, save a change, change the theme, and find removal instructions on each operating system.
- **SC-007**: Both Windows architectures support standard-user installation and removal, and the documented transition from an earlier installation preserves the user's existing documents and settings.
- **SC-008**: Before automation is added, the source declares product version `1.0.0`, the consumer guide exists as a maintained product asset, and a local application package includes both the declared version and that guide.

## Assumptions

- "After each change push (merge)" means each update to `main`, whether by merge or direct push.
  Publishing feature-branch or pull-request package sets is outside this feature.
- x64 and arm64 are separate native application targets on every operating system.
  Universal macOS bundles, 32-bit processors, and other architectures are outside scope.
- Version 1.0 is represented as `1.0.0` in the product source, not configured as a pipeline version.
  The existing authoritative declaration is in `package.json`, with corresponding product-version metadata in `package-lock.json`.
  These product files are updated as source changes, not rewritten by the pipeline.
  Automatic semantic-version increments and a tagged-release workflow are outside scope.
- The consumer guide has a maintained source separate from the repository's contributor-oriented material.
  Its source location is selected during planning; all packages reuse that source rather than generating documentation in the workflow.
- Initial packages are unsigned and macOS packages are not notarized.
  Code-signing certificates, notarization credentials, paid signing services, and automatic updates are not prerequisites or deliverables.
- Actions artifacts follow the repository's configured access and retention policies.
  They are not anonymous, permanent release hosting; the download instructions must explain the applicable access requirements.
- Fedora is the required Linux compatibility reference.
  Exact supported OS versions and practical verification environments for all six targets must be recorded during planning rather than guessed from the build host.
- The existing Linux `.deb` capability is not part of the automated published matrix and is not removed by this feature.
  Other unrelated local packaging behavior remains supported.
- Archive-based use does not change where Folio stores settings or automatically install shell launchers or file associations.
  Existing platform-specific command-install limitations must be explained rather than silently expanded.
- The Anniversary README is a reference for simplicity and user focus, not a statement that Folio is a single-file application or shares Anniversary's runtime prerequisites.
- The current constitution's Technology & Platform Constraints explicitly name NSIS for Windows.
  Planning must resolve the conflict with the confirmed Inno Setup requirement through a constitution amendment or a justified exception recorded under the constitution's governance rules.
  This specification records the proposed change; it does not itself amend the constitution.
