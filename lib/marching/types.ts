// Core domain types for the Marching Simulator engine. Pure TypeScript; no React/DOM/Node APIs.

export type FormationType = 'line' | 'column' | 'inverted-line' | 'inverted-column';
export type Interval = 'normal' | 'close';
export type Motion = 'halted' | 'marching';
export type GuideSide = 'left' | 'right';

export interface SpacingInches {
  coverIn: number; // front-to-back distance
  intervalNormalIn: number; // lateral normal
  intervalCloseIn: number; // lateral close
}

// Flight composition per DAFPAM 34-1203
// - element: a subdivision of a flight (typically a file/column)
// - rank: a line of individuals abreast (front to back depth)
export interface FlightComposition {
  elementCount: number; // typical 2–4; allow 1 for single-file
  rankCount: number; // ranks (depth) per element
}

export interface StateMetadata {
  scenarioName?: string;
  notes?: string;
}

export interface SimulatorState {
  formationType: FormationType;
  interval: Interval;
  headingDeg: number; // 0..359
  motion: Motion;
  guideSide: GuideSide;
  composition: FlightComposition;
  cadenceSpm: number; // steps per minute
  stepLenIn: number; // inches per step
  spacing: SpacingInches;
  metadata?: StateMetadata;
}

export type CommandKind =
  | 'FALL_IN'
  | 'ROTATE_FALL_IN'
  | 'FORWARD_MARCH'
  | 'HALT'
  | 'LEFT_FACE'
  | 'RIGHT_FACE'
  | 'ABOUT_FACE'
  | 'RIGHT_FLANK'
  | 'LEFT_FLANK'
  | 'TO_THE_REAR'
  | 'COLUMN_RIGHT'
  | 'COLUMN_LEFT'
  | 'COLUMN_HALF_RIGHT'
  | 'COLUMN_HALF_LEFT'
  | 'COUNTER_MARCH'
  | 'GUIDE_LEFT'
  | 'GUIDE_RIGHT'
  | 'AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS'
  | 'READY_FRONT'
  | 'OPEN_RANKS'
  | 'CLOSE_RANKS'
  | 'NO_OP';

export interface Command {
  kind: CommandKind;
  params?: {
    elements?: number; // for FALL_IN: set the number of elements
  };
}

export interface Effects {
  animationHints?: {
    useHalfStep?: boolean;
    snapAlignOnHalt?: boolean;
  };
}

export interface ReduceResult {
  next: SimulatorState;
  effects?: Effects;
  error?: string; // present if command rejected or no-op
}

export const DEFAULT_SPACING: SpacingInches = {
  coverIn: 30,
  intervalNormalIn: 35,
  intervalCloseIn: 4,
};

export const DEFAULT_CADENCE_SPM = 110; // within 100-120 range
export const DEFAULT_STEP_LEN_IN = 24;

export function normalizeHeading(deg: number): number {
  let d = Math.round(deg) % 360;
  if (d < 0) d += 360;
  return d;
}

export function createInitialState(partial?: Partial<SimulatorState>): SimulatorState {
  const base: SimulatorState = {
    formationType: 'line',
    interval: 'normal',
    headingDeg: 0,
    motion: 'halted',
    guideSide: 'left',
    composition: { elementCount: 3, rankCount: 4 },
    cadenceSpm: DEFAULT_CADENCE_SPM,
    stepLenIn: DEFAULT_STEP_LEN_IN,
    spacing: DEFAULT_SPACING,
    metadata: undefined,
  };
  const merged = { ...base, ...partial } as SimulatorState;
  merged.headingDeg = normalizeHeading(merged.headingDeg);
  return merged;
}

// Cadet-level simulation types (pure data; used by geometry/orchestrator)
export type CadetRole = 'cadet' | 'guide' | 'guidon-bearer';

export interface Cadet {
  id: string;
  role: CadetRole;
  rank: number;
  file: number;
  headingDeg: number;
  x: number; // inches, world coords
  y: number; // inches, world coords
}
