# Traceability Matrix

Map requirements (REQ-###) to implementation and tests. Status: Done / Partial / Planned.

| REQ | Implementation | Tests | Status |
|-----|----------------|-------|--------|
| REQ-001 Formation state machine | Formation types and transitions for faces/flanks/columns in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L15-L179); cadence-aware orchestration and role assignment in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L503-L620); geometry grid in [lib/marching/geometry/positions.ts](lib/marching/geometry/positions.ts#L25-L45) | State transitions and orchestrator integration in [tests/reducer.test.ts](tests/reducer.test.ts#L7-L128) and [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L6-L163) | Partial (no files/twos/fours flows; column stubbing only updates headings) |
| REQ-002 State schema | State + spacing defaults in [lib/marching/types.ts](lib/marching/types.ts#L3-L115); FALL IN element override in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L18-L30) | FALL IN parsing and reducer assertions in [tests/reducer.test.ts](tests/reducer.test.ts#L60-L85) | Done |
| REQ-003 Spacing/distances | DEFAULT_SPACING + geometry layout in [lib/marching/types.ts](lib/marching/types.ts#L84-L115) and [lib/marching/geometry/positions.ts](lib/marching/geometry/positions.ts#L25-L45) | Layout spacing smoke in [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L128-L149) | Partial (uses 30" cover / 35" interval values; does not enforce spec’s 40"/30" or dress corrections) |
| REQ-004 Cadence/step length | Cadence + step length fields in [lib/marching/types.ts](lib/marching/types.ts#L34-L92); orchestrator step clock in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L428-L449) | Cadence parity in [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L151-L163) | Partial (no perf budgets; half-step timing only hinted) |
| REQ-005 Prep + exec parsing | Command parsing for core commands in [lib/marching/parser/index.ts](lib/marching/parser/index.ts#L7-L88) | Parser mappings in [tests/reducer.test.ts](tests/reducer.test.ts#L69-L103) | Partial (no preparatory buffer/As You Were) |
| REQ-006 Context validation | Halt/march gating in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L52-L138) | Context errors in [tests/reducer.test.ts](tests/reducer.test.ts#L15-L50) | Partial (no rich error reasons beyond simple strings) |
| REQ-007 Facing at halt + guidon choreography | Facing transitions in reducer [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L52-L83); guidon straight/pivot moves for faces in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L528-L595) | Guidon regression matrix in [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L64-L125) | Partial (guidon handles face-to-line/inverse; other choreography steps not simulated) |
| REQ-008 Forward/HALT | FORWARD/HALT state changes in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L40-L50); halt sequencing in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L508-L527) | Forward/Halt state + halt sequence tests in [tests/reducer.test.ts](tests/reducer.test.ts#L7-L35) and [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L40-L50) | Done |
| REQ-009 Column movements | Heading deltas + half-step hints in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L106-L132); moving-turn sequence in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L597-L608) | Column half-turn expectation in [tests/reducer.test.ts](tests/reducer.test.ts#L44-L50) | Partial (no staggered file pivots or distance recovery) |
| REQ-010 Flanks while marching | Heading change + moving-turn sequence in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L85-L97) and [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L597-L608) | Flank sequence in [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L52-L62) | Partial (simplified timing/foot placement) |
| REQ-011 To the Rear | Heading flip + half-step hint in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L99-L105); moving-turn in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L597-L608) | Rear turn in [tests/reducer.test.ts](tests/reducer.test.ts#L37-L43) | Partial (no staggered recovery steps) |
| REQ-012 Counter March | Heading reversal hint in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L134-L138) | — | Partial (no element-level pathing) |
| REQ-013 Interval adjust (move) | — | — | Gap |
| REQ-014 Interval at halt / Dress | Interval toggle in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L150-L165) | Interval gating in [tests/reducer.test.ts](tests/reducer.test.ts#L105-L114) | Partial (no dress alignment geometry) |
| REQ-015 Column of Files from Line | — | — | Gap |
| REQ-016 Expand to twos/fours | — | — | Gap |
| REQ-017 Reform twos ↔ fours | — | — | Gap |
| REQ-018 Open/Close Ranks | Gate checks only in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L162-L175) | Parser mapping in [tests/reducer.test.ts](tests/reducer.test.ts#L87-L103) | Partial (no rank spacing logic) |
| REQ-019 Count OFF | — | — | Gap |
| REQ-020 Guide/base side | Guide state toggles in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L134-L148); guidon role assignment/order in [lib/marching/orchestrator/index.ts](lib/marching/orchestrator/index.ts#L20-L85) | Guide toggles and ordering in [tests/reducer.test.ts](tests/reducer.test.ts#L52-L58) and [tests/orchestrator.test.ts](tests/orchestrator.test.ts#L128-L149) | Partial (no dress-to-base adjustments) |
| REQ-021 Error handling | No-op with error string in [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L3-L14) | Invalid-context assertions in [tests/reducer.test.ts](tests/reducer.test.ts#L15-L35) | Partial (no user-facing messaging layer) |
| REQ-022 Flexible input | Case/spacing tolerant parser in [lib/marching/parser/index.ts](lib/marching/parser/index.ts#L7-L88) | Parser coverage in [tests/reducer.test.ts](tests/reducer.test.ts#L69-L103) | Partial (no ambiguity resolution, no preparatory buffer) |
| REQ-023 Determinism | Pure reducer + heading normalization in [lib/marching/types.ts](lib/marching/types.ts#L93-L115) and [lib/marching/engine/reducer.ts](lib/marching/engine/reducer.ts#L15-L179) | Determinism check in [tests/reducer.test.ts](tests/reducer.test.ts#L116-L128) | Done |

Gaps and divergences
- Spacing constants use 30" cover / 35" normal interval; spec calls for 40" cover / ~30" normal interval (adjust or document rationale).
- No implementations yet for interval changes on the move, column of files, twos/fours transitions, or count-off.
- Column/flank/rear/counter sequences are heading-only; no staggered pivots, half-step recovery, or distance-based alignment.
- Open/Close Ranks are gated but do not move ranks; Ready Front is a no-op.
- Parser lacks preparatory/execution buffering and `As You Were`; validation does not surface user-facing guidance.
