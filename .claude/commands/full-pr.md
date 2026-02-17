---
description: Execute full PR workflow (default dev -> main)
---

Execute a full pull request workflow. If arguments are provided (e.g., `dev -> main`), use them as `<source> -> <target>`. Otherwise default to `dev -> main`.

Arguments: $ARGUMENTS

Follow these steps in order. Do NOT skip any step.

## Step 1: Confirm diff exists
- Run `git status` to check for uncommitted changes
- Run `git diff --stat <target>...<source>` to confirm there are changes to review
- If the diff is empty, stop and ask which branch contains the edits

## Step 2: Review against repo rules
- Check for `.github/PULL_REQUEST_TEMPLATE*` and `CONTRIBUTING.md`
- Review the full diff (`git diff <target>...<source>`) for correctness, style, and security
- Identify any issues and fix them before proceeding

## Step 3: Update required docs (if they exist)
- If `docs/ai/` exists, keep these in sync with the changes:
  - `docs/ai/analysis/requirements.md`
  - `docs/ai/plan/implementation-plan.md`
  - `docs/ai/plan/test-plan.md`
  - `docs/ai/tracing/traceability.md`
- Update `docs/ai/CHANGELOG.md` with a summary of what changed

## Step 4: Quality gates (run and fix until green)
- Run: `npm test`
- Run: `npm run lint`
- Run: `npm run build`
- If any fail, fix the issues and re-run until all pass

## Step 5: Commit hygiene
- Flag any non-obvious files (editor configs, generated artifacts, lockfile churn) before staging
- Ask for confirmation before including unexpected files
- Stage, commit, and push to `<source>`

## Step 6: Create the PR
- Push `<source>` with `-u` if needed
- Create the PR using `gh pr create` from `<source>` to `<target>` with:
  - A clear title summarizing the changes
  - A body containing: summary bullets, quality gate results with pass/fail, and a test plan
