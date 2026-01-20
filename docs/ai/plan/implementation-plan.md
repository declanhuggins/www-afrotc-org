# Marching Simulator — Implementation Plan

This plan turns the requirements in `requirements.md` into a concrete, testable build strategy.

## 1) Architecture Overview

**Goal:** A deterministic, portable engine with a thin UI and optional Cloudflare Workers glue.

### Layers
1. **Core Engine (pure logic)**
   - **Inputs:** `(State, Command)`
   - **Outputs:** `NextState` + `Effects` (animation hints, audio cues)
   - No I/O, deterministic, side‑effect free. Maps directly to REQ‑001..023.
2. **Command Interface**
   - Text command parser → `CommandAST` (REQ‑005, REQ‑022).
   - Pending/preparatory buffer with cancel (`As You Were`) (REQ‑005).
   - Validator producing `Either<ValidatedCommand, Rejection>` (REQ‑006, REQ‑021).
3. **Simulation Orchestrator**
   - Applies cadence, step timing, and half‑step rules to interpolate between states (REQ‑004, REQ‑008–013).
   - Timeline controls (play/pause/step/frame‑advance), snapshot/restore (REQ‑023).
4. **Renderer (UI)**
   - Deterministic layout from `State` → positions (pixel/units) (REQ‑003, REQ‑014–018).
   - 2D Canvas/WebGL draw; UI controls for commands and speed.
5. **Persistence/Sharing (optional)**
   - Serialize `State` and a command script; permalink/share via Worker KV or D1.
6. **Cloudflare Workers integration (optional)**
   - Minimal API for saving/loading scenarios and sharing read‑only replays.
   - Engine itself runs client‑side for responsiveness; server remains stateless.

### Data Flow
`User Input → Parser → Pending (if prep only) → Validator → Engine Reducer → Next State → Orchestrator (cadence/timing) → Renderer`

## 2) Data Model and Types (language‑agnostic, TypeScript‑leaning)

> No code yet — these are type *shapes* to keep implementation consistent.

- **State** (REQ‑002, REQ‑023)
  - `formationType`: `line | column | inverted line | inverted column`
  - `interval`: `normal | close`
  - `headingDeg`: number (0–359) — absolute heading (REQ‑002, REQ‑007, REQ‑010–012)
  - `motion`: `halted | marching`
  - `guideSide`: `left | right` (REQ‑020)
  - `composition`: `{ elementCount: number, rankCount: number }` (DAFPAM elements/ranks)
  - `cadenceSpm`: number (100–120 default) (REQ‑004)
  - `stepLenIn`: number (24 default) (REQ‑004)
  - `spacing`: `{ coverIn: 40, intervalNormalIn: 30, intervalCloseIn: 4 }` (REQ‑003)
  - `pendingPrep`: `null | { command: CommandAST, atTime?: number }` (REQ‑005)
  - `metadata`: `{ scenarioName?: string, notes?: string }`
- **CommandAST / Command**
  - `kind`: e.g., `FALL_IN`, `FORWARD_MARCH`, `HALT`, `LEFT_FACE`, `RIGHT_FLANK`, `COLUMN_RIGHT`, `COUNTER_MARCH`, `OPEN_RANKS`, `CLOSE_RANKS`, `DRESS_RIGHT_DRESS`, `READY_FRONT`, `GUIDE_LEFT`, `AS_YOU_WERE`, etc. (REQ‑005, REQ‑007–018, REQ‑020)
  - `params`: qualifiers like direction (`left/right`), magnitude (`half/full`), source (`from right/left`), etc.
    - For `FALL_IN`, include `{ elements: number }` to set `elementCount` (2–4 typical)
- **Effects**
  - `animationHints`: `{ useHalfStep?: boolean, snapAlignOnHalt?: boolean }`
  - `audible`: optional cues for metronome/voice (future UI)
- **Geometry**
  - Pure functions: `(State) -> CadetPositions[]` derived from distances (REQ‑003, REQ‑014).

**Key invariants** (enforced in the reducer & validator)
- Distances: 40″ cover; 30″ normal interval; 4″ close; 24″ step (REQ‑003, REQ‑004).
- Facing requires `halted`; flanks/columns require `marching` (REQ‑006–011).
- Deterministic transitions; no randomness (REQ‑023).

## 3) Modules and Responsibilities

- `parser/`
  - Text → `CommandAST` (handles commas/pauses, casing, shorthands) (REQ‑005, REQ‑022).
- `validator/`
  - `(State, CommandAST) -> ValidatedCommand | Rejection` (REQ‑006, REQ‑021).
- `engine/`
  - `reduce(state, cmd) -> { nextState, effects }` (REQ‑001..018, REQ‑020).
  - Submodules: `facing`, `flanks`, `columns`, `toRear`, `countermarch`, `intervalAdjust`, `openCloseRanks`, `files/twos/fours`.
