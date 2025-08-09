# Marching Simulator — Requirements (extracted from PDF)

_This document lists functional and non-functional requirements derived from the provided PDF spec. Page citations refer to the PDF where each topic appears._

- REQ-001 [High] Formation state machine (line, column, twos/fours, inverted)
  - Description: Model the flight as a state machine supporting line, column, column of twos/fours, and inverted variants.
  - Rationale: Defined formation configurations and transitions are specified in the spec (PDF: p. 1–8, 10–11, 15–20, 23, 26–27).
  - Acceptance criteria:
    - State representation includes formation type and whether moving or halted.
    - Transitions exist for all listed formations; invalid transitions are rejected.
  - Notes/assumptions:
  - State node recommendation: {formation type, interval, orientation, moving/stationary, composition (elements/ranks)}.

- REQ-002 [High] State node schema
  - Description: Represent simulator state minimally as {formation type, interval (normal/close), orientation/heading, motion (halt/march), composition: {elementCount, rankCount}}.
  - Rationale: Spec suggests this compact representation for determinism and transitions (PDF: p. 6).
  - Acceptance criteria:
    - State object can be serialized and diffed deterministically.
    - All commands map from (state + command) → new state (+ animation hints).
  - Notes/assumptions:
    - Orientation uses absolute heading; guide/base side derived from orientation + guide flag.

- REQ-003 [High] Enforce standard spacing and distances
  - Description: Maintain 40" cover front-to-back; ~30" normal interval; 4" close interval laterally.
  - Rationale: Explicit distances are specified for cover and interval (PDF: p. 1–2, 5–6, 10, 12, 17, 20–21).
  - Acceptance criteria:
    - On HALT, all members snap to exact cover/dress at the specified distances.
    - During movement, spacing is preserved except during maneuvers; half-steps restore alignment.
  - Notes/assumptions:
    - Treat arm’s length as 30" constant for simulation. Use 40" exactly for cover.

- REQ-004 [Med] Quick-time cadence and step length
  - Description: Default marching cadence is 100–120 steps/min; step length is 24" (heel-to-heel).
  - Rationale: Cadence and step length are stated for quick time (PDF: p. 12–15, 17, 20–21, 25).
  - Acceptance criteria:
    - Engine exposes cadence parameter within range; visuals reflect step length.
    - Half-step behavior supported for alignment phases.
  - Notes/assumptions:
    - Internal timing may align execution to next tick/footfall; not required.

- REQ-005 [High] Preparatory + execution command parsing
  - Description: Parse commands into preparatory and execution parts (e.g., 'Forward, MARCH') and execute only on the command of execution.
  - Rationale: Parsing rules and examples are defined; 'As You Were' cancels pending preparatory commands (PDF: p. 4, 7–10, 15–17, 29).
  - Acceptance criteria:
    - Recognize execution words (e.g., MARCH, FACE, HALT, REST).
    - Ignore extraneous filler between parts; robust to case and minor punctuation.
    - Support 'As You Were' to clear a pending preparatory command.
  - Notes/assumptions:
    - Support single-phrase combined commands like FALL IN and REST.
  - "FALL IN" may include an element count (e.g., "in 3 elements, FALL IN").

- REQ-006 [High] Context validation of commands
  - Description: Validate commands against current context (marching vs halted, applicable formations). Reject/ignore invalid ones with feedback.
  - Rationale: Spec mandates invalid/out-of-context commands be ignored or warned (PDF: p. 7–9, 11, 23).
  - Acceptance criteria:
    - Facing movements only at halt; flanks/columns only while marching.
    - Redundant commands (e.g., Forward, MARCH while already marching) have no effect.
  - Notes/assumptions:
    - Optionally display a brief rationale for ignored commands.

- REQ-007 [High] Facing movements at the halt
  - Description: Left Face, Right Face, About Face rotate the halted flight 90°/180° and update orientation/formation accordingly.
  - Rationale: Facing transitions are part of Line ↔ Column movement preparation (PDF: p. 1–8, 10–11, 15–20, 23, 26–27).
  - Acceptance criteria:
    - After facing, guide and commander adjust positions per base/guide side rules.
    - Dress is maintained toward the base element.
  - Notes/assumptions:
    - About Face reverses orientation but keeps formation geometry.

- REQ-008 [High] Forward, MARCH and HALT
  - Description: Forward, MARCH starts movement from a halt; HALT stops movement and snaps to perfect alignment.
  - Rationale: General marching control implied across movement sections (PDF: p. 12–15, 17, 20–21, 25).
  - Acceptance criteria:
    - On stepping off, maintain cadence and spacing.
    - On HALT, alignment (dress/cover) is exact at specified distances.
  - Notes/assumptions:
    - HALT may complete current footfall before stopping visually.

- REQ-009 [High] Column movements while marching
  - Description: Column Right/Left (and Half Right/Left) pivot the formation around the base file with delayed pivots for other files; resume full steps after alignment.
  - Rationale: Detailed behavior of column movements and half-turns described (PDF: p. 3, 9, 19, 28).
  - Acceptance criteria:
    - Base file turns immediately; other files execute delayed pivots with half-steps until aligned.
    - After turn completion, command Forward, MARCH resumes full step (auto-resume optional on half turns).
  - Notes/assumptions:
    - Support multi-file columns (twos/fours) with appropriate stagger logic.

- REQ-010 [High] Flanks while marching
  - Description: Right/Left Flank pivots the entire formation 90° simultaneously on the execution foot; formation orientation swaps appropriately.
  - Rationale: Flank behavior and guide position rules specified (PDF: p. 3, 7–9, 11, 17–18, 28).
  - Acceptance criteria:
    - All members pivot on correct foot; relative positions within formation are preserved.
    - Guide remains on same relative flank; adjust only if halted out of place.
  - Notes/assumptions:
    - Used primarily for repositioning; not typical for long-distance marching.

- REQ-011 [High] To the Rear while marching
  - Description: To the Rear, MARCH reverses direction on the march; members pivot 180° and maintain file order.
  - Rationale: Execution details and half-step alignment after pivot are described (PDF: p. 3, 7–9, 11, 17–18, 28).
  - Acceptance criteria:
    - Execute on correct foot timing (internal alignment may be approximate).
    - Half-step until distance/cover restored, then resume full step.
  - Notes/assumptions:
    - Orientation and heading are flipped; guide continues to lead in new direction.

- REQ-012 [High] Counter, MARCH (in-place reversal)
  - Description: Counter, MARCH reverses formation direction within its length using prescribed pivot patterns per element.
  - Rationale: Element leader step counts and outcome described (PDF: p. 4, 19).
  - Acceptance criteria:
    - After maneuver, enforce half-step and alignment before resuming full step.
    - End state preserves formation with reversed heading per spec.
  - Notes/assumptions:
    - Animation may simplify micro-steps as long as end state and timing are correct.

- REQ-013 [Med] Interval adjustments while marching
  - Description: Close, MARCH and Extend, MARCH adjust lateral interval between files on the move via diagonal pivots, then half-step to reestablish alignment.
  - Rationale: Procedure and step counts summarized (PDF: p. 2, 17, 20).
  - Acceptance criteria:
    - Non-base files execute in-out diagonal moves as specified.
    - Resume full step after alignment is restored.
  - Notes/assumptions:
    - Base file stands fast during close/extend.

- REQ-014 [High] Interval adjustments at the halt
  - Description: At Close Interval, Dress Right, DRESS (and Ready, FRONT) compacts/returns lateral spacing at the halt.
  - Rationale: Close interval at halt and alignment commands defined (PDF: p. 2, 5–6, 11, 16–17, 25).
  - Acceptance criteria:
    - Change interval state (normal/close) and update positions accordingly.
    - Ready, FRONT returns to attention after alignment.
  - Notes/assumptions:
    - Treat as spacing state change, not formation change.

- REQ-015 [High] Column of Files from Line
  - Description: From line, form a single file using 'Column of Files from the Right/Left, Forward, MARCH'; subsequent elements step off when previous passes.
  - Rationale: Funneling procedure and 40" following distance specified (PDF: p. 4).
  - Acceptance criteria:
    - Right-most (or left-most) element moves first; others stand fast then follow on cue.
    - Maintain 40" cover between the last member of preceding element and the next.
  - Notes/assumptions:
    - Guide moves to lead the first-moving file.

- REQ-016 [Med] Expand from single file to twos/fours
  - Description: From single file at the halt, form column of twos/fours to a specified flank; split column into parallel files and align fronts at normal interval.
  - Rationale: Splitting into multiple files and alignment requirements are described (PDF: p. 1, 4–5, 15, 19, 23).
  - Acceptance criteria:
    - Leader stands fast; designated portion pivots to form new file(s) abreast.
    - End state has files aligned at front with normal interval.
  - Notes/assumptions:
    - Odd counts may produce uneven file sizes; maintain alignment priority.

- REQ-017 [Med] Reform twos ↔ fours
  - Description: From fours to twos (or reverse) using coordinated stand-fast and column-half movements; align fronts on completion.
  - Rationale: Merge/split behavior outlined (PDF: p. 1, 4–5, 15, 19, 23).
  - Acceptance criteria:
    - Moving files insert behind/alongside base files as specified.
    - Ensure front alignment and interval in end state.
  - Notes/assumptions:
    - May be implemented as animated or direct transition.

- REQ-018 [Med] Open/Close Ranks at the halt (line)
  - Description: Open Ranks, MARCH spaces ranks for inspection with specified paces by rank; Close Ranks, MARCH restores 40" distance.
  - Rationale: Rank spacing procedure described (PDF: p. 6, 8, 22).
  - Acceptance criteria:
    - Only valid in line at normal interval while halted.
    - Automatic Dress Right, DRESS at extended distance; Ready, FRONT returns to attention.
  - Notes/assumptions:
    - Support 3- or 4-rank flights with correct paces.

- REQ-019 [Low] Count OFF (optional cosmetic)
  - Description: Count OFF numbers ranks/files for accountability; no state change.
  - Rationale: Count Off usage noted as optional cosmetic feature (PDF: p. 6).
  - Acceptance criteria:
    - If enabled, display/voice numbers in order appropriate to formation.
  - Notes/assumptions:
    - Not required for movement logic.

- REQ-020 [Med] Guide/base side and 'Guide Left' handling
  - Description: Track which flank is base (guide right by default). Support 'Guide Left' and orientation changes that affect guide/base.
  - Rationale: Guide/base rules referenced with flanks/turns and inverted formations (PDF: p. 1–4, 10–11, 14–19, 21, 23–24, 26–29).
  - Acceptance criteria:
    - Dress aligns toward base flank in line; guide at front of base file in column.
    - After about-face or counter-march, guide may appear at rear until repositioned; simulator should correct when halted.
  - Notes/assumptions:
    - Expose guide_position state (Left/Right).

- REQ-021 [High] Error handling & invalid/mistimed commands
  - Description: Ignore or gently warn on invalid or mistimed commands; never guess user intent.
  - Rationale: Spec provides examples and guidance (PDF: p. 7–9, 11, 23).
  - Acceptance criteria:
    - Out-of-context commands do nothing (e.g., Open Ranks while marching).
    - Malformed commands prompt clarification (e.g., 'Left, MARCH' → specify FLANK or FACE).
  - Notes/assumptions:
    - Redundant commands have no effect beyond optional acknowledgement.

- REQ-022 [Med] Flexible input & shorthand
  - Description: Accept reasonable shorthand (e.g., 'Halt' without unit designator) and case-insensitive phrasing.
  - Rationale: Spec calls for tolerant parsing for usability (PDF: p. 4, 7–10, 15–17, 29).
  - Acceptance criteria:
    - Handle commas and pauses equivalently in text/voice input.
    - Allow minor word variants that don’t cause ambiguity.
  - Notes/assumptions:
    - Only one executable command at a time; no queuing.

- REQ-023 [Med] Deterministic execution and reproducibility
  - Description: Simulation produces the same state transitions given identical inputs and initial state.
  - Rationale: State model and command mapping imply deterministic behavior (PDF: p. 6).
  - Acceptance criteria:
    - No hidden randomness in engine; time/cadence injected for determinism.
    - State snapshots before/after each command are comparable in tests.
  - Notes/assumptions:
    - Aligns with testable, pure-logic engine goals.