# Specification Quality Checklist: Multiple Independent Windows

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Validation iteration 1 found three issues, all fixed in the spec:
  - User Story 2 cited a developer-only launch command. It now uses the user-facing `folio` command.
  - SC-004 claimed every new window is offset by 30 points, which contradicts the wrap-to-top-left rule. It now states the offset and the wrap together.
  - An edge case claimed every dialog is attached to its window, but some error boxes are application-wide. It is now limited to unsaved-changes prompts, file dialogs and document messages.
- Validation iteration 2: every item passes.
- No clarification questions were needed. Each choice was resolved from the shipped code, the commit messages of `8062af5`, `87e9165` and `5b4fe2e`, and README.md:
  - macOS keeps running after the last window closes.
  - A second launch without a path focuses the most recently used window.
  - View preferences seed new windows but do not sync live.
- Platform-specific shortcuts (`` Cmd+` `` vs `Ctrl+Tab`), menu paths, Finder and the Dock are user-facing details. They are not implementation details.
- Requirements that touch behavior owned by other specs (launch-path parsing in 003, live reload in 001, history in 005) state only the per-window or cross-window aspect. The rest is deferred to those specs in Assumptions.
- Retroactive: validated against the shipped implementation on 2026-10-18.
