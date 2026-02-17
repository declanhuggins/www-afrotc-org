# AI Implementation Changelog

Log milestones and PRs with brief notes linking to requirements and tests.

## 2025-08-09

- Added marching engine scaffolding and core reducer (FORWARD/HALT, faces, flanks, columns, rear, counter, guide) — REQ-007/008/010/011 partial; REQ-023 done.
- Introduced FlightComposition (elements/ranks) in state; implemented FALL IN with `elements` parameter — REQ-002 done.
- Added parser for “in N elements, FALL IN” — REQ-005/022 partial.
- Created fixtures and Vitest tests; 12 tests passing; determinism test added — REQ-023.
- Updated traceability matrix mapping REQ-### to code/tests with status.
- Switched project to ESM (`"type": "module"`) to align with Vite deprecation guidance; tests green, no warnings.

## 2026-01-20

- Refined flank cadence timing (first-half beat gating, wrong-foot delay), step-rotate execution, and formation transitions — REQ-010 partial.
- Deferred guidon shifts after flanks and added in-place stop step on HALT — REQ-008, REQ-010, REQ-020 partial.
- Updated cadence UI indicators for planted/next foot and beat progress.
- Added/updated tests covering flank timing, guidon shift deferral, and halt sequencing.

## 2026-02-16

- Rewrote guidon shift logic to use a rules-table approach (`lib/marching/guidon/rules.ts`) instead of dynamic mode computation — REQ-007, REQ-020.
- Simplified `PendingGuidonShift` type to `{ fromFormation }`, enabling correct stacked flank→halt guidon shifts — REQ-010.
- Added `arrangementHeadingDeg` tracking and position-based target resolution for accurate guidon choreography at any heading — REQ-007.
- Improved mobile UI: responsive 2-column command grid, canvas scaling, panel reorder (canvas first on mobile), tighter spacing.
- Added visual indicator (red) for unimplemented command buttons.
- Bumped Cloudflare compatibility date and Node version; updated dependencies.

## 2026-02-11

- Bumped core dependencies and tooling (Next.js, OpenNext Cloudflare, ESLint, Wrangler, Undici, and @types/node).
