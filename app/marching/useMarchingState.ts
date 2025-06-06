import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DEFAULT_INTERVAL,
  DEFAULT_DISTANCE,
  DEFAULT_AREA_FEET,
  DEFAULT_INPUT_COUNT,
  DEFAULT_ELEMENT_COUNT,
  DEFAULT_SCREEN_WIDTH,
  CADENCES,
  DEFAULT_SCREEN_HEIGHT,
  setInchesToPixels,
  setPixelsToInches,
  moveForward,
  Flight,
  Direction,
} from './commonLib';
import { createFlightLogic, initPositionsLogic } from './flightLogic';
import {
  AtomicCommand,
  COMMANDS,
  KEY_TO_COMMAND_LABEL,
  UI_TO_ATOMIC,
  VALID_PREP_EXEC_PAIRS,
  SCORABLE_COMMANDS,
  ATOMIC_COMMANDS,
} from './constants';
import { handleCommandLogic } from './handleCommand';

export function useMarchingState() {
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [distance, setDistance] = useState(DEFAULT_DISTANCE);
  const [areaFeet, setAreaFeet] = useState(DEFAULT_AREA_FEET);
  const [inputCount, setInputCount] = useState(DEFAULT_INPUT_COUNT);
  const [elementCount, setElementCount] = useState(DEFAULT_ELEMENT_COUNT);
  const [showTips, setShowTips] = useState(false);
  const [score, setScore] = useState(0);
  const [boundary, setBoundary] = useState(false);
  const [commandStatus, setCommandStatus] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [showMenu, setShowMenu] = useState(true);
  const [debug, setDebug] = useState(false);
  const prevInBoundsRef = useRef(true);
  const [popupCommand, setPopupCommand] = useState<string | null>(null);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [fallInMode, setFallInMode] = useState(false);
  const [fallInPreview, setFallInPreview] = useState<{ x: number; y: number } | null>(null);
  const [fallInDir, setFallInDir] = useState<Direction>(0);
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

  const SCREEN_WIDTH = DEFAULT_SCREEN_WIDTH;
  const SCREEN_HEIGHT = DEFAULT_SCREEN_HEIGHT;
  const MARCHING_AREA_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;

  const inchesToPixels = useCallback(
    (inches: number) => (MARCHING_AREA_SIZE / (areaFeet * 12)) * inches,
    [MARCHING_AREA_SIZE, areaFeet]
  );
  const pixelsToInches = useCallback(
    (pixels: number) => (areaFeet * 12) / MARCHING_AREA_SIZE * pixels,
    [MARCHING_AREA_SIZE, areaFeet]
  );

  useEffect(() => {
    setInchesToPixels(inchesToPixels);
    setPixelsToInches(pixelsToInches);
  }, [inchesToPixels, pixelsToInches]);

  const [flight, setFlight] = useState<Flight>(() =>
    createFlightLogic(inputCount, elementCount, {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, undefined, 0, DEFAULT_INTERVAL, DEFAULT_DISTANCE)
  );

  const [scoredCommands, setScoredCommands] = useState<Set<string>>(new Set());
  const lastBoundaryState = useRef(boundary);

  const pushExec = useCallback((cmd: AtomicCommand) => {
    if (cmd === 'ROTATE FALL-IN') return;
    setCommandHistory((hist) => {
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].status === 'pending' && hist[i].prep && !hist[i].exec) {
          const isValid = VALID_PREP_EXEC_PAIRS.has(`${hist[i].prep}|${cmd}`);
          if (isValid) {
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
          }
          setCurrentExecutionCommand(null);
          return [...hist, { prep: undefined, exec: cmd, status: 'error' }];
        }
      }
      setCurrentExecutionCommand(null);
      return [...hist, { prep: undefined, exec: cmd, status: 'error' }];
    });
  }, [setCommandHistory, scoredCommands, boundary]);

  const pushPrep = useCallback((cmd: AtomicCommand) => {
    if (cmd === 'ROTATE FALL-IN') return;
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

  useEffect(() => {
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
      const intervalMs = 60000 / flight.cadence.bpm;
      if (now - lastStep >= intervalMs) {
        setFlight((f) => {
          const updated = { ...f, members: f.members.map((c) => ({ ...c })) };
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

  const handleCommand = useCallback(
    (cmd: AtomicCommand) => {
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
    },
    [flight, fallInMode, pushPrep, pushExec]
  );

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!fallInMode) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFallInPreview({ x, y });
    setPopupCommand('FALL IN');
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

  const resetFlight = (center?: { x: number; y: number } | null, dir?: Direction) => {
    const useDir = dir !== undefined ? dir : fallInDir;
    const useCenter = center !== undefined ? center : null;
    const f2 = createFlightLogic(
      inputCount,
      elementCount,
      {
        width: DEFAULT_SCREEN_WIDTH,
        height: DEFAULT_SCREEN_HEIGHT,
        areaWidth: MARCHING_AREA_SIZE,
        areaHeight: MARCHING_AREA_SIZE,
      },
      useCenter ?? undefined,
      useDir,
      interval,
      distance
    );
    initPositionsLogic(
      f2,
      elementCount,
      {
        width: DEFAULT_SCREEN_WIDTH,
        height: DEFAULT_SCREEN_HEIGHT,
        areaWidth: MARCHING_AREA_SIZE,
        areaHeight: MARCHING_AREA_SIZE,
      },
      useCenter ?? undefined,
      useDir,
      interval,
      distance
    );
    setFlight(f2);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false, false, false, false]);
    setShowMenu(true);
  };

  const toggleDebug = () => setDebug((d) => !d);
  const toggleTips = () => setShowTips((t) => !t);

  function handleFallIn(center: { x: number; y: number }, dir?: Direction) {
    const useDir = dir !== undefined ? dir : fallInDir;
    const f = createFlightLogic(
      inputCount,
      elementCount,
      {
        width: DEFAULT_SCREEN_WIDTH,
        height: DEFAULT_SCREEN_HEIGHT,
        areaWidth: MARCHING_AREA_SIZE,
        areaHeight: MARCHING_AREA_SIZE,
      },
      center,
      useDir,
      interval,
      distance
    );
    setFlight(f);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false, false, false]);
    setFallInMode(false);
    setFallInPreview(null);
  }

  function onDebugMenuMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - debugMenuPos.x,
      y: e.clientY - debugMenuPos.y,
    };
    document.body.style.userSelect = 'none';
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showMenu) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
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
    },
    [showMenu, handleCommand, flight.cadence]
  );

  useEffect(() => {
    if (boundary && !lastBoundaryState.current) {
      setScore((s) => Math.max(0, s - 1));
    }
    lastBoundaryState.current = boundary;
  }, [boundary]);

  return {
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
    flight,
    setFlight,
    handleCommand,
    handleCanvasClick,
    handleCanvasMove,
    handleSendAtomicCommand,
    resetFlight,
    toggleDebug,
    toggleTips,
    MARCHING_AREA_SIZE,
    inchesToPixels,
    onDebugMenuMouseDown,
    handleKeyDown,
    ATOMIC_COMMANDS,
    COMMANDS,
  };
}
