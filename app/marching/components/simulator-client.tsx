'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  DEFAULT_SPACING,
  createInitialState,
  reduce,
  type Command,
  type SimulatorState,
  computeCadetPositions,
  normalizeHeading,
} from '../../../lib/marching';
import { parseCommand } from '../../../lib/marching';
import { orchestrator } from '../../../lib/marching';

interface SetupConfig {
  simulator: string;
  cadetCount: number;
  elements: number;
  interval: number;
  cover: number;
  areaFeet: number;
}

interface CommandDescriptor {
  label: string;
  preparatory: string;
  execution: string;
}

type CommandSource = 'button' | 'keyboard' | 'input';

type CommandLogEntry = CommandDescriptor & {
  id: number;
  timestamp: number;
  source: CommandSource;
  raw?: string;
};

interface CalloutEvent {
  id: number;
  beat: number;
  label: string | null;
  phase?: 'preparatory' | 'execution' | 'other';
  speak?: boolean;
  command?: Command;
  source?: CommandSource;
  raw?: string;
}

const DEFAULT_SETUP: SetupConfig = {
  simulator: 'Marching Simulator',
  cadetCount: 13,
  elements: 3,
  interval: 35,
  cover: 30,
  areaFeet: 25,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createStateFromSetup(setup: SetupConfig): SimulatorState {
  const elements = clamp(Math.floor(setup.elements) || 1, 1, 10);
  const cadets = clamp(Math.floor(setup.cadetCount) || 1, 1, 22);
  const rankCount = Math.max(1, 1 + Math.ceil(Math.max(0, cadets - 1) / elements));
  const cover = Math.max(1, setup.cover || DEFAULT_SPACING.coverIn);
  const interval = Math.max(1, setup.interval || DEFAULT_SPACING.intervalNormalIn);

  return createInitialState({
    formationType: 'line',
    motion: 'halted',
    interval: 'normal',
    headingDeg: 0,
    composition: { elementCount: elements, rankCount },
    spacing: {
      ...DEFAULT_SPACING,
      coverIn: cover,
      intervalNormalIn: interval,
    },
  });
}

const COMMAND_METADATA: Partial<Record<Command['kind'], CommandDescriptor>> = {
  FALL_IN: { label: 'FALL-IN', preparatory: 'Flight', execution: 'FALL IN' },
  ROTATE_FALL_IN: { label: 'ROTATE FALL-IN', preparatory: 'Flight', execution: 'ROTATE' },
  FORWARD_MARCH: { label: 'FORWARD MARCH', preparatory: 'Forward', execution: 'MARCH' },
  HALT: { label: 'HALT', preparatory: 'Flight', execution: 'HALT' },
  LEFT_FACE: { label: 'LEFT FACE', preparatory: 'Left', execution: 'FACE' },
  RIGHT_FACE: { label: 'RIGHT FACE', preparatory: 'Right', execution: 'FACE' },
  ABOUT_FACE: { label: 'ABOUT FACE', preparatory: 'About', execution: 'FACE' },
  LEFT_FLANK: { label: 'LEFT FLANK', preparatory: 'Left Flank', execution: 'MARCH' },
  RIGHT_FLANK: { label: 'RIGHT FLANK', preparatory: 'Right Flank', execution: 'MARCH' },
  TO_THE_REAR: { label: 'TO THE REAR', preparatory: 'To the Rear', execution: 'MARCH' },
  COLUMN_RIGHT: { label: 'COLUMN RIGHT', preparatory: 'Column Right', execution: 'MARCH' },
  COLUMN_LEFT: { label: 'COLUMN LEFT', preparatory: 'Column Left', execution: 'MARCH' },
  COLUMN_HALF_RIGHT: { label: 'COLUMN HALF RIGHT', preparatory: 'Column Half Right', execution: 'MARCH' },
  COLUMN_HALF_LEFT: { label: 'COLUMN HALF LEFT', preparatory: 'Column Half Left', execution: 'MARCH' },
  COUNTER_MARCH: { label: 'COUNTER MARCH', preparatory: 'Counter', execution: 'MARCH' },
  GUIDE_LEFT: { label: 'GUIDE LEFT', preparatory: 'Guide', execution: 'LEFT' },
  GUIDE_RIGHT: { label: 'GUIDE RIGHT', preparatory: 'Guide', execution: 'RIGHT' },
  AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS: {
    label: 'AT CLOSE INTERVAL, DRESS RIGHT, DRESS',
    preparatory: 'At Close Interval, Dress Right',
    execution: 'DRESS',
  },
  READY_FRONT: { label: 'READY, FRONT', preparatory: 'Ready', execution: 'FRONT' },
  OPEN_RANKS: { label: 'OPEN RANKS', preparatory: 'Open Ranks', execution: 'MARCH' },
  CLOSE_RANKS: { label: 'CLOSE RANKS', preparatory: 'Close Ranks', execution: 'MARCH' },
};

const QUICK_COMMANDS: Array<{
  id: string;
  label: string;
  command: Command;
  source: CommandSource;
  hotkey?: string;
}> = [
  { id: 'forward', label: 'FORWARD, MARCH', command: { kind: 'FORWARD_MARCH' }, source: 'button', hotkey: 'W' },
  { id: 'left-face', label: 'LEFT FACE', command: { kind: 'LEFT_FACE' }, source: 'button', hotkey: 'A' },
  { id: 'right-face', label: 'RIGHT FACE', command: { kind: 'RIGHT_FACE' }, source: 'button', hotkey: 'D' },
  { id: 'about', label: 'ABOUT FACE', command: { kind: 'ABOUT_FACE' }, source: 'button', hotkey: 'S' },
  { id: 'halt', label: 'HALT', command: { kind: 'HALT' }, source: 'button', hotkey: 'SPACE' },
  { id: 'left-flank', label: 'LEFT FLANK', command: { kind: 'LEFT_FLANK' }, source: 'button', hotkey: 'Q' },
  { id: 'right-flank', label: 'RIGHT FLANK', command: { kind: 'RIGHT_FLANK' }, source: 'button', hotkey: 'E' },
  { id: 'column-left', label: 'COLUMN LEFT', command: { kind: 'COLUMN_LEFT' }, source: 'button', hotkey: 'Shift+Q' },
  { id: 'column-right', label: 'COLUMN RIGHT', command: { kind: 'COLUMN_RIGHT' }, source: 'button', hotkey: 'Shift+E' },
  { id: 'to-the-rear', label: 'TO THE REAR', command: { kind: 'TO_THE_REAR' }, source: 'button', hotkey: 'Shift+S' },
  { id: 'column-half-left', label: 'COLUMN HALF LEFT', command: { kind: 'COLUMN_HALF_LEFT' }, source: 'button' },
  { id: 'column-half-right', label: 'COLUMN HALF RIGHT', command: { kind: 'COLUMN_HALF_RIGHT' }, source: 'button' },
  { id: 'counter-march', label: 'COUNTER MARCH', command: { kind: 'COUNTER_MARCH' }, source: 'button' },
  { id: 'guide-left', label: 'GUIDE LEFT', command: { kind: 'GUIDE_LEFT' }, source: 'button' },
  { id: 'guide-right', label: 'GUIDE RIGHT', command: { kind: 'GUIDE_RIGHT' }, source: 'button' },
  { id: 'dress-right', label: 'AT CLOSE INTERVAL, DRESS RIGHT, DRESS', command: { kind: 'AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS' }, source: 'button' },
  { id: 'ready-front', label: 'READY, FRONT', command: { kind: 'READY_FRONT' }, source: 'button' },
  { id: 'open-ranks', label: 'OPEN RANKS', command: { kind: 'OPEN_RANKS' }, source: 'button' },
  { id: 'close-ranks', label: 'CLOSE RANKS', command: { kind: 'CLOSE_RANKS' }, source: 'button' },
  { id: 'fall-in', label: 'FALL-IN', command: { kind: 'FALL_IN' }, source: 'button', hotkey: 'F' },
  { id: 'rotate-fall-in', label: 'ROTATE FALL-IN', command: { kind: 'ROTATE_FALL_IN' }, source: 'button', hotkey: 'R' },
];

const KEY_COMMANDS: Record<string, Command> = {
  w: { kind: 'FORWARD_MARCH' },
  s: { kind: 'ABOUT_FACE' },
  a: { kind: 'LEFT_FACE' },
  d: { kind: 'RIGHT_FACE' },
  q: { kind: 'LEFT_FLANK' },
  e: { kind: 'RIGHT_FLANK' },
  'shift+q': { kind: 'COLUMN_LEFT' },
  'shift+e': { kind: 'COLUMN_RIGHT' },
  'shift+s': { kind: 'TO_THE_REAR' },
  f: { kind: 'FALL_IN' },
  r: { kind: 'ROTATE_FALL_IN' },
  ' ': { kind: 'HALT' },
  spacebar: { kind: 'HALT' },
};

const EMPTY_DESCRIPTOR: CommandDescriptor = {
  label: 'None',
  preparatory: 'None',
  execution: 'None',
};

const CADENCE_COMMANDS = new Set<Command['kind']>([
  'FORWARD_MARCH',
  'HALT',
  'LEFT_FACE',
  'RIGHT_FACE',
  'ABOUT_FACE',
  'LEFT_FLANK',
  'RIGHT_FLANK',
  'TO_THE_REAR',
  'COLUMN_RIGHT',
  'COLUMN_LEFT',
  'COLUMN_HALF_RIGHT',
  'COLUMN_HALF_LEFT',
  'COUNTER_MARCH',
]);

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const preferredNames = ['Google US English', 'Google UK English Female', 'Samantha', 'Alex'];
  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find(v => preferredNames.some(name => v.name.includes(name))) ??
    voices.find(v => v.lang.startsWith('en')) ??
    voices[0] ??
    null;
  return cachedVoice;
}