- `geometry/`
  - Spacing, rank/file math, layout given `State` and cadet count (REQ‑003, REQ‑014–018).
- `timing/`
  - Cadence/step clocks, half‑step restoration logic (REQ‑004, REQ‑008–013).
- `orchestrator/`
  - Timeline, snapshots, determinism guarantees (REQ‑023).
- `ui/`
  - Canvas rendering, command input, minimal accessibility hooks.
- `persistence/`
  - Scenario import/export; (optional) Worker KV/D1 API types.
- `logging/`
  - Structured logs in dev builds; disabled in production (determinism unchanged).

## 4) Performance & Cloudflare Workers Constraints

**Targets**
- *Engine compute per command:* typical < 5 ms; worst‑case (large flights) < 50 ms.
- *Memory:* derived positions computed on demand; avoid storing cadet‑level history unless user requests a replay snapshot.
- *Bundle:* split `engine` (shared) and `ui` (client).

**Strategies**
- Pure functions enable memoization of geometry by `(formationType, interval, composition)`.
- Avoid large arrays churn; reuse buffers in renderer.
- If server features are added:
  - Keep Workers endpoints stateless and short‑lived; store scenarios in KV/D1.
  - Rate‑limit heavy endpoints and push heavy ops to client.
  - Use deterministic engine on server as well (same tests run in CI).

  ## Current status (Dec 2025)
  - **Implemented:** core reducer for faces/flanks/columns/rear/counter, forward/halt; parser for core commands; geometry grid; orchestrator with cadence stepping, halt sequencing (including in-place stop beat), flank step-rotate timing, wrong-foot flank delay, guidon repositioning during facing transitions, and deferred guidon shifts after flanks.
  - **Partially implemented:** spacing constants differ from spec (30" cover / 35" interval), no dress/cover enforcement; column/flank/rear/counter maneuvers are heading-only (no staggered file pivots or recovery distances); Open/Close Ranks gated but do not move ranks; parser lacks preparatory buffer/`As You Were`.
  - **Not implemented:** interval changes on the move, column of files, expand/reform twos/fours, Count Off, persistence/sharing flows, validator layer, accessibility/UI tests, performance budgets.

## 5) Milestones & Acceptance

**M0 — Project skeleton**
- Repo layout, CI, lint/format, test harness.
- **Acceptance:** CI green; empty reducer + failing placeholder tests are wired.

**M1 — State model & validator (REQ‑001..006, REQ‑020, REQ‑023)**
- Implement `State` shape, invariants, parser for basic commands, pending/prep, `As You Were`.
- **Acceptance:** Unit tests validate context rules; snapshot determinism proven.

**M2 — Core motions I (REQ‑007, REQ‑008)**
- Facing at halt; Forward/Halt including alignment snap.
- **Acceptance:** Happy‑path tests and geometry checks pass.

**M3 — Core motions II (REQ‑009–REQ‑011)**
- Columns (incl. half), Flanks, To the Rear with half‑step restoration.
- **Acceptance:** Turn/heading math verified; preserved order/spacing in golden snapshots.

**M4 — Counter‑March (REQ‑012)**
- Engine and timing hints.
- **Acceptance:** End‑state matches spec; determinism maintained.

**M5 — Intervals & Dress (REQ‑013–REQ‑014, REQ‑018)**
- Close/Extend on the move; At Close Interval Dress Right/Ready Front; Open/Close Ranks.
- **Acceptance:** Spacing changes correct for 3–4 ranks.

**M6 — Files/Twos/Fours (REQ‑015–REQ‑017)**
- Column of Files; expand/merge to twos/fours.
- **Acceptance:** File ordering & 40″ cover maintained; golden snapshots.

**M7 — UI minimal + Accessibility hooks**
- Canvas renderer, input, basic A11y (labels, keyboard focus).
- **Acceptance:** Manual smoke + automated UI assertions.

**M8 — Persist/Share (optional)**
- Export/import scenario; Worker endpoints if needed.
- **Acceptance:** Same state loads across devices; tests run in Worker CI.


## 6) Traceability (REQ → Module)

- REQ‑001/002/023 → `engine`, `state`, `orchestrator`
- REQ‑003/014/018 → `geometry`, `engine`
- REQ‑004/008–013 → `timing`, `engine`, `orchestrator`
- REQ‑005/022 → `parser`
- REQ‑006/021 → `validator`
- REQ‑007/009–012/015–017/020 → `engine`
- REQ‑019 → `ui` (optional cosmetic)

## 7) Risks & Mitigations

- **Spec interpretation drift** → Add golden snapshots reviewed by SMEs.
- **Performance regressions** → CI perf budget per command; fail builds on regress.
- **Environment mismatch (Worker vs Browser)** → Keep engine isomorphic; test in both.


