# Skill discovery procedure

Use this when no skill already available to the current session fits the user's task.

1. Translate the need into two or three specific search terms (for example, `product requirements interview`, `technical specification`, or `implementation plan`).
2. Check the skills.sh leaderboard for a strong candidate before searching. Search with `npx skills find <query>` and try alternate wording if needed.
3. Open the candidate's skills.sh detail page and source repository. Verify what it does, its current install count, repository stars, publisher/source, installation syntax, and any security-audit badges or warnings displayed.
4. Reject poor matches even if popular. In particular, check whether the skill requires an issue tracker, publishes externally, or assumes another workflow. Do not treat popularity as proof of fit or safety.
5. Recommend at most two candidates. For each include:
   - name and practical purpose;
   - install count and source reputation (include repository stars when available);
   - prerequisites or external side effects;
   - exact `npx skills add <repo> --skill <name> -g` command;
   - direct skills.sh link.
6. Leave installation to the user unless they explicitly ask to install/proceed. If no appropriate skill exists, say so and offer the local `project-docs` workflow or creating a dedicated skill.

For a first-party directory search, the CLI supports:

```sh
npx skills find "<specific query>"
```

Use the current install command and package syntax shown by the candidate's skills.sh page; do not assume a search result is installable under the same slug.