interface PlacementState {
  active: boolean;
  headingDeg: number;
  anchor: { x: number; y: number } | null;
}

const layoutHeadingFromPlacement = (placementHeading: number) => normalizeHeading(-placementHeading);

function lightenColor(hex: string, factor: number): string {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
  let r: number;
  let g: number;
  let b: number;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    r = parseInt(hex.charAt(1).repeat(2), 16);
    g = parseInt(hex.charAt(2).repeat(2), 16);
    b = parseInt(hex.charAt(3).repeat(2), 16);
  }
  const mix = (component: number) =>
    Math.max(0, Math.min(255, Math.round(component + (255 - component) * factor)));
  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

function describeCommand(command: Command): CommandDescriptor {
  const meta = COMMAND_METADATA[command.kind];
  if (meta) return meta;
  const label = command.kind
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_, space, letter) => `${space}${letter.toUpperCase()}`);
  return {
    label,
    preparatory: label,
    execution: 'EXECUTE',
  };
}

type SpeechPhase = 'preparatory' | 'execution' | 'other';

function speakWord(
  word: string,
  options?: { phase?: SpeechPhase; cancel?: boolean; pitch?: number; volume?: number; rate?: number }
) {
  if (!word || typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (options?.cancel) synth.cancel();
  const utter = new SpeechSynthesisUtterance(word);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  const phase = options?.phase ?? 'other';
  const pitch = options?.pitch ?? 1.0;
  const volume = options?.volume ?? 1.0;
  utter.rate = options?.rate ?? (phase === 'execution' ? 1.0 : 0.92);
  utter.pitch = pitch;
  utter.volume = volume;
  synth.speak(utter);
}

function sayExecutionWord(word: string) {
  const normalized = word.toUpperCase();
  if (normalized === 'MARCH') return 'HARCH';
  if (normalized === 'FACE') return 'HAYCE';
  return word;
}

function sayFallInExecution() {
  speakWord('Fall', { phase: 'execution', cancel: true, pitch: 1.1, volume: 1.0 });
  speakWord('in', { phase: 'execution', pitch: 0.9, volume: 1.0 });
}

function sayPreparatory(word: string, cancel?: boolean) {
  speakWord(word, { phase: 'preparatory', cancel });
}

function speakCommandWord(word: string, phase: SpeechPhase, options?: { cancel?: boolean }) {
  const spoken = phase === 'execution' ? sayExecutionWord(word) : word;
  speakWord(spoken, { phase, cancel: options?.cancel });
}

function getFallInPreparatory(cadetCount: number): string {
  return cadetCount >= 5 ? 'Flight' : 'Detail';
}

function sayFallInSequence(preparatory: string, beatMs: number) {
  const interval = Number.isFinite(beatMs) && beatMs > 0 ? beatMs : 600;
  window.setTimeout(() => {
    speakWord(preparatory, { phase: 'preparatory', cancel: true });
  }, 0);
  window.setTimeout(() => {
    speakWord('Fall', { phase: 'execution', rate: 0.85, pitch: 1.0, volume: 1.0 });
  }, interval * 2);
  window.setTimeout(() => {
    speakWord('in', { phase: 'execution', pitch: 1.0, volume: 1.0 });
  }, interval * 3);
}

function getDescriptor(command: Command, cadetCount: number): CommandDescriptor {
  const base = describeCommand(command);
  if (command.kind === 'FALL_IN' || command.kind === 'ROTATE_FALL_IN') {
    return {
      ...base,
      preparatory: getFallInPreparatory(cadetCount),
    };
  }
  return base;
}

function drawCadet(
  ctx: CanvasRenderingContext2D,
  cadet: orchestrator.OrchestratorCadet,
  scale: number,
  color: string,
  isGuidon: boolean
) {
  const x = cadet.x * scale;
  const y = -cadet.y * scale;
  const headingRad = (cadet.headingDeg * Math.PI) / 180;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(headingRad);

  const cadetWidthIn = 24; // shoulder width ~2 ft
  const cadetLengthIn = 12; // body depth ~1 ft
  const headDiameterIn = 8;

  const bodyWidth = Math.max(cadetWidthIn * scale, 12);
  const bodyHeight = Math.max(cadetLengthIn * scale, bodyWidth * (cadetLengthIn / cadetWidthIn));
  const headRadius = Math.max((headDiameterIn / 2) * scale, bodyWidth * 0.18);

  ctx.fillStyle = color;
  ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);

  ctx.fillStyle = lightenColor(color, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
  ctx.fill();

  const hatBaseWidth = Math.max(headRadius * 2, cadetWidthIn * scale * 0.4);
  const hatTopWidth = hatBaseWidth * (2 / 3);
  const hatHeight = hatBaseWidth * (3 / 4);
  const baseHalfWidth = hatBaseWidth / 2;
  const topHalfWidth = hatTopWidth / 2;
  const baseY = 0;
  const tipY = baseY - hatHeight;

  ctx.fillStyle = lightenColor(color, 0.55);
  ctx.beginPath();
  ctx.moveTo(-baseHalfWidth, baseY);
  ctx.lineTo(baseHalfWidth, baseY);
  ctx.lineTo(topHalfWidth, tipY);
  ctx.lineTo(-topHalfWidth, tipY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = lightenColor(color, 0.65);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);

  if (isGuidon) {
    ctx.fillStyle = '#1d4ed8';
    const flagStartX = bodyWidth / 2;
    const flagStartY = -bodyHeight / 2;
    ctx.beginPath();
    ctx.moveTo(flagStartX, flagStartY);
    ctx.lineTo(flagStartX + 12, flagStartY - 6);
    ctx.lineTo(flagStartX, flagStartY - 14);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export default function SimulatorClient(): React.JSX.Element {
  const [setup, setSetup] = useState<SetupConfig>(() => ({ ...DEFAULT_SETUP }));
  const [state, setState] = useState<SimulatorState>(() => createStateFromSetup(DEFAULT_SETUP));
  const [simulation, setSimulation] = useState(() =>
    orchestrator.createSimulation(createStateFromSetup(DEFAULT_SETUP), {
      cadetCount: DEFAULT_SETUP.cadetCount,
    })
  );
  const [commandInput, setCommandInput] = useState('');
  const [commandStatus, setCommandStatus] = useState<CommandDescriptor>(EMPTY_DESCRIPTOR);
  const [history, setHistory] = useState<CommandLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [visualSize, setVisualSize] = useState<number>(() => 480);
  const [placement, setPlacement] = useState<PlacementState>({ active: false, headingDeg: 0, anchor: null });
  const [showSetup, setShowSetup] = useState(false);
  const [calloutQueue, setCalloutQueue] = useState<CalloutEvent[]>([]);
  const [currentCallout, setCurrentCallout] = useState<CalloutEvent | null>(null);
  const [beatClockOn, setBeatClockOn] = useState<boolean>(false);
  const [beatProgressMs, setBeatProgressMs] = useState(0);

  const commandId = useRef(0);
  const calloutId = useRef(0);
  const beatCounterRef = useRef(0);
  const lastQueuedBeatRef = useRef(0);
  const calloutQueueRef = useRef<CalloutEvent[]>([]);
  const beatAccumulatorRef = useRef(0);
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const areaInches = useMemo(() => Math.max(10, setup.areaFeet * 12), [setup.areaFeet]);
  const halfArea = areaInches / 2;
  const haltedIdle = useMemo(
    () => state.motion === 'halted' && simulation.cadets.every(cadet => cadet.actionQueue.length === 0),
    [state.motion, simulation.cadets]
  );
  const fallInBaseState = useMemo(() => reduce(state, { kind: 'FALL_IN' }).next, [state]);
  const beatIntervalMs = useMemo(() => 60000 / Math.max(10, state.cadenceSpm || 0), [state.cadenceSpm]);
  const nextBeatMs = useMemo(() => {
    const accumulator = beatClockOn ? beatProgressMs : simulation.accumulatorMs;
    return Math.max(0, Math.round(beatIntervalMs - accumulator));
  }, [beatIntervalMs, beatClockOn, beatProgressMs, simulation.accumulatorMs]);
  const nextBeatLabel = useMemo(() => nextBeatMs.toString().padStart(4, '0'), [nextBeatMs]);
  const nextFoot = useMemo(() => (simulation.stepCount % 2 === 0 ? 'Left' : 'Right'), [simulation.stepCount]);
  const plantedFoot = useMemo(() => (nextFoot === 'Left' ? 'Right' : 'Left'), [nextFoot]);
  const nextFootLabel = useMemo(() => nextFoot.padStart(5, ' '), [nextFoot]);
  const leftFootLabel = useMemo(() => 'Left'.padStart(5, ' '), []);
  const rightFootLabel = useMemo(() => 'Right'.padStart(5, ' '), []);
  const beatProgress = useMemo(() => {
    if (!Number.isFinite(beatIntervalMs) || beatIntervalMs <= 0) return 0;
    const progress = 1 - nextBeatMs / beatIntervalMs;
    return clamp(progress, 0, 1);
  }, [beatIntervalMs, nextBeatMs]);
  const showBeat = useMemo(() => !haltedIdle || beatClockOn, [beatClockOn, haltedIdle]);
  const layoutHeading = useMemo(
    () => layoutHeadingFromPlacement(placement.headingDeg),
    [placement.headingDeg]
  );
  const previewState = useMemo(
    () => ({ ...fallInBaseState, headingDeg: layoutHeading }),
    [fallInBaseState, layoutHeading]
  );
  const scale = useMemo(() => {
    const areaSidePx = visualSize / 1.5;
    return areaSidePx / areaInches;
  }, [visualSize, areaInches]);
  const ghostCadets = useMemo(() => {
    if (!placement.active) return [];
    const files = Math.max(1, Math.floor(previewState.composition.elementCount));
    const ranksNeeded = Math.max(
      previewState.composition.rankCount,
      1 + Math.ceil(Math.max(0, setup.cadetCount - 1) / files)
    );
    const pts = computeCadetPositions({
      ...previewState,
      composition: { ...previewState.composition, rankCount: ranksNeeded },
    });
    const baseFile = previewState.guideSide === 'right' ? files - 1 : 0;
    const fileOrder = Array.from({ length: files }, (_, file) => file);
    const ordered: typeof pts = [];
    const perRankOrder = (rank: number) => (rank === 0 ? [baseFile] : rank === 1 ? fileOrder : [...fileOrder].reverse());
    for (let rank = 0; rank < ranksNeeded; rank += 1) {
      for (const file of perRankOrder(rank)) {
        const p = pts.find(x => x.rank === rank && x.file === file);
        if (p) ordered.push(p);
        if (ordered.length >= setup.cadetCount) break;
      }
      if (ordered.length >= setup.cadetCount) break;
    }
    const anchor = placement.anchor ?? { x: 0, y: 0 };
    return ordered.slice(0, setup.cadetCount).map((p, idx) => ({
      id: `ghost-${idx}`,
      x: p.x + anchor.x,
      y: p.y + anchor.y,
      headingDeg: placement.headingDeg,
    }));
  }, [placement.active, placement.anchor, previewState, setup.cadetCount, placement.headingDeg]);
  const upcomingCallouts = useMemo(() => calloutQueue.slice(0, 3), [calloutQueue]);

  useEffect(() => {
    const updateSize = () => {
      if (typeof window === 'undefined') return;
      const base = Math.min(window.innerWidth, window.innerHeight) * (2 / 3);
      setVisualSize(Math.max(320, Math.floor(base)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
      cachedVoice = null;
      pickVoice();
    };
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    loadVoices();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const computeGuidonOffset = useCallback(
    (headingDeg: number) => {
      const files = Math.max(1, Math.floor(fallInBaseState.composition.elementCount));
      const ranksNeeded = Math.max(
        fallInBaseState.composition.rankCount,
        1 + Math.ceil(Math.max(0, setup.cadetCount - 1) / files)
      );
      const pts = computeCadetPositions({
        ...fallInBaseState,
        headingDeg,
        composition: { ...fallInBaseState.composition, rankCount: ranksNeeded },
      });
      const guidon = pts.find(p => p.rank === 0 && p.file === 0) ?? pts[0];
      return guidon ? { x: -guidon.x, y: -guidon.y } : { x: 0, y: 0 };
    },
    [fallInBaseState, setup.cadetCount]
  );

  const runCommand = useCallback(
    (command: Command, source: CommandSource, raw?: string) => {
      const descriptor = getDescriptor(command, setup.cadetCount);
      // Voice both preparatory and execution terms for non-cadence commands immediately.
      if (!CADENCE_COMMANDS.has(command.kind)) {
        if (command.kind !== 'ROTATE_FALL_IN' && command.kind !== 'FALL_IN') {
          speakCommandWord(descriptor.preparatory, 'preparatory', { cancel: true });
          speakCommandWord(descriptor.execution, 'execution');
        }
      }
      setState(prevState => {
        const result = reduce(prevState, command);
        if (result.error) {
          setError(result.error);
          return prevState;
        }
        setError(null);

        setSimulation(prevSimulation => {
          const nextSimulation = orchestrator.applyCommandToSimulation(
            prevSimulation,
            prevState,
            result.next,
            command,
            { halfStep: result.effects?.animationHints?.useHalfStep }
          );
          return orchestrator.assignCadetRoles(nextSimulation, result.next);
        });

        commandId.current += 1;
        const entry: CommandLogEntry = {
          id: commandId.current,
          timestamp: Date.now(),
          source,
          raw,
          ...descriptor,
        };
        setCommandStatus(descriptor);
        setHistory(prev => [entry, ...prev].slice(0, 50));

        return result.next;
      });
    },
    [setup.cadetCount]
  );

  const enqueueCadenceCommand = useCallback(
    (command: Command, source: CommandSource, raw?: string) => {
      const descriptor = getDescriptor(command, setup.cadetCount);
      const cadenceStart = !beatClockOn;
      const beatPhase = beatIntervalMs > 0 ? beatAccumulatorRef.current / beatIntervalMs : 0;
      const inFirstHalf = beatPhase <= 0.5;
      let baseBeat = inFirstHalf ? beatCounterRef.current : beatCounterRef.current + 1;
      if (state.motion === 'marching' && (command.kind === 'LEFT_FLANK' || command.kind === 'RIGHT_FLANK' || command.kind === 'TO_THE_REAR')) {
        const requiresRightFoot = command.kind === 'LEFT_FLANK' || command.kind === 'TO_THE_REAR';
        const nextFoot = simulation.stepCount % 2 === 0 ? 'Left' : 'Right';
        const plantedFoot = nextFoot === 'Left' ? 'Right' : 'Left';
        const correctFoot = plantedFoot === (requiresRightFoot ? 'Right' : 'Left');
        if (!correctFoot) {
          baseBeat = beatCounterRef.current + 1;
        }
      }

      const queueBase = Math.max(baseBeat, lastQueuedBeatRef.current);
      const preparatoryBeat = queueBase;
      const executionBeat = queueBase + 2;
      const immediatePreparatory = preparatoryBeat === beatCounterRef.current && (cadenceStart || inFirstHalf);
      if (!beatClockOn) {
        beatCounterRef.current = 0;
        beatAccumulatorRef.current = 0;
        lastQueuedBeatRef.current = executionBeat;
      }

      if (immediatePreparatory) {
        speakCommandWord(descriptor.preparatory, 'preparatory', { cancel: true });
        setCurrentCallout({
          id: ++calloutId.current,
          beat: beatCounterRef.current,
          label: descriptor.preparatory,
          phase: 'preparatory',
          speak: true,
        });
      }

      const events: CalloutEvent[] = [];
      if (!immediatePreparatory) {
        events.push({
          id: ++calloutId.current,
          beat: preparatoryBeat,
          label: descriptor.preparatory,
          phase: 'preparatory',
          speak: true,
        });
      }
      events.push({
        id: ++calloutId.current,
        beat: executionBeat,
        label: descriptor.execution,
        phase: 'execution',
        speak: true,
        command,
        source,
        raw,
      });

      if (command.kind === 'HALT') {
        events.push({
          id: ++calloutId.current,
          beat: executionBeat + 1,
          label: 'Step',
          phase: 'other',
          speak: false,
        });
        events.push({
          id: ++calloutId.current,
          beat: executionBeat + 2,
          label: 'Stop',
          phase: 'other',
          speak: false,
        });
      }

      calloutQueueRef.current = [...calloutQueueRef.current, ...events];
      lastQueuedBeatRef.current = events[events.length - 1]?.beat ?? executionBeat;
      setCalloutQueue(calloutQueueRef.current);
      setBeatClockOn(true);
    },
    [beatClockOn, beatIntervalMs, simulation.stepCount, state.motion, setup.cadetCount]
  );

  const dispatchCommand = useCallback(
    (command: Command, source: CommandSource, raw?: string) => {
      // Intercept FALL IN for placement preview.
      if (command.kind === 'FALL_IN') {
        const baseFallIn = reduce(state, { kind: 'FALL_IN' }).next;
        const layoutHdg = layoutHeadingFromPlacement(baseFallIn.headingDeg);
        const offset = computeGuidonOffset(layoutHdg);
        const pointer = pointerWorldRef.current;
        setPlacement(prev => ({
          active: true,
          headingDeg: baseFallIn.headingDeg,
          anchor: prev.anchor ?? (pointer ? { x: pointer.x + offset.x, y: pointer.y + offset.y } : null),
        }));
        setCommandStatus(getDescriptor(command, setup.cadetCount));
        return;
      }

      if (command.kind === 'ROTATE_FALL_IN' && placement.active) {
        const pointer = pointerWorldRef.current;
        setPlacement(prev => {
          const oldLayout = layoutHeadingFromPlacement(prev.headingDeg);
          const oldOffset = computeGuidonOffset(oldLayout);
          const newHeading = normalizeHeading(prev.headingDeg + 90);
          const newLayout = layoutHeadingFromPlacement(newHeading);
          const newOffset = computeGuidonOffset(newLayout);
          const anchor = pointer
            ? { x: pointer.x + newOffset.x, y: pointer.y + newOffset.y }
            : prev.anchor != null
            ? {
                x: prev.anchor.x + (oldOffset.x - newOffset.x),
                y: prev.anchor.y + (oldOffset.y - newOffset.y),
              }
            : null;
          return {
            ...prev,
            headingDeg: newHeading,
            anchor,
          };
        });
        return;
      }
      if (command.kind === 'ROTATE_FALL_IN' && !placement.active) {
        setError('Rotate Fall-In only works while placing the formation.');
        return;
      }

      if (CADENCE_COMMANDS.has(command.kind)) {
        enqueueCadenceCommand(command, source, raw);
        setCommandStatus(getDescriptor(command, setup.cadetCount));
        return;
      }

      runCommand(command, source, raw);
    },
    [state, placement.active, placement.headingDeg, computeGuidonOffset, enqueueCadenceCommand, runCommand, setup.cadetCount]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = parseCommand(commandInput);
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      dispatchCommand(parsed as Command, 'input', commandInput);
      setCommandInput('');
    },
    [commandInput, dispatchCommand]
  );

  const handleBeat = useCallback(() => {
    beatCounterRef.current += 1;
    const nowBeat = beatCounterRef.current;
    const due = calloutQueueRef.current.filter(evt => evt.beat === nowBeat);
    calloutQueueRef.current = calloutQueueRef.current.filter(evt => evt.beat > nowBeat);
    setCalloutQueue(calloutQueueRef.current);

    if (due.length) {
      due.forEach(evt => {
        if (evt.label) {
          if (evt.speak !== false) {
            speakCommandWord(evt.label, evt.phase ?? 'other');
          }
          setCurrentCallout(evt);
        }
        if (evt.command) {
          runCommand(evt.command, evt.source ?? 'button', evt.raw);
        }
      });
    }

    if (!calloutQueueRef.current.length && haltedIdle) {
      setBeatClockOn(false);
      beatCounterRef.current = 0;
      beatAccumulatorRef.current = 0;
      lastQueuedBeatRef.current = 0;
      setCurrentCallout(null);
      setBeatProgressMs(0);
    }
  }, [haltedIdle, runCommand]);

  const handleSetupChange = useCallback(
    (field: keyof SetupConfig, value: number | string) => {
      setSetup(prev => ({ ...prev, [field]: value } as SetupConfig));
    },
    []
  );

  const handleApplySetup = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const sanitized: SetupConfig = {
        simulator: setup.simulator || DEFAULT_SETUP.simulator,
        cadetCount: clamp(Number(setup.cadetCount) || DEFAULT_SETUP.cadetCount, 1, 22),
        elements: clamp(Number(setup.elements) || DEFAULT_SETUP.elements, 1, 10),
        interval: clamp(Number(setup.interval) || DEFAULT_SETUP.interval, 4, 120),
        cover: clamp(Number(setup.cover) || DEFAULT_SETUP.cover, 10, 120),
        areaFeet: clamp(Number(setup.areaFeet) || DEFAULT_SETUP.areaFeet, 10, 200),
      };
      setSetup(sanitized);
      const nextState = createStateFromSetup(sanitized);
      setState(nextState);
      setSimulation(
        orchestrator.createSimulation(nextState, { cadetCount: sanitized.cadetCount })
      );
      setHistory([]);
      setCommandStatus(EMPTY_DESCRIPTOR);
      setError(null);
    },
    [setup]
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas || !scale) return null;
      const rect = canvas.getBoundingClientRect();
      const pxX = clientX - rect.left - visualSize / 2;
      const pxY = clientY - rect.top - visualSize / 2;
      return { x: pxX / scale, y: -(pxY / scale) };
    },
    [scale, visualSize]
  );

  const placeFlightAt = useCallback(
    (anchor: { x: number; y: number }) => {
      if (!placement.active) return;
      const { next } = reduce(state, { kind: 'FALL_IN' });
      const placedState = { ...next, headingDeg: placement.headingDeg };
      const layoutHeading = layoutHeadingFromPlacement(placement.headingDeg);
      const baseSim = orchestrator.createSimulation(
        { ...placedState, headingDeg: layoutHeading },
        { cadetCount: setup.cadetCount }
      );
      const shiftedCadets = baseSim.cadets.map(cadet => ({
        ...cadet,
        x: cadet.x + anchor.x,
        y: cadet.y + anchor.y,
        headingDeg: placement.headingDeg,
        actionQueue: [],
      }));
      setState(placedState);
      const simWithRoles = orchestrator.assignCadetRoles({ ...baseSim, cadets: shiftedCadets }, placedState);
      setSimulation(simWithRoles);
      const descriptor = getDescriptor({ kind: 'FALL_IN' } as Command, setup.cadetCount);
      commandId.current += 1;
      const entry: CommandLogEntry = {
        id: commandId.current,
        timestamp: Date.now(),
        source: 'button',
        raw: 'FALL IN (placed)',
        ...descriptor,
      };
      setHistory(prev => [entry, ...prev].slice(0, 50));
      setCommandStatus(descriptor);
      setPlacement({ active: false, headingDeg: 0, anchor: null });
      sayFallInSequence(getFallInPreparatory(setup.cadetCount), beatIntervalMs);
    },
    [placement.active, placement.headingDeg, setup.cadetCount, state, beatIntervalMs]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event.target as HTMLElement | null)?.tagName?.toLowerCase() === 'input') {
        return;
      }
      const key = event.key.toLowerCase();
      const combo = event.shiftKey ? `shift+${key}` : key;
      const command = KEY_COMMANDS[combo] ?? KEY_COMMANDS[key];
      if (!command) return;
      event.preventDefault();
      dispatchCommand(command, 'keyboard');
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatchCommand]);

  useEffect(() => {
    if (!beatClockOn || beatIntervalMs <= 0) return;
    beatAccumulatorRef.current = 0;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      beatAccumulatorRef.current += dt;
      while (beatAccumulatorRef.current >= beatIntervalMs) {
        beatAccumulatorRef.current -= beatIntervalMs;
        handleBeat();
      }
      setBeatProgressMs(beatAccumulatorRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [beatClockOn, beatIntervalMs, handleBeat]);

  useEffect(() => {
    setSimulation(prev => orchestrator.assignCadetRoles(prev, state));
  }, [state]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setSimulation(prev => orchestrator.advanceSimulation(prev, state, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const handleCanvasMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) return;
      pointerWorldRef.current = world;
      if (!placement.active) return;
      const offset = computeGuidonOffset(layoutHeading);
      setPlacement(prev => ({ ...prev, anchor: { x: world.x + offset.x, y: world.y + offset.y } }));
    },
    [placement.active, screenToWorld, computeGuidonOffset, layoutHeading]
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!placement.active) return;
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) return;
      pointerWorldRef.current = world;
      const offset = computeGuidonOffset(layoutHeading);
      placeFlightAt({ x: world.x + offset.x, y: world.y + offset.y });
    },
    [placement.active, screenToWorld, placeFlightAt, computeGuidonOffset, layoutHeading]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPI = window.devicePixelRatio || 1;
    const visualSide = visualSize;
    const width = visualSide;
    const height = visualSide;
    canvas.width = width * DPI;
    canvas.height = height * DPI;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(DPI, 0, 0, DPI, (width / 2) * DPI, (height / 2) * DPI);

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(-width / 2, -height / 2, width, height);

    const areaSidePx = visualSide / 1.5; // outer border ~1.5x marching area instead of 2x
    const scale = areaSidePx / areaInches;
    const halfScaled = halfArea * scale;

    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(-halfScaled, -halfScaled, halfScaled * 2, halfScaled * 2);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(-halfScaled, -halfScaled, halfScaled * 2, halfScaled * 2);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(-halfScaled, 0);
    ctx.lineTo(halfScaled, 0);
    ctx.moveTo(0, -halfScaled);
    ctx.lineTo(0, halfScaled);
    ctx.stroke();
    ctx.setLineDash([]);

    if (placement.active && placement.anchor) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ghostCadets.forEach((ghost, idx) => {
        const color = idx === 0 ? '#0ea5e9' : '#6b7280';
        drawCadet(
          ctx,
          {
            id: ghost.id,
            rank: 0,
            file: idx,
            role: idx === 0 ? 'guidon-bearer' : 'cadet',
            x: ghost.x,
            y: ghost.y,
            headingDeg: ghost.headingDeg,
            actionQueue: [],
          },
          scale,
          color,
          idx === 0
        );
      });
      ctx.restore();
    }

    for (const cadet of simulation.cadets) {
      const color =
        cadet.role === 'guidon-bearer'
          ? '#1d4ed8'
          : cadet.role === 'guide'
          ? '#047857'
          : '#111827';
      drawCadet(ctx, cadet, scale, color, cadet.role === 'guidon-bearer');
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [simulation.cadets, areaInches, halfArea, visualSize, placement.active, placement.anchor, ghostCadets, state.motion]);

  const cadetRows = useMemo(() => {
    return simulation.cadets.map((cadet, idx) => {
      const inBounds =
        Math.abs(cadet.x) <= halfArea + 0.001 && Math.abs(cadet.y) <= halfArea + 0.001;
      const roleLabel = cadet.role
        .replace('-', ' ')
        .replace(/(^|\s)([a-z])/g, (_match, prefix, char) => `${prefix}${char.toUpperCase()}`);
      const roleClass =
        cadet.role === 'guidon-bearer'
          ? 'text-blue-600 dark:text-blue-300 font-semibold'
          : cadet.role === 'guide'
          ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
          : 'text-slate-700 dark:text-slate-200';
      return {
        idx: idx + 1,
        roleLabel,
        roleClass,
        rank: cadet.rank + 1,
        element: cadet.file + 1,
        x: cadet.x.toFixed(1),
        y: cadet.y.toFixed(1),
        heading: Math.round(cadet.headingDeg),
        inBounds,
      };
    });
  }, [simulation.cadets, halfArea]);

  return (
    <div className="mt-4 space-y-4 text-slate-800 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Marching Simulator
        </h1>
        <button
          type="button"
          onClick={() => setShowSetup(true)}
          className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Scenario Setup
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,320px)_minmax(420px,760px)_minmax(260px,1fr)]">
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
          <div>
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-100">Command Console</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quick-issue atomic commands via buttons or keyboard shortcuts.
            </p>
          </div>
          <div className="grid gap-2">
            {QUICK_COMMANDS.map(entry => (
              <button
                key={entry.id}
                className="flex items-center justify-between rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                onClick={() => dispatchCommand(entry.command, entry.source)}
              >
                <span>{entry.label}</span>
                <span className="ml-2 text-xs opacity-80">
                  {entry.hotkey ? (
                    <kbd className="rounded border border-blue-300 bg-blue-700/40 px-2 py-0.5 font-mono text-[11px] tracking-wide">
                      {entry.hotkey}
                    </kbd>
                  ) : (
                    <span className="font-normal text-slate-200">—</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Command Notepad</h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No commands recorded.</p>
            ) : (
              <div className="mt-2 max-h-44 overflow-y-auto pr-1">
                <ol className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                  {history.map(entry => (
                    <li key={entry.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{entry.label}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {entry.preparatory} → {entry.execution}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Preparatory</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{commandStatus.preparatory}</p>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Execution</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{commandStatus.execution}</p>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Current Command</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{commandStatus.label}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-semibold dark:border-slate-700 dark:bg-slate-800/70">
              Formation:
              <span className="font-mono capitalize">{state.formationType.replace('-', ' ')}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/70">
              Guide Side: <span className="font-mono capitalize">{state.guideSide}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/70">
              Heading: <span className="font-mono">{state.headingDeg}°</span>
            </span>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSubmit} className="flex w-full gap-2 md:max-w-sm">
              <input
                value={commandInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setCommandInput(event.target.value)}
                placeholder="e.g., Forward, MARCH"
                className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="submit"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Execute
              </button>
            </form>
            {error && (
              <div
                role="alert"
                className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200"
              >
                {error}
              </div>
            )}
          </div>
          <div className="relative flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
              style={{ width: `${visualSize}px`, height: `${visualSize}px` }}
              onMouseMove={handleCanvasMove}
              onClick={handleCanvasClick}
            />
            <div className="pointer-events-none absolute inset-0 flex items-start justify-start p-3">
              <div className="flex flex-col gap-2">
                {showBeat ? (
                  <div className="flex flex-col gap-2 rounded bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-slate-900/80 dark:text-slate-100">
                    <div className="inline-flex items-center gap-2">
                      <span className="uppercase tracking-wide">Next step:</span>
                      <span className="font-mono text-blue-700 dark:text-blue-300 whitespace-pre">{nextFootLabel}</span>
                      <span className="font-mono text-slate-600 dark:text-slate-200">~{nextBeatLabel} ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-300">Planted</span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            plantedFoot === 'Left'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-mono whitespace-pre">{leftFootLabel}</span>
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            plantedFoot === 'Right'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-mono whitespace-pre">{rightFootLabel}</span>
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${beatProgress * 100}%` }}
                      />
                    </div>
                  </div>
                ) : state.motion !== 'marching' ? (
                  <div className="inline-flex items-center gap-2 rounded bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700 shadow dark:bg-slate-900/80 dark:text-amber-200">
                    Cadence paused (halted)
                  </div>
                ) : null}
                {(currentCallout || upcomingCallouts.length > 0) && (
                  <div className="inline-flex min-w-[220px] flex-col gap-1 rounded bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-slate-900/85 dark:text-slate-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Command cadence
                    </div>
                    {currentCallout?.label ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Now</span>
                        <span className="font-mono text-sm text-blue-700 dark:text-blue-300">
                          {currentCallout.label}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          #{currentCallout.beat}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Waiting for next beat…</div>
                    )}
                    {upcomingCallouts.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-slate-600 dark:text-slate-300">
                        {upcomingCallouts.map(evt => (
                          <span key={evt.id} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 font-mono text-[11px] dark:border-slate-700">
                            <span className="text-slate-400 dark:text-slate-500">#{evt.beat}</span>
                            <span>{evt.label ?? '—'}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm space-y-4 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-100">Cadet Telemetry</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time position, heading, and bounds compliance for each cadet.
              </p>
            </div>
            <button
              className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/70"
              onClick={() => setSimulation(prev => orchestrator.snapCadetsToFormation(prev, state))}
            >
              Plan Snap Alignment
            </button>
          </div>
          <div className="max-h-[520px] overflow-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                <tr>
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Role</th>
                  <th className="px-2 py-1 text-left">Rank</th>
                  <th className="px-2 py-1 text-left">Element</th>
                  <th className="px-2 py-1 text-left">X (in)</th>
                  <th className="px-2 py-1 text-left">Y (in)</th>
                  <th className="px-2 py-1 text-left">Direction (°)</th>
                  <th className="px-2 py-1 text-left">In Bounds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cadetRows.map(row => (
                  <tr key={row.idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/70">
                    <td className="px-2 py-1 font-mono">{row.idx}</td>
                    <td className={`px-2 py-1 ${row.roleClass}`}>{row.roleLabel}</td>
                    <td className="px-2 py-1">{row.rank}</td>
                    <td className="px-2 py-1">{row.element}</td>
                    <td className="px-2 py-1 font-mono">{row.x}</td>
                    <td className="px-2 py-1 font-mono">{row.y}</td>
                    <td className="px-2 py-1 font-mono">{row.heading}°</td>
                    <td className="px-2 py-1 font-semibold text-slate-700 dark:text-slate-200">
                      {row.inBounds ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Scenario Setup</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure flight composition, spacing, and marching area before issuing commands.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetup(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
            <form
              onSubmit={event => {
                handleApplySetup(event);
                setShowSetup(false);
              }}
              className="grid gap-6 p-4 lg:grid-cols-[minmax(280px,340px)_1fr]"
            >
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium flex flex-col gap-1">
                    Simulator
                    <select
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      value={setup.simulator}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                        handleSetupChange('simulator', event.target.value)
                      }
                    >
                      <option value="Marching Simulator">Marching Simulator</option>
                      <option value="Evaluation Mode" disabled>
                        Evaluation Mode (coming soon)
                      </option>
                    </select>
                  </label>
                  <label className="text-sm font-medium flex flex-col gap-1">
                    Cadets (1-22)
                    <input
                      type="number"
                      min={1}
                      max={22}
                      value={setup.cadetCount}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleSetupChange('cadetCount', Number(event.target.value))
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="text-sm font-medium flex flex-col gap-1">
                    Elements (1-10)
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={setup.elements}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleSetupChange('elements', Number(event.target.value))
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="text-sm font-medium flex flex-col gap-1">
                    Interval (in)
                    <input
                      type="number"
                      min={4}
                      max={120}
                      value={setup.interval}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleSetupChange('interval', Number(event.target.value))
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="text-sm font-medium flex flex-col gap-1">
                    Distance (in)
                    <input
                      type="number"
                      min={10}
                      max={120}
                      value={setup.cover}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleSetupChange('cover', Number(event.target.value))
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="text-sm font-medium flex flex-col gap-1">
                    Area Size (ft)
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={setup.areaFeet}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleSetupChange('areaFeet', Number(event.target.value))
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-4 rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Formation Summary</h3>
                  <p>
                    Automatically allocates {Math.max(1, 1 + Math.ceil(Math.max(0, setup.cadetCount - 1) / setup.elements))} ranks across {setup.elements} elements.
                    Interval and cover values drive dress alignment and cadet spacing during maneuvers.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    Apply Setup
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSetup(false)}
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
