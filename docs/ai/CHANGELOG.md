# AI Implementation Changelog

Log milestones and PRs with brief notes linking to requirements and tests.

## 2025-08-09

- Added marching engine scaffolding and core reducer (FORWARD/HALT, faces, flanks, columns, rear, counter, guide) — REQ-007/008/010/011 partial; REQ-023 done.
- Introduced FlightComposition (elements/ranks) in state; implemented FALL IN with `elements` parameter — REQ-002 done.
- Added parser for “in N elements, FALL IN” — REQ-005/022 partial.
- Created fixtures and Vitest tests; 12 tests passing; determinism test added — REQ-023.
- Updated traceability matrix mapping REQ-### to code/tests with status.
- Switched project to ESM (`"type": "module"`) to align with Vite deprecation guidance; tests green, no warnings.
