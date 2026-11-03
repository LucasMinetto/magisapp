# Project document contract

Create all four files for each confirmed project or feature. Keep a consistent initiative name, goals, scope, and terminology across them. Adapt headings to the work, but retain the substance below.

## `PRD.md`

- Context and problem in the user's terms
- Target user and the need
- Desired outcome and measurable success signals (or mark metrics as undecided)
- Scope and explicit out-of-scope items
- User stories or use cases with observable acceptance criteria
- Product constraints, dependencies, assumptions, and open questions

## `TECH_SPEC.md`

- Link to the PRD and summarize the relevant existing system/context
- Proposed approach and why it fits the confirmed requirements
- Affected components, data, APIs, integrations, and interfaces as applicable
- Behavior on errors, edge cases, permissions, and compatibility where relevant
- Security, performance, migration, and rollout considerations when applicable
- Verification approach and architectural decisions that still need user input

For a new project with no codebase, state that architecture is proposed and distinguish decisions from assumptions. For a change in an existing repository, inspect the relevant code and project guidance before describing current behavior.

## `TASKS.md`

- Link to the PRD and technical spec
- Ordered, small, actionable tasks with dependencies
- For each task: intended result, acceptance criteria, and relevant files/components when known
- Include documentation, migration, accessibility, or rollout tasks only when relevant
- Mark tasks blocked by unresolved decisions; do not convert uncertainty into false precision

## `PROJECT_MEMORY.md`

- Project purpose and current status
- Stable domain vocabulary and important constraints
- Confirmed architecture and decisions, with links to the spec or ADRs
- Useful commands and development conventions discovered in the repository
- Current next step, open questions, and links to the other three documents

Keep memory concise and update it as the work changes. Do not store secrets or duplicate entire documents.

## Integrity rules

- Keep user-confirmed decisions separate from assistant recommendations.
- Cite repository file paths for claims about existing code where practical.
- Use explicit `TBD`, `Assumption`, or `Open question` labels when information is missing.
- Preserve existing project documentation and conventions; do not rewrite unrelated docs.
