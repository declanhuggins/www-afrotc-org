# Marching Simulator — Test Plan

Covers the engine (pure logic), parser/validator, orchestrator/timing, and minimal UI. All tests are traceable to `requirements.md` REQ IDs.

## 1) Test Strategy

- **Unit tests (engine, parser, validator, geometry)** — fast, deterministic; cover all transitions and invariants.
- **Property‑based tests** — determinism, reversibility where applicable, spacing invariants.
- **Snapshot (golden state) tests** — verify exact end‑states for canonical command scripts.
- **Performance tests** — per‑command CPU budget; big‑N formations.
- **Integration tests (orchestrator)** — cadence/half‑step restoration and timeline stepping.
- **UI tests (minimal)** — command entry, pending/execution behavior, focus/labels; smoke coverage.

### Current automated coverage (Dec 2025)
- **Engine reducer**: facing, flanks, column half-turns, forward/halt, guide toggles, interval-at-halt gating, and determinism checked in [tests/reducer.test.ts](../../tests/reducer.test.ts#L7-L128).
- **Parser**: tolerant mappings for core commands (incl. FALL IN with element count) in [tests/reducer.test.ts](../../tests/reducer.test.ts#L69-L103).
- **Orchestrator**: cadence stepping, halt sequencing, moving-turn sequences, guidon repositioning during faces, fall-in ordering, and march timing in [tests/orchestrator.test.ts](../../tests/orchestrator.test.ts#L6-L163).
- **Geometry**: formation ordering smoke coverage via orchestrator test [tests/orchestrator.test.ts](../../tests/orchestrator.test.ts#L128-L149).

### Known gaps
- No coverage yet for interval changes on the move, column of files, twos/fours transitions, rank spacing for Open/Close Ranks, or Count Off.
- Spacing enforcement uses 30" cover / 35" interval constants; spec calls for 40" cover / ~30" interval — needs alignment or rationale plus tests.
- Parser/validator lacks preparatory/execution buffering and `As You Were`; no ambiguity handling tests.

Target coverage: **≥ 90%** lines/branches for `engine`, `validator`, and `geometry`; **≥ 80%** for `parser`.

## 2) Engine Tests

### Happy‑path Commands (by REQ)
- **Facing at halt** (REQ‑007): Left/Right/About Face update `headingDeg` and preserve geometry.
- **Forward/Halt** (REQ‑008): `motion` toggles; alignment snap on HALT.
- **Columns** (REQ‑009): full & half right/left; base file leads; order preserved.
- **Flanks** (REQ‑010): 90° pivot on correct foot; formation orientation updated.
- **To the Rear** (REQ‑011): 180° on move; file order maintained; half‑step recovery.
- **Counter‑March** (REQ‑012): in‑place reversal yields mirrored heading; spacing restored.
- **Interval adjust (move)** (REQ‑013): Close/Extend maintains base file; recovery to full step.
- **Interval at halt / Dress** (REQ‑014): At Close Interval Dress Right; Ready Front restores attention.
- **Open/Close Ranks** (REQ‑018): correct paces by rank; only valid in halted line.
- **Files/Twos/Fours** (REQ‑015–017): column of files from line; expand to twos/fours; reform twos↔fours.
- **Guide/Base** (REQ‑020): Guide Left toggles base; dress aligns to base flank.

### Invariants (always)
- **Spacing** (REQ‑003): 40″ cover; 30″ normal interval; 4″ close interval.
- **Cadence/Step** (REQ‑004): 24″ step; half‑step behavior triggers when required.
- **Determinism** (REQ‑023): same input → identical `NextState` JSON; time/cadence only via orchestrator clock.

### Context & Error Handling
- **Invalid commands ignored** (REQ‑006, REQ‑021): e.g., Column Right while halted; Open Ranks while marching.
- **Ambiguity prompts** (REQ‑021, REQ‑022): “Left, MARCH” rejected until qualifier specified.
- **Redundancy no‑op** (REQ‑006): Forward while already marching; HALT while halted.

### Parser/Validator
- **Preparatory + execution** (REQ‑005): pending buffer set on prep; cleared on exec or `As You Were`.
- **Shorthand/casing/punctuation** (REQ‑022): commas/spaces/case variants accepted; one executable at a time.

## 3) Edge Cases

- Empty input, whitespace, punctuation‑only.
- Multi‑word qualifiers: “Column of Files From the Right, Forward, MARCH” (REQ‑015).
- Odd cadet counts leading to uneven files (REQ‑016/017).
- Minimum sizes (e.g., 1 rank × 1 file) and maximum configured sizes (e.g., 10 × 16).

## 4) Large Formations & Performance

- Datasets: 16×16 (256 cadets) and 10×20 (200 cadets).
- **Budget:** typical command < 5 ms; worst‑case < 50 ms on CI machine.
- Measure reducer time, geometry time, and total orchestration step. Fail test if budgets exceeded.

## 5) Determinism Checks

- Run the same script N times; compare JSON snapshots (deep equality).
- Inject different wall‑clock times — engine remains unchanged (orchestrator manages timing externally).
- Serialize → Deserialize → Reduce → Same result (idempotent snapshotting).

## 6) Snapshot (Golden) Suites

- Canonical scripts per maneuver category (REQ groups).
- Golden JSON of `State` after each command; stored under `tests/golden/`.
- SME‑approved; changes require review and explicit fixture update.

## 7) Integration Tests (Orchestrator/Tming)

- Cadence stepping at 100, 110, 120 spm; step length 24″.
- Half‑step restoration after columns/flanks/rear/counter‑march.
- Pause/resume/step‑through maintains consistency with pure engine results.

## 8) UI Tests (Minimal)

- Type a command → pending shown until execution word.
- `As You Were` clears pending.
- Canvas renders correct count & bounding box after each state change.
- **Accessibility:** command input has labels, focus order is logical; keyboard‑only basic flow; ARIA roles on controls; color contrast smoke via automated check.

## 9) Test Data & Fixtures

- **Scenario YAML**: initial states + command scripts.
- **Randomized scripts**: constrained generators that respect context rules (fuzzing error paths separately).

## 10) CI & Tooling

- Run unit/property/perf on every PR; fail on coverage < thresholds.
- Golden drift gate.
- (If Workers used) run a small suite in Miniflare/Workers runtime for isomorphism.

## 11) Traceability Matrix (sample)

| REQ | Tests |
|---|---|
| REQ‑003 | geometry spacing suite; spacing property tests |
| REQ‑004 | cadence/step integration; half‑step triggers |
| REQ‑005 | preparatory buffer; `As You Were` cancel |
| REQ‑006/021 | invalid/ambiguous/no‑op suites |
| REQ‑007–012 | maneuver suites (facing/flanks/columns/rear/counter) |
| REQ‑013–014 | interval adjust (move/halt) suites |
| REQ‑015–017 | files↔twos↔fours suites |
| REQ‑018 | open/close ranks suite |
| REQ‑020 | guide/base alignment suite |
| REQ‑022 | shorthand/casing parsing suite |
| REQ‑023 | determinism & snapshot idempotence |

## 12) Acceptance Gates

- **Alpha:** M1–M4 complete; ≥ 85% engine coverage; core happy‑path green.
- **Beta:** M5–M6 complete; ≥ 90% core coverage; perf budgets hold on big‑N.
- **Release:** UI smoke green; accessibility checks pass; golden snapshots ratified.

