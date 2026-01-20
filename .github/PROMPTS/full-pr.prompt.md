---
description: Execute full PR workflow from source -> target using repo checklist
---

Execute a full pull request from dev -> main using the repository PR checklist/templates.

Do this end-to-end:
- confirm diff exists: git status + git diff --stat main...dev
- review changes and fix violations
- update required docs (docs/ai/*) and changelog if required by checklist
- run: npm test, npm run lint, npm run build (fix until green)
- confirm inclusion of any non-obvious files (workspace, lockfile churn)
- push dev and prepare PR title/body + checklist ✅/❌ + commands run/results