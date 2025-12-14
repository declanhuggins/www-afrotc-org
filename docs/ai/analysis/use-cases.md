# Use Cases / Scenarios

UC-01: Form a Flight and Step Off
- Actors: Drill Instructor (user), Flight (simulated)
- Preconditions: App loaded at /marching; simulator at default state
- Flow:
  1) User enters: “in 3 elements, FALL IN”
  2) User enters: “Forward, MARCH”
  3) User enters: “HALT”
- Postconditions: Formation in line at normal interval, halted, aligned (REQ-001/002/003/008)
- Exceptions: Forward while already marching → no-op with feedback (REQ-006/021)
- Spec refs: p.1–2, 12–15

UC-02: Facing at the Halt
- Actors: Drill Instructor, Flight
- Preconditions: Motion=halted, heading known
- Flow:
  1) User enters: “Right Face”
  2) User enters: “About Face”
- Postconditions: Heading adjusts +90°, then +180°; motion remains halted (REQ-007)
- Exceptions: Faces while marching → ignored with explanation (REQ-006/021)
- Spec refs: p.7–9

UC-03: Maneuver on the March
- Actors: Drill Instructor, Flight
- Preconditions: Motion=marching
- Flow:
  1) “Right Flank”
  2) “To the Rear, MARCH”
- Postconditions: Heading rotates 90°, then 180° with half-step hint (REQ-010/011)
- Exceptions: Flank at halt → ignored (REQ-006)
- Spec refs: p.17–19, 28

UC-04: Adjust Interval at the Halt
- Actors: Drill Instructor, Flight
- Preconditions: Line formation, motion=halted
- Flow:
  1) “At Close Interval, Dress Right, DRESS”
  2) “Ready, FRONT”
- Postconditions: Interval state toggles to close, then ready (REQ-014)
- Exceptions: Dress while marching → ignored (REQ-006)
- Spec refs: p.5–6, 16–17
