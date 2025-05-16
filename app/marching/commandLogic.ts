// Command handling and mapping logic
import { Flight, Cadet, Direction, CADENCES, Cadence, setInchesToPixels, setPixelsToInches, marchToElement, rotate, moveForward, DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT, DEFAULT_INPUT_COUNT, DEFAULT_ELEMENT_COUNT, DEFAULT_INTERVAL, DEFAULT_DISTANCE, DEFAULT_AREA_FEET } from "./commonLib";

// --- Static Command Lists ---
export type AtomicCommandType = 'preparatory' | 'execution' | 'other';

export interface AtomicCommandDef {
  command: typeof ATOMIC_COMMANDS[number];
  type: AtomicCommandType;
}

export const ATOMIC_COMMANDS = [
  "FORWARD", "HALF STEPS", "LEFT", "RIGHT", "ABOUT", "COLUMN LEFT", "COLUMN RIGHT", "FLIGHT", "FACE", "MARCH", "HALT", "FALL-IN", "AS YOU WERE", "ROTATE FALL-IN"
] as const;
export type AtomicCommand = typeof ATOMIC_COMMANDS[number];

export const ATOMIC_COMMAND_DEFS: Record<AtomicCommand, AtomicCommandDef> = {
  "FORWARD": { command: "FORWARD", type: "preparatory" },
  "HALF STEPS": { command: "HALF STEPS", type: "preparatory" },
  "LEFT": { command: "LEFT", type: "preparatory" },
  "RIGHT": { command: "RIGHT", type: "preparatory" },
  "ABOUT": { command: "ABOUT", type: "preparatory" },
  "COLUMN LEFT": { command: "COLUMN LEFT", type: "preparatory" },
  "COLUMN RIGHT": { command: "COLUMN RIGHT", type: "preparatory" },
  "FLIGHT": { command: "FLIGHT", type: "preparatory" },
  "FACE": { command: "FACE", type: "execution" },
  "MARCH": { command: "MARCH", type: "execution" },
  "HALT": { command: "HALT", type: "execution" },
  "FALL-IN": { command: "FALL-IN", type: "execution" },
  "AS YOU WERE": { command: "AS YOU WERE", type: "other" },
  "ROTATE FALL-IN": { command: "ROTATE FALL-IN", type: "other" },
};

export const UI_TO_ATOMIC: Record<string, AtomicCommand[]> = {
  "FORWARD MARCH": ["FORWARD", "MARCH"],
  "LEFT FACE": ["LEFT", "FACE"],
  "RIGHT FACE": ["RIGHT", "FACE"],
  "ABOUT FACE": ["ABOUT", "FACE"],
  "COLUMN LEFT": ["COLUMN LEFT", "MARCH"],
  "COLUMN RIGHT": ["COLUMN RIGHT", "MARCH"],
  "FLIGHT HALT": ["FLIGHT", "HALT"],
  "HALF STEPS": ["HALF STEPS", "MARCH"],
  "FALL-IN": ["FLIGHT", "FALL-IN"],
  "AS YOU WERE": ["AS YOU WERE"],
  "ROTATE FALL-IN": ["ROTATE FALL-IN"],
};

export const VALID_PREP_EXEC_PAIRS = new Set(
  Object.values(UI_TO_ATOMIC)
    .filter(arr => arr.length === 2)
    .map(([prep, exec]) => `${prep}|${exec}`)
);

export const SCORABLE_COMMANDS: Array<[AtomicCommand, AtomicCommand]> = [
  ["FORWARD", "MARCH"],
  ["LEFT", "FACE"],
  ["RIGHT", "FACE"],
  ["ABOUT", "FACE"],
  ["COLUMN LEFT", "MARCH"],
  ["COLUMN RIGHT", "MARCH"],
  ["FLIGHT", "HALT"],
  ["HALF STEPS", "MARCH"],
];

export const COMMANDS = [
  { key: "w", label: "FORWARD MARCH" },
  { key: "a", label: "LEFT FACE" },
  { key: "d", label: "RIGHT FACE" },
  { key: "s", label: "ABOUT FACE" },
  { key: "q", label: "COLUMN LEFT" },
  { key: "e", label: "COLUMN RIGHT" },
  { key: " ", label: "FLIGHT HALT" }, // spacebar
  { key: "h", label: "HALF STEPS" },
  { key: "f", label: "FALL-IN" },
  { key: "r", label: "ROTATE FALL-IN" },
  { key: "Esc", label: "AS YOU WERE" },
];

// --- Keyboard event handler ---
export const KEY_TO_COMMAND_LABEL: Record<string, string> = {
  "w": "FORWARD MARCH",
  "a": "LEFT FACE",
  "d": "RIGHT FACE",
  "s": "ABOUT FACE",
  "q": "COLUMN LEFT",
  "e": "COLUMN RIGHT",
  " ": "FLIGHT HALT",
  "h": "HALF STEPS",
  "f": "FALL-IN",
  "r": "ROTATE FALL-IN",
  "escape": "AS YOU WERE",
};

// handleCommandLogic: refactored from page.tsx
export async function handleCommandLogic({
  cmd,
  flight,
  setCurrentCommand,
  setCurrentPreparatoryCommand,
  setCurrentExecutionCommand,
  setCommandHistory,
  setFallInMode,
  setFallInPreview,
  setFallInDir,
  showPopupForBeats,
  commandInProgressRef,
  currentPreparatoryCommandRef,
  VALID_PREP_EXEC_PAIRS,
  pushPrep,
  pushExec,
  CADENCES,
  marchToElement,
  setFlight,
  fallInMode,
  lastMousePosRef,
}: {
  cmd: AtomicCommand;
  flight: Flight;
  setCurrentCommand: (cmd: AtomicCommand) => void;
  setCurrentPreparatoryCommand: (cmd: AtomicCommand | null) => void;
  setCurrentExecutionCommand: (cmd: AtomicCommand | null) => void;
  setCommandHistory: (fn: (hist: { prep?: AtomicCommand; exec?: AtomicCommand; status: 'pending' | 'error' | 'success' | 'asYouWere' }[]) => { prep?: AtomicCommand; exec?: AtomicCommand; status: 'pending' | 'error' | 'success' | 'asYouWere' }[]) => void;
  setFallInMode: (b: boolean) => void;
  setFallInPreview: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setFallInDir: (v: Direction | ((d: Direction) => Direction)) => void;
  showPopupForBeats: (cmd: string, beats?: number) => void;
  commandInProgressRef: React.RefObject<AbortController | null>;
  currentPreparatoryCommandRef: React.RefObject<AtomicCommand | null>;
  VALID_PREP_EXEC_PAIRS: Set<string>;
  pushPrep: (cmd: AtomicCommand) => void;
  pushExec: (cmd: AtomicCommand) => void;
  CADENCES: Record<string, Cadence>;
  marchToElement: (cadet: Cadet, targetElement: number, flight: Flight, onStep?: () => void) => Promise<void>;
  setFlight: (f: Flight | ((prev: Flight) => Flight)) => void;
  fallInMode: boolean;
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>;
}) {
  setCurrentCommand(cmd);
  // AS YOU WERE: always interrupt and log
  if (cmd === "AS YOU WERE") {
    setCurrentPreparatoryCommand(null);
    setCurrentExecutionCommand(null);
    currentPreparatoryCommandRef.current = null;
    if (commandInProgressRef.current) {
      commandInProgressRef.current.abort();
      commandInProgressRef.current = null;
    }
    setCommandHistory((hist) => {
      // If last row is a pending prep, mark it as error before adding asYouWere
      if (hist.length > 0 && hist[hist.length - 1].status === 'pending' && hist[hist.length - 1].prep && !hist[hist.length - 1].exec) {
        return [
          ...hist.slice(0, -1),
          { ...hist[hist.length - 1], status: 'error' },
          { status: 'asYouWere' }
        ];
      }
      return [...hist, { status: 'asYouWere' }];
    });
    showPopupForBeats(cmd);
    if (fallInMode) {
      setFallInMode(false);
      setFallInPreview(null);
    }
    return;
  }
  // Setup abort controller for interruptible commands
  let abortController: AbortController | null = null;
  function shouldAbort() {
    return abortController && abortController.signal.aborted;
  }
  const isExecution = ATOMIC_COMMAND_DEFS[cmd]?.type === 'execution';
  if (isExecution) {
    // Only process if there is a valid preparatory-execution pair
    const prep = currentPreparatoryCommandRef.current;
    const isValid = prep && VALID_PREP_EXEC_PAIRS.has(`${prep}|${cmd}`);
    if (!prep) {
      pushExec(cmd); // Will add a red row
      setCurrentExecutionCommand(null);
      return;
    }
    if (!isValid) {
      pushExec(cmd); // Will add a red row and keep prep
      setCurrentExecutionCommand(null);
      return;
    }
  }
  switch (cmd) {
    case "FORWARD":
    case "HALF STEPS":
    case "LEFT":
    case "RIGHT":
    case "ABOUT":
    case "COLUMN LEFT":
    case "COLUMN RIGHT":
    case "FLIGHT":
      setCurrentPreparatoryCommand(cmd);
      currentPreparatoryCommandRef.current = cmd;
      showPopupForBeats(cmd);
      pushPrep(cmd);
      break;
    case "MARCH": {
      setCurrentExecutionCommand("MARCH");
      showPopupForBeats("MARCH");
      pushExec("MARCH");
      switch (currentPreparatoryCommandRef.current) {
        case "FORWARD": {
          // Standard forward march
          let cadence = CADENCES["Quick Time"];
          const stepInterval = 60000 / cadence.bpm;
          setTimeout(() => {
            setFlight((f: Flight) => ({ ...f, cadence, isMarching: true }));
          }, stepInterval);
          break;
        }
        case "HALF STEPS": {
          // Half step march
          let cadence = CADENCES["Half Step"];
          const stepInterval = 60000 / cadence.bpm;
          setTimeout(() => {
            setFlight((f: Flight) => ({ ...f, cadence, isMarching: true }));
          }, stepInterval);
          break;
        }
        case "COLUMN RIGHT": {
          // COLUMN RIGHT MARCH logic removed. TODO: Implement fresh logic per AFMAN 36-2203.
          break;
        }
        case "COLUMN LEFT": {
          // TODO: Implement COLUMN LEFT MARCH logic here
          break;
        }
        default: {
          // For any other preparatory command, do nothing
          break;
        }
      }
      break;
    }
    case "FACE": {
      setCurrentExecutionCommand("FACE");
      showPopupForBeats("FACE");
      pushExec("FACE");
      abortController = new AbortController();
      commandInProgressRef.current = abortController;
      const f2 = { ...flight, members: flight.members.map((c: Cadet) => ({ ...c })) };
      const guidon = f2.members[0];
      const guidonTurnDelay = 60000 / flight.cadence.bpm;
      if (currentPreparatoryCommandRef.current === "RIGHT") for (const c of f2.members) rotate(c, 90);
      if (currentPreparatoryCommandRef.current === "LEFT") for (const c of f2.members) rotate(c, -90);
      if (currentPreparatoryCommandRef.current === "ABOUT") for (const c of f2.members) rotate(c, 180);
      setFlight({ ...f2, members: f2.members.map((c: Cadet) => ({ ...c })) });
      const prepCmd = currentPreparatoryCommandRef.current;
      // --- Helper functions for doMarch ---
      const awaitDelay = (ms: number) => new Promise(res => setTimeout(res, ms));
      const updateFlightMembers = () => setFlight({ ...f2, members: f2.members.map((c) => ({ ...c })) });
      const abortIfNeeded = () => { if (shouldAbort()) throw new Error("aborted"); };
      await awaitDelay(guidonTurnDelay);
      if (shouldAbort()) {
        commandInProgressRef.current = null;
        return;
      }
      const doMarch = async (prep: AtomicCommand | null) => {
        try {
          if (prep === "RIGHT") {
            if (f2.formation === "LINE") {
              rotate(guidon, 90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchToElement(guidon, f2.elementCount - 1, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              rotate(guidon, -90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              f2.formation = "COLUMN";
            } else if (f2.formation === "COLUMN") {
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              await marchToElement(guidon, 0, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = "LINE";
            }
          } else if (prep === "LEFT") {
            if (f2.formation === "LINE") {
              rotate(guidon, -90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchToElement(guidon, f2.elementCount - 1, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              rotate(guidon, 90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              f2.formation = "COLUMN";
            } else if (f2.formation === "COLUMN") {
              await marchToElement(guidon, 0, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = "LINE";
            }
          } else if (prep === "ABOUT") {
            if (f2.formation === "LINE") {
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchToElement(guidon, f2.elementCount - 1, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchToElement(guidon, 0, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = "LINE";
            } else if (f2.formation === "COLUMN") {
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              f2.formation = "COLUMN";
            }
          }
          updateFlightMembers();
        } catch (e) {
          console.error("Command aborted:", e);
        } finally {
          commandInProgressRef.current = null;
        }
      };
      doMarch(prepCmd);
      break;
    }
    case "HALT": {
      setCurrentExecutionCommand("HALT");
      showPopupForBeats("HALT");
      pushExec("HALT");
      // Continue marching for 1 more beats before stopping
      const haltDelay = (60000 / flight.cadence.bpm);
      setTimeout(() => {
        setFlight((f: Flight) => ({ ...f, isMarching: false }));
      }, haltDelay);
      break;
    }
    case "FALL-IN": {
      setCurrentExecutionCommand("FALL-IN");
      showPopupForBeats("FALL-IN");
      pushExec("FALL-IN");
      setFallInMode(true);
      setFallInPreview(
          lastMousePosRef.current || {
            x: DEFAULT_SCREEN_WIDTH / 2,
            y: DEFAULT_SCREEN_HEIGHT / 2,
          }
        );
      setFallInDir(0);
      break;
    }
    case "ROTATE FALL-IN": {
      setCurrentExecutionCommand("ROTATE FALL-IN");
      showPopupForBeats("ROTATE FALL-IN");
      pushExec("ROTATE FALL-IN");
      setFallInDir((d: Direction) => ((d + 90) % 360) as Direction);
      break;
    }
  }
}

import { useState, useRef, useCallback, useEffect } from "react";
import { createFlightLogic, initPositionsLogic } from "./flightLogic";

export function useMarchingState() {
  // --- State ---
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [distance, setDistance] = useState(DEFAULT_DISTANCE);
  const [areaFeet, setAreaFeet] = useState(DEFAULT_AREA_FEET);
  const [inputCount, setInputCount] = useState(DEFAULT_INPUT_COUNT);
  const [elementCount, setElementCount] = useState(DEFAULT_ELEMENT_COUNT);
  const [showTips, setShowTips] = useState(false);
  const [score, setScore] = useState(0);
  const [boundary, setBoundary] = useState(false);
  const [commandStatus, setCommandStatus] = useState<boolean[]>([false, false, false, false, false, false, false, false, false]);
  const [showMenu, setShowMenu] = useState(true);
  const [debug, setDebug] = useState(false);
  const prevInBoundsRef = useRef(true);
  const [popupCommand, setPopupCommand] = useState<string | null>(null);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [fallInMode, setFallInMode] = useState(false);
  const [fallInPreview, setFallInPreview] = useState<{x: number, y: number} | null>(null);
  const [fallInDir, setFallInDir] = useState<Direction>(0);
  // Track last mouse position for fall-in preview
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const lastStepTimeRef = useRef<number | null>(null);
  const [commandHistory, setCommandHistory] = useState<
    { prep?: AtomicCommand; exec?: AtomicCommand; status: 'pending' | 'error' | 'success' | 'asYouWere' }[]
  >([]);
  const commandInProgressRef = useRef<AbortController | null>(null);
  const [currentCommand, setCurrentCommand] = useState<AtomicCommand | null>(null);
  const [currentPreparatoryCommand, setCurrentPreparatoryCommand] = useState<AtomicCommand | null>(null);
  const [currentExecutionCommand, setCurrentExecutionCommand] = useState<AtomicCommand | null>(null);
  const currentPreparatoryCommandRef = useRef<AtomicCommand | null>(null);
  const [debugMenuPos, setDebugMenuPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragging = useRef(false);

  // Marching area size
  const SCREEN_WIDTH = DEFAULT_SCREEN_WIDTH;
  const SCREEN_HEIGHT = DEFAULT_SCREEN_HEIGHT;
  const MARCHING_AREA_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;

  // Conversion functions
  const inchesToPixels = useCallback(
    (inches: number) => (MARCHING_AREA_SIZE / (areaFeet * 12)) * inches,
    [MARCHING_AREA_SIZE, areaFeet]
  );
  const pixelsToInches = useCallback(
    (pixels: number) => (areaFeet * 12 / MARCHING_AREA_SIZE) * pixels,
    [MARCHING_AREA_SIZE, areaFeet]
  );

  useEffect(() => {
    setInchesToPixels(inchesToPixels);
    setPixelsToInches(pixelsToInches);
  }, [inchesToPixels, pixelsToInches]);

  // Flight state
  const [flight, setFlight] = useState<Flight>(() => createFlightLogic(inputCount, elementCount, {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    areaWidth: MARCHING_AREA_SIZE,
    areaHeight: MARCHING_AREA_SIZE,
  }, undefined, 0, DEFAULT_INTERVAL, DEFAULT_DISTANCE));

  
  // --- Scoring State ---
  const [scoredCommands, setScoredCommands] = useState<Set<string>>(new Set());
  const lastBoundaryState = useRef(boundary);

  // --- Logic for pushPrep/pushExec, popup, etc. ---
  const pushExec = useCallback((cmd: AtomicCommand) => {
    if (cmd === "ROTATE FALL-IN") return;
    setCommandHistory((hist) => {
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].status === 'pending' && hist[i].prep && !hist[i].exec) {
          const isValid = VALID_PREP_EXEC_PAIRS.has(`${hist[i].prep}|${cmd}`);
          if (isValid) {
            // --- Scoring logic ---
            if (typeof hist[i].prep !== 'undefined') {
              const combo: [AtomicCommand, AtomicCommand] = [hist[i].prep as AtomicCommand, cmd];
              const comboKey = combo.join('|');
              if (
                SCORABLE_COMMANDS.some(([a, b]) => a === combo[0] && b === combo[1]) &&
                !scoredCommands.has(comboKey) &&
                !boundary
              ) {
                setScore((s) => s + 1);
                setScoredCommands((prev) => new Set(prev).add(comboKey));
                const idx = SCORABLE_COMMANDS.findIndex(([a, b]) => a === combo[0] && b === combo[1]);
                if (idx !== -1) {
                  setCommandStatus((prev) => {
                    const next = [...prev];
                    next[idx] = true;
                    return next;
                  });
                }
              }
            }
            setCurrentPreparatoryCommand(null);
            setCurrentExecutionCommand(null);
            currentPreparatoryCommandRef.current = null;
            return [
              ...hist.slice(0, i),
              { ...hist[i], exec: cmd, status: 'success' },
              ...hist.slice(i + 1),
            ];
          } else {
            setCurrentExecutionCommand(null);
            return [
              ...hist,
              { prep: undefined, exec: cmd, status: 'error' },
            ];
          }
        }
      }
      setCurrentExecutionCommand(null);
      return [
        ...hist,
        { prep: undefined, exec: cmd, status: 'error' },
      ];
    });
  }, [setCommandHistory, scoredCommands, boundary, setScore, setScoredCommands, setCommandStatus, setCurrentPreparatoryCommand, setCurrentExecutionCommand, currentPreparatoryCommandRef]);

  const pushPrep = useCallback((cmd: AtomicCommand) => {
    if (cmd === "ROTATE FALL-IN") return;
    setCommandHistory((hist) => {
      if (hist.length > 0 && hist[hist.length - 1].status === 'pending' && !hist[hist.length - 1].exec) {
        if (hist.length > 1 && hist[hist.length - 2].status === 'asYouWere') {
          return [
            ...hist.slice(0, -1),
            { ...hist[hist.length - 1], status: 'error' },
            { prep: cmd, status: 'pending' },
          ];
        }
        return [
          ...hist.slice(0, -1),
          { ...hist[hist.length - 1], status: 'error' },
          { prep: cmd, status: 'pending' },
        ];
      }
      return [...hist, { prep: cmd, status: 'pending' }];
    });
  }, [setCommandHistory]);

  // --- Effects ---
  useEffect(() => {
    // Update boundary state whenever flight or marching area changes
    if (!flight || !flight.members) return;
    const inBounds = flight.isWithinBounds();
    setBoundary(!inBounds.every(Boolean));
  }, [flight, MARCHING_AREA_SIZE, areaFeet]);

  useEffect(() => {
    if (!flight.isMarching) return;
    let raf: number;
    let lastStep = performance.now();
    const step = () => {
      const now = performance.now();
      const interval = 60000 / flight.cadence.bpm;
      if (now - lastStep >= interval) {
        // Move all cadets forward one step
        setFlight(f => {
          const updated = { ...f, members: f.members.map(c => ({ ...c })) };
          for (const cadet of updated.members) {
            moveForward(cadet, 1, updated.cadence.stepLength);
          }
          return updated;
        });
        lastStep = now;
      }
      if (flight.isMarching) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [flight.isMarching, flight.cadence.bpm, flight.cadence.stepLength, setFlight]);

  // --- UI Handler Wrappers ---
  const handleCommand = useCallback((cmd: AtomicCommand) => {
    handleCommandLogic({
      cmd,
      flight,
      setCurrentCommand,
      setCurrentPreparatoryCommand,
      setCurrentExecutionCommand,
      setCommandHistory,
      setFallInMode,
      setFallInPreview,
      setFallInDir,
      showPopupForBeats: (c: string, b = 2) => {
        setPopupCommand(c);
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        const stepInterval = 60000 / flight.cadence.bpm;
        popupTimerRef.current = setTimeout(() => setPopupCommand(null), b * stepInterval);
      },
      commandInProgressRef,
      currentPreparatoryCommandRef,
      VALID_PREP_EXEC_PAIRS,
      pushPrep,
      pushExec,
      CADENCES,
      marchToElement,
      setFlight,
      fallInMode,
      lastMousePosRef,
    });
  }, [flight, fallInMode, pushPrep, pushExec]);

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!fallInMode) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFallInPreview({ x, y });
    setPopupCommand("FALL IN");
    handleFallIn({ x, y }, fallInDir);
  }
  function handleCanvasMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMousePosRef.current = { x, y };
    if (!fallInMode) return;
    setFallInPreview({ x, y });
  }
  const handleSendAtomicCommand = (cmd: string) => handleCommand(cmd as AtomicCommand);
  const resetFlight = (center?: {x: number, y: number} | null, dir?: Direction) => {
    // Use provided center/dir or defaults
    const useDir = dir !== undefined ? dir : fallInDir;
    const useCenter = center !== undefined ? center : null;
    const f = createFlightLogic(inputCount, elementCount, {
      width: DEFAULT_SCREEN_WIDTH,
      height: DEFAULT_SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, useCenter ?? undefined, useDir, interval, distance);
    initPositionsLogic(f, elementCount, {
      width: DEFAULT_SCREEN_WIDTH,
      height: DEFAULT_SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, useCenter ?? undefined, useDir, interval, distance);
    setFlight(f);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false, false, false, false]);
    setShowMenu(true);
  };
  const toggleDebug = () => setDebug((d) => !d);
  const toggleTips = () => setShowTips((t) => !t);
  function handleFallIn(center: {x: number, y: number}, dir?: Direction) {
    const useDir = dir !== undefined ? dir : fallInDir;
    const f = createFlightLogic(inputCount, elementCount, {
      width: DEFAULT_SCREEN_WIDTH,
      height: DEFAULT_SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, center, useDir, interval, distance);
    setFlight(f);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false, false, false]);
    setFallInMode(false);
    setFallInPreview(null);
  }

  // --- Drag handler for debug menu ---
  function onDebugMenuMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - debugMenuPos.x,
      y: e.clientY - debugMenuPos.y,
    };
    document.body.style.userSelect = "none";
  }

  // --- Keyboard event handler ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showMenu) return;
    // Ignore if focus is on input/textarea/button
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    // Map keys to commands
    const key = e.key.toLowerCase();
    const cmdLabel = KEY_TO_COMMAND_LABEL[key];
    if (!cmdLabel) return;
    const atomicSequence = UI_TO_ATOMIC[cmdLabel];
    if (!atomicSequence) return;
    e.preventDefault();
    if (atomicSequence.length === 1) {
      handleCommand(atomicSequence[0]);
    } else {
      const [prep, exec] = atomicSequence;
      handleCommand(prep);
      const cadence = flight.cadence;
      const stepInterval = 60000 / cadence.bpm;
      setTimeout(() => {
        handleCommand(exec);
      }, 2 * stepInterval);
    }
  }, [showMenu, handleCommand, flight.cadence]);

  // Watch for boundary changes: lose a point each time flight leaves boundary
  useEffect(() => {
    if (boundary && !lastBoundaryState.current) {
      setScore((s) => Math.max(0, s - 1));
    }
    lastBoundaryState.current = boundary;
  }, [boundary]);

  return {
    // --- State ---
    interval,
    setInterval,
    distance,
    setDistance,
    areaFeet,
    setAreaFeet,
    inputCount,
    setInputCount,
    elementCount,
    setElementCount,
    showTips,
    setShowTips,
    score,
    setScore,
    boundary,
    setBoundary,
    commandStatus,
    setCommandStatus,
    showMenu,
    setShowMenu,
    debug,
    setDebug,
    prevInBoundsRef,
    popupCommand,
    setPopupCommand,
    popupTimerRef,
    fallInMode,
    setFallInMode,
    fallInPreview,
    setFallInPreview,
    fallInDir,
    setFallInDir,
    lastStepTimeRef,
    commandHistory,
    setCommandHistory,
    commandInProgressRef,
    currentCommand,
    setCurrentCommand,
    currentPreparatoryCommand,
    setCurrentPreparatoryCommand,
    currentExecutionCommand,
    setCurrentExecutionCommand,
    currentPreparatoryCommandRef,
    debugMenuPos,
    setDebugMenuPos,
    dragOffset,
    dragging,

    // --- Flight logic ---
    flight,
    setFlight,

    // --- Functions ---
    handleCommand,
    handleCanvasClick,
    handleCanvasMove,
    handleSendAtomicCommand,
    resetFlight, // now accepts optional center and dir
    toggleDebug,
    toggleTips,
    MARCHING_AREA_SIZE,

    // --- Added values ---
    inchesToPixels,
    onDebugMenuMouseDown,
    handleKeyDown, // <-- Export for use in page.tsx
  };
}
