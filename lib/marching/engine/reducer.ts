import { Command, ReduceResult, SimulatorState, normalizeHeading } from "../types";

function noOp(state: SimulatorState, reason?: string): ReduceResult {
  return { next: state, error: reason };
}

function requireHalted(state: SimulatorState): string | null {
  return state.motion === 'halted' ? null : 'Command only valid at the halt';
}

function requireMarching(state: SimulatorState): string | null {
  return state.motion === 'marching' ? null : 'Command only valid while marching';
}

export function reduce(state: SimulatorState, command: Command): ReduceResult {
  const s = { ...state };
  switch (command.kind) {
    case 'FALL_IN': {
      // Form the flight in line at normal interval with specified element count.
      s.formationType = 'line';
      s.motion = 'halted';
      s.interval = 'normal';
      s.guideSide = 'left';
      s.headingDeg = 0;
      if (command.params?.elements != null) {
        const e = Math.max(1, Math.min(4, Math.floor(command.params.elements)));
        s.composition = { ...s.composition, elementCount: e };
      }
      return { next: s };
    }
    case 'ROTATE_FALL_IN': {
      const err = requireHalted(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 90);
      return { next: s };
    }
    case 'NO_OP':
      return noOp(s, 'No operation');

    case 'FORWARD_MARCH': {
      if (s.motion === 'marching') return noOp(s, 'Already marching');
      s.motion = 'marching';
      return { next: s, effects: { animationHints: { useHalfStep: false } } };
    }

    case 'HALT': {
      if (s.motion === 'halted') return noOp(s, 'Already halted');
      s.motion = 'halted';
      return { next: s, effects: { animationHints: { snapAlignOnHalt: true } } };
    }

    case 'LEFT_FACE': {
      const err = requireHalted(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg - 90);
      if (s.formationType === 'line') s.formationType = 'inverted-column';
      else if (s.formationType === 'column') s.formationType = 'line';
      else if (s.formationType === 'inverted-column') s.formationType = 'inverted-line';
      else if (s.formationType === 'inverted-line') s.formationType = 'column';
      return { next: s };
    }

    case 'RIGHT_FACE': {
      const err = requireHalted(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 90);
      if (s.formationType === 'line') s.formationType = 'column';
      else if (s.formationType === 'column') s.formationType = 'inverted-line';
      else if (s.formationType === 'inverted-column') s.formationType = 'line';
      else if (s.formationType === 'inverted-line') s.formationType = 'inverted-column';
      return { next: s };
    }

    case 'ABOUT_FACE': {
      const err = requireHalted(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 180);
      if (s.formationType === 'line') s.formationType = 'inverted-line';
      else if (s.formationType === 'inverted-line') s.formationType = 'line';
      else if (s.formationType === 'column') s.formationType = 'inverted-column';
      else if (s.formationType === 'inverted-column') s.formationType = 'column';
      return { next: s };
    }

    case 'RIGHT_FLANK': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 90);
      return { next: s };
    }

    case 'LEFT_FLANK': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg - 90);
      return { next: s };
    }

    case 'TO_THE_REAR': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 180);
      return { next: s, effects: { animationHints: { useHalfStep: true } } };
    }

    case 'COLUMN_RIGHT': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 90);
      return { next: s, effects: { animationHints: { useHalfStep: true } } };
    }

    case 'COLUMN_LEFT': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg - 90);
      return { next: s, effects: { animationHints: { useHalfStep: true } } };
    }

    case 'COLUMN_HALF_RIGHT': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg + 45);
      return { next: s, effects: { animationHints: { useHalfStep: true } } };
    }

    case 'COLUMN_HALF_LEFT': {
      const err = requireMarching(s);
      if (err) return noOp(s, err);
      s.headingDeg = normalizeHeading(s.headingDeg - 45);
      return { next: s, effects: { animationHints: { useHalfStep: true } } };
    }

    case 'COUNTER_MARCH': {
      // Typically while marching, but we allow at halt to flip heading for now
      s.headingDeg = normalizeHeading(s.headingDeg + 180);
      return { next: s, effects: { animationHints: { useHalfStep: true } } };
    }

    case 'GUIDE_LEFT': {
      s.guideSide = 'left';
      return { next: s };
    }

    case 'GUIDE_RIGHT': {
      s.guideSide = 'right';
      return { next: s };
    }

    case 'AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS': {
      const err = requireHalted(s);
      if (err) return noOp(s, err);
      s.interval = 'close';
      return { next: s };
    }

    case 'READY_FRONT': {
      // No state change required in the core model; kept for completeness
      return { next: s };
    }

    case 'OPEN_RANKS': {
      if (s.formationType !== 'line' || s.motion !== 'halted') {
        return noOp(s, 'Open Ranks valid only in halted line');
      }
      // Detailed rank spacing is represented in geometry; placeholder no-op
      return { next: s };
    }

    case 'CLOSE_RANKS': {
      if (s.formationType !== 'line' || s.motion !== 'halted') {
        return noOp(s, 'Close Ranks valid only in halted line');
      }
      return { next: s };
    }

    default:
      return noOp(s, 'Unknown command');
  }
}
