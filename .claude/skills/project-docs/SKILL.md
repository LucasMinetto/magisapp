---
name: project-docs
description: "Create and maintain a project's PRD, technical specification, task plan, and durable project memory under its docs folder."
---

# Project Docs

Use after the user has agreed on the intent for a new project or feature, or when they ask to update the planning documents. The required set is always four documents. Write them in the user's language, usually Portuguese.

## Locate the initiative

Find the project's root from the open workspace and conversation. Store this initiative's files under:

```text
<project-root>/docs/<initiative-slug>/
  PRD.md
  TECH_SPEC.md
  TASKS.md
  PROJECT_MEMORY.md
```

Use a short, stable, lowercase slug. Read existing project guidance and matching documents before writing. Update documents for the same initiative; do not overwrite another feature's folder. If the project root cannot be identified, ask the user for its location rather than placing files in an unrelated directory.

## Write the four artifacts

Use [references/document-contract.md](references/document-contract.md) for the required content and how the documents stay consistent.

Capture decisions in the documents only when they are supported by the interview, the user's instruction, or evidence in the repository. Label assumptions, unknowns, and open questions. Do not fill gaps with invented technical details. Keep the documents useful for the next skill or person, not as generic boilerplate.

## Keep them current

When the user continues work, read the four files and relevant project state first. Update `PROJECT_MEMORY.md` when decisions, architecture, commands, constraints, or current status change. Keep it a concise index and durable context; link to the PRD, spec, and task plan instead of copying their contents.

Do not start implementation, add tests, or publish the documents to an external service unless the user asks for that work.
