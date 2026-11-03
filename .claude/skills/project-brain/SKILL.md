---
name: project-brain
description: "Guide project ideas, new features, and AI skill selection: interview the user, route to suitable skills, and coordinate the required project documents."
---

# Project Brain

Act as the user's reusable entry point for project and feature work. Help decide what to do next, use relevant skills already available, and discover candidates when the right skill is missing. Be a coordinator, not a heavyweight process imposed on unrelated requests.

## Choose the current phase

Classify the request as one of these:

- **Explore or start an idea/project/feature:** interview first, then wait for the user's explicit confirmation of the intent. After confirmation, end that turn. On the user's next request to continue, create the project documents and recommend the next skill.
- **Continue a project or execute a defined task:** inspect its existing documents, codebase, and available skills; select the best next action and skill. Interview only if a decision is genuinely unresolved.
- **Find a skill:** use the discovery procedure below and recommend the best fit.

## Interview for new work

Use the `interview-me` method if that skill is available. Otherwise follow its core interaction pattern:

1. State a one-sentence hypothesis and an honest confidence percentage. Below 70%, briefly say what is missing.
2. Ask exactly one focused question per turn, with your best guess and why. Wait for the answer before asking another question.
3. Clarify the user, outcome, reason, success criteria, and binding constraint. Call out vague or conventional answers and ask for concrete examples when needed.
4. When you can predict the user's next answers with about 95% confidence, restate the intent in 5–8 concise lines, including outcome, user, why now, success, constraint, and out of scope.
5. Require explicit confirmation. Fold corrections into a revised restatement. When the user confirms, give the confirmed intent and downstream options, then stop that turn. Continue only after the user asks.

The interview is for product and implementation intent. Do not use it for simple mechanical edits or when the user asks to move quickly.

## Discover and select skills

Before recommending a skill, check the skills available to the current agent and the project folders `skills/` and `.agents/skills`. If the current host has a known personal-skill directory, inspect it too. Do not hardcode a Codex-only path. If an available skill fits, name it and explain why. Do not recommend a second skill just to add process.

If none fits:

1. Use the `find-skills` skill if available. Otherwise consult the skills.sh leaderboard, then search with `npx skills find <specific query>`.
2. Verify each candidate's purpose, install count, source reputation, GitHub stars, and any relevant security audit shown on skills.sh. Prefer well-used skills and established sources; be cautious below 100 installs or 100 repository stars.
3. Present one or two good candidates with what they do, install count, source, skills.sh link, and a correct install command. Mention setup requirements and external side effects, such as publishing to an issue tracker.
4. Recommend; do not install an external skill unless the user explicitly asks to install or proceed with it.

For discovery details and command patterns, see [references/discovery.md](references/discovery.md).

## Prepare project documents

After the intent is confirmed and the user asks to continue, use the `project-docs` skill to create or update all four artifacts for each new project or feature:

- `PRD.md`
- `TECH_SPEC.md`
- `TASKS.md`
- `PROJECT_MEMORY.md`

Store them under `docs/<initiative-slug>/` in the project's own folder. Read existing files first and update the matching initiative instead of overwriting unrelated work. If the project folder is not identifiable, ask where to place the documents. Never invent decisions to fill a template; mark assumptions, open questions, and unknowns clearly.

## Handoff and resume

At each phase boundary, say what is complete, what remains, and which skill is the best next step. The user may invoke a different skill directly at any point. When continuing, reread the initiative's four documents and current project state so the memory stays aligned with the work.

Do not install skills, publish artifacts to external services, or start implementation merely because a plan or recommendation mentions them. Follow the user's current request and the selected skill's scope.
