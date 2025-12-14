import { Command, SimulatorState, createInitialState } from "../types";

export interface Scenario {
  name: string;
  initial: SimulatorState;
  script: Command[];
}

export const basicForwardHalt: Scenario = {
  name: 'Basic Forward and Halt',
  initial: createInitialState({ motion: 'halted', headingDeg: 0, composition: { elementCount: 3, rankCount: 4 } }),
  script: [
    { kind: 'FORWARD_MARCH' },
    { kind: 'HALT' },
  ],
};

export const flankAndRear: Scenario = {
  name: 'Flank and To the Rear',
  initial: createInitialState({ motion: 'marching', headingDeg: 90 }),
  script: [
    { kind: 'RIGHT_FLANK' }, // 180
    { kind: 'TO_THE_REAR' }, // 0
  ],
};

export const columnHalf: Scenario = {
  name: 'Column Half Right then Left',
  initial: createInitialState({ motion: 'marching', headingDeg: 0 }),
  script: [
    { kind: 'COLUMN_HALF_RIGHT' }, // 45
    { kind: 'COLUMN_HALF_LEFT' }, // 0
  ],
};

export const fallInElements: Scenario = {
  name: 'Fall In with 4 elements',
  initial: createInitialState({ motion: 'marching', formationType: 'column' }),
  script: [
    { kind: 'FALL_IN', params: { elements: 4 } },
  ],
};

export const scenarios: Scenario[] = [basicForwardHalt, flankAndRear, columnHalf, fallInElements];
