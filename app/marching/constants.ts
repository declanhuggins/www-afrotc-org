// Constants and command definitions extracted from commandLogic

export type AtomicCommandType = 'preparatory' | 'execution' | 'other';

export const ATOMIC_COMMANDS = [
  'FORWARD', 'HALF STEPS', 'LEFT', 'RIGHT', 'ABOUT',
  'COLUMN LEFT', 'COLUMN RIGHT', 'FLIGHT', 'FACE',
  'MARCH', 'HALT', 'FALL-IN', 'AS YOU WERE', 'ROTATE FALL-IN'
] as const;
export type AtomicCommand = typeof ATOMIC_COMMANDS[number];

export interface AtomicCommandDef {
  command: AtomicCommand;
  type: AtomicCommandType;
}

export const ATOMIC_COMMAND_DEFS: Record<AtomicCommand, AtomicCommandDef> = {
  'FORWARD': { command: 'FORWARD', type: 'preparatory' },
  'HALF STEPS': { command: 'HALF STEPS', type: 'preparatory' },
  'LEFT': { command: 'LEFT', type: 'preparatory' },
  'RIGHT': { command: 'RIGHT', type: 'preparatory' },
  'ABOUT': { command: 'ABOUT', type: 'preparatory' },
  'COLUMN LEFT': { command: 'COLUMN LEFT', type: 'preparatory' },
  'COLUMN RIGHT': { command: 'COLUMN RIGHT', type: 'preparatory' },
  'FLIGHT': { command: 'FLIGHT', type: 'preparatory' },
  'FACE': { command: 'FACE', type: 'execution' },
  'MARCH': { command: 'MARCH', type: 'execution' },
  'HALT': { command: 'HALT', type: 'execution' },
  'FALL-IN': { command: 'FALL-IN', type: 'execution' },
  'AS YOU WERE': { command: 'AS YOU WERE', type: 'other' },
  'ROTATE FALL-IN': { command: 'ROTATE FALL-IN', type: 'other' },
};

export const UI_TO_ATOMIC: Record<string, AtomicCommand[]> = {
  'FORWARD MARCH': ['FORWARD', 'MARCH'],
  'LEFT FACE': ['LEFT', 'FACE'],
  'RIGHT FACE': ['RIGHT', 'FACE'],
  'ABOUT FACE': ['ABOUT', 'FACE'],
  'COLUMN LEFT': ['COLUMN LEFT', 'MARCH'],
  'COLUMN RIGHT': ['COLUMN RIGHT', 'MARCH'],
  'FLIGHT HALT': ['FLIGHT', 'HALT'],
  'HALF STEPS': ['HALF STEPS', 'MARCH'],
  'FALL-IN': ['FLIGHT', 'FALL-IN'],
  'AS YOU WERE': ['AS YOU WERE'],
  'ROTATE FALL-IN': ['ROTATE FALL-IN'],
};

export const VALID_PREP_EXEC_PAIRS = new Set(
  Object.values(UI_TO_ATOMIC)
    .filter(arr => arr.length === 2)
    .map(([prep, exec]) => `${prep}|${exec}`)
);

export const SCORABLE_COMMANDS: Array<[AtomicCommand, AtomicCommand]> = [
  ['FORWARD', 'MARCH'],
  ['LEFT', 'FACE'],
  ['RIGHT', 'FACE'],
  ['ABOUT', 'FACE'],
  ['COLUMN LEFT', 'MARCH'],
  ['COLUMN RIGHT', 'MARCH'],
  ['FLIGHT', 'HALT'],
  ['HALF STEPS', 'MARCH'],
];

export const COMMANDS = [
  { key: 'w', label: 'FORWARD MARCH' },
  { key: 'a', label: 'LEFT FACE' },
  { key: 'd', label: 'RIGHT FACE' },
  { key: 's', label: 'ABOUT FACE' },
  { key: 'q', label: 'COLUMN LEFT' },
  { key: 'e', label: 'COLUMN RIGHT' },
  { key: ' ', label: 'FLIGHT HALT' },
  { key: 'h', label: 'HALF STEPS' },
  { key: 'f', label: 'FALL-IN' },
  { key: 'r', label: 'ROTATE FALL-IN' },
  { key: 'Esc', label: 'AS YOU WERE' },
];

export const KEY_TO_COMMAND_LABEL: Record<string, string> = COMMANDS.reduce(
  (acc, c) => {
    acc[c.key.toLowerCase()] = c.label;
    return acc;
  },
  {} as Record<string, string>
);
