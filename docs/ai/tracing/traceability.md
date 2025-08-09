# Traceability Matrix

Map requirements (REQ-###) to implementation and tests. Status: Done / Partial / Planned.

| REQ | Implementation | Tests | Status |
|-----|----------------|-------|--------|
| REQ-001 Formation state machine | lib/marching/engine/reducer.ts (state transitions skeleton); lib/marching/types.ts | tests/reducer.test.ts | Partial |
| REQ-002 State schema (incl. composition: elements/ranks) | lib/marching/types.ts; reducer FALL_IN param handling | tests/reducer.test.ts (FALL IN parser+reducer) | Done |
| REQ-003 Spacing/distances | Types constants in lib/marching/types.ts (DEFAULT_SPACING) | — | Planned |
| REQ-004 Cadence/step length | Types constants in lib/marching/types.ts; placeholders | — | Planned |
| REQ-005 Prep + exec parsing | lib/marching/parser/index.ts (FALL IN only) | tests/reducer.test.ts (parser) | Partial |
| REQ-006 Context validation | reducer gates (halted vs marching) for faces/flanks/columns | tests/reducer.test.ts (facing/flanks) | Partial |
| REQ-007 Facing at halt | reducer: LEFT/RIGHT/ABOUT_FACE (halt only) | tests/reducer.test.ts | Done |
| REQ-008 Forward/HALT | reducer: FORWARD_MARCH, HALT + snap hint | tests/reducer.test.ts | Done |
| REQ-009 Column movements | reducer: COLUMN_(RIGHT/LEFT/HALF) heading updates + half-step hint | tests/reducer.test.ts (half turn) | Partial |
| REQ-010 Flanks while marching | reducer: LEFT/RIGHT_FLANK (march only) | tests/reducer.test.ts | Partial |
| REQ-011 To the Rear | reducer: TO_THE_REAR + half-step hint | tests/reducer.test.ts | Done |
| REQ-012 Counter March | reducer: COUNTER_MARCH heading flip + hint | tests/reducer.test.ts | Partial |
| REQ-013 Interval adjust (move) | — | — | Planned |
| REQ-014 Interval at halt / Dress | reducer: AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS, READY_FRONT | tests/reducer.test.ts | Partial |
| REQ-015 Column of Files from Line | — | — | Planned |
| REQ-016 Expand to twos/fours | — | — | Planned |
| REQ-017 Reform twos ↔ fours | — | — | Planned |
| REQ-018 Open/Close Ranks | reducer: OPEN_RANKS/CLOSE_RANKS gatechecking | tests/reducer.test.ts | Partial |
| REQ-019 Count OFF | — | — | Planned |
| REQ-020 Guide/base side | reducer: GUIDE_LEFT/RIGHT | tests/reducer.test.ts | Partial |
| REQ-021 Error handling | reducer returns error messages on invalid context | tests/reducer.test.ts (invalid checks) | Partial |
| REQ-022 Flexible input | parser tolerant to case/spaces/commas for FALL IN | tests/reducer.test.ts (parser cases) | Partial |
| REQ-023 Determinism | pure reducer; normalizeHeading | tests/reducer.test.ts (determinism) | Done |

Notes
- “Partial” generally indicates heading/state updates and context gates exist, but nuanced geometry/timing is deferred to future milestones per the implementation plan.
