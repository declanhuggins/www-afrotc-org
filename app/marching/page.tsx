"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";
import { createFlight, initPositions, rotate, marchToElement, Flight, Direction, degToRad, CADENCES, DEFAULT_INTERVAL, DEFAULT_DISTANCE, setInchesToPixels, setPixelsToInches } from "./lib";
import { FlightCanvas } from "./FlightCanvas";
import { DebugMenu } from "./DebugMenu";
import { Menu } from "./Menu";

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 800;
const DEFAULT_AREA_FEET = 25; // feet
const DEFAULT_INPUT_COUNT = 13;

// The UI commands (shown to user)
const COMMANDS = [
  { key: "w", label: "FORWARD MARCH" },
  { key: "a", label: "LEFT FACE" },
  { key: "d", label: "RIGHT FACE" },
  { key: "s", label: "ABOUT FACE" },
  { key: " ", label: "FLIGHT HALT" }, // spacebar
  { key: "h", label: "HALF STEPS" },
  { key: "f", label: "FALL-IN" },
  { key: "r", label: "ROTATE FALL-IN" },
  { key: "Esc", label: "AS YOU WERE" },
];

// The atomic commands handled by handleCommand
const ATOMIC_COMMANDS = [
  "FORWARD", "HALF STEPS", "LEFT", "RIGHT", "ABOUT", "FLIGHT", "FACE", "MARCH", "HALT", "FALL-IN", "AS YOU WERE", "ROTATE FALL-IN"
] as const;
type AtomicCommand = typeof ATOMIC_COMMANDS[number];

// Map UI command label to preparatory/exec sequence
const UI_TO_ATOMIC: Record<string, AtomicCommand[]> = {
  "FORWARD MARCH": ["FORWARD", "MARCH"],
  "LEFT FACE": ["LEFT", "FACE"],
  "RIGHT FACE": ["RIGHT", "FACE"],
  "ABOUT FACE": ["ABOUT", "FACE"],
  "FLIGHT HALT": ["FLIGHT", "HALT"],
  "HALF STEPS": ["HALF STEPS", "MARCH"],
  "FALL-IN": ["FLIGHT", "FALL-IN"],
  "AS YOU WERE": ["AS YOU WERE"],
  "ROTATE FALL-IN": ["ROTATE FALL-IN"],
};

// Set of valid preparatory-execution pairs for green highlighting
const VALID_PREP_EXEC_PAIRS = new Set(
  Object.values(UI_TO_ATOMIC)
    .filter(arr => arr.length === 2)
    .map(([prep, exec]) => `${prep}|${exec}`)
);

export default function MarchingPage() {
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [distance, setDistance] = useState(DEFAULT_DISTANCE);
  const [areaFeet, setAreaFeet] = useState(DEFAULT_AREA_FEET);
  const [inputCount, setInputCount] = useState(DEFAULT_INPUT_COUNT);
  const [elementCount, setElementCount] = useState(3);
  const [showTips, setShowTips] = useState(false);
  // Marching area is always a square
  const MARCHING_AREA_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;
  // Conversion: inches to pixels and pixels to inches for current area size
  const inchesToPixels = useCallback(
    (inches: number) => (MARCHING_AREA_SIZE / (areaFeet * 12)) * inches,
    [MARCHING_AREA_SIZE, areaFeet]
  );
  const pixelsToInches = useCallback(
    (pixels: number) => (areaFeet * 12 / MARCHING_AREA_SIZE) * pixels,
    [MARCHING_AREA_SIZE, areaFeet]
  );

  // Keep lib.ts in sync with the current conversion functions
  useEffect(() => {
    setInchesToPixels(inchesToPixels);
    setPixelsToInches(pixelsToInches);
  }, [inchesToPixels, pixelsToInches]);

  const [flight, setFlight] = useState<Flight>(() => createFlight(DEFAULT_INPUT_COUNT, 3, {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    areaWidth: MARCHING_AREA_SIZE,
    areaHeight: MARCHING_AREA_SIZE,
  }, undefined, 0, DEFAULT_INTERVAL, DEFAULT_DISTANCE));
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
  // Ref to track last step time
  const lastStepTimeRef = useRef<number | null>(null);
  // Track command history as objects for notepad columns
  const [commandHistory, setCommandHistory] = useState<
    { prep?: AtomicCommand; exec?: AtomicCommand; status: 'pending' | 'error' | 'success' | 'asYouWere' }[]
  >([]);
  // Track if a command is in progress and allow interruption
  const commandInProgressRef = useRef<AbortController | null>(null);
  // Track current command, preparatory, and execution command
  const [currentCommand, setCurrentCommand] = useState<AtomicCommand | null>(null);
  const [currentPreparatoryCommand, setCurrentPreparatoryCommand] = useState<AtomicCommand | null>(null);
  const [currentExecutionCommand, setCurrentExecutionCommand] = useState<AtomicCommand | null>(null);
  // Ref to persist preparatory command between async handleCommand calls
  const currentPreparatoryCommandRef = useRef<AtomicCommand | null>(null);

  // Draggable debug menu state and logic
  const [debugMenuPos, setDebugMenuPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragging = useRef(false);

  function onDebugMenuMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - debugMenuPos.x,
      y: e.clientY - debugMenuPos.y,
    };
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      setDebugMenuPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    }
    function onMouseUp() {
      dragging.current = false;
      document.body.style.userSelect = "";
    }
    if (debug) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }
  }, [debug]);

  const showPopupForBeats = useCallback((cmd: string, beats = 2) => {
    setPopupCommand(cmd);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    const stepInterval = 60000 / flight.cadence.bpm;
    popupTimerRef.current = setTimeout(() => setPopupCommand(null), beats * stepInterval);
  }, [flight.cadence.bpm]);

  function pushExec(cmd: AtomicCommand) {
    if (cmd === "ROTATE FALL-IN") return; // Ignore for notepad
    setCommandHistory((hist) => {
      // Find last pending prep
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].status === 'pending' && hist[i].prep && !hist[i].exec) {
          const isValid = VALID_PREP_EXEC_PAIRS.has(`${hist[i].prep}|${cmd}`);
          if (isValid) {
            setCurrentPreparatoryCommand(null);
            setCurrentExecutionCommand(null);
            currentPreparatoryCommandRef.current = null;
            return [
              ...hist.slice(0, i),
              { ...hist[i], exec: cmd, status: 'success' },
              ...hist.slice(i + 1),
            ];
          } else {
            // Invalid pair: leave pending prep row, add a new row with only exec in red
            setCurrentExecutionCommand(null);
            return [
              ...hist,
              { prep: undefined, exec: cmd, status: 'error' },
            ];
          }
        }
      }
      // No pending prep: add a new row, both prep and exec in red
      setCurrentExecutionCommand(null);
      return [
        ...hist,
        { prep: undefined, exec: cmd, status: 'error' },
      ];
    });
  }

  function pushPrep(cmd: AtomicCommand) {
    if (cmd === "ROTATE FALL-IN") return; // Ignore for notepad
    setCommandHistory((hist) => {
      // If the last row is a pending prep, and AS YOU WERE was just called, mark it as error (red)
      if (hist.length > 0 && hist[hist.length - 1].status === 'pending' && !hist[hist.length - 1].exec) {
        // If the previous row is 'asYouWere', mark the pending prep as error
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
  }

  const handleCommand = useCallback(async (cmd: AtomicCommand) => {
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
    const isExecution = ["MARCH", "FACE", "HALT", "FALL-IN", "ROTATE FALL-IN"].includes(cmd);
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
      case "FLIGHT":
        setCurrentPreparatoryCommand(cmd);
        currentPreparatoryCommandRef.current = cmd;
        showPopupForBeats(cmd);
        pushPrep(cmd);
        break;
      case "MARCH":
        setCurrentExecutionCommand("MARCH");
        showPopupForBeats("MARCH");
        pushExec("MARCH");
        // Add a one-beat pause before starting to march
        let cadence = flight.cadence;
        const stepInterval = 60000 / cadence.bpm;
        switch (currentPreparatoryCommandRef.current) {
          case "FORWARD": 
            cadence = CADENCES["Quick Time"]; 
            break;
          case "HALF STEPS": 
            cadence = CADENCES["Half Step"]; 
            break;
        }
        setTimeout(() => {
          setFlight((f) => ({ ...f, cadence, isMarching: true }));
        }, stepInterval);
        break;
      case "FACE": {
        setCurrentExecutionCommand("FACE");
        showPopupForBeats("FACE");
        pushExec("FACE");
        abortController = new AbortController();
        commandInProgressRef.current = abortController;
        const f2 = { ...flight, members: flight.members.map((c) => ({ ...c })) };
        const guidon = f2.members[0];
        const guidonTurnDelay = 60000 / flight.cadence.bpm;
        console.log('Current preparatory command:', currentPreparatoryCommandRef.current);
        if (currentPreparatoryCommandRef.current === "RIGHT") for (const c of f2.members) rotate(c, 90);
        if (currentPreparatoryCommandRef.current === "LEFT") for (const c of f2.members) rotate(c, -90);
        if (currentPreparatoryCommandRef.current === "ABOUT") for (const c of f2.members) rotate(c, 180);
        setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
        const prepCmd = currentPreparatoryCommandRef.current;
        await new Promise(res => setTimeout(res, guidonTurnDelay));
        if (shouldAbort()) {
          commandInProgressRef.current = null;
          return;
        }
        const doMarch = async (prep: AtomicCommand | null) => {
          try {
            console.log('[doMarch] Entered doMarch. Prep:', prep, 'Formation:', f2.formation);
            if (prep === "RIGHT") {
              console.log('[doMarch] Handling RIGHT FACE, formation:', f2.formation);
              if (f2.formation === "LINE") {
                console.log('[doMarch] RIGHT FACE from LINE');
                rotate(guidon, 90);
                setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                await new Promise(res => setTimeout(res, guidonTurnDelay));
                if (shouldAbort()) throw new Error("aborted");
                console.log('[doMarch] Calling marchToElement for RIGHT FACE from LINE');
                await marchToElement(guidon, f2.elementCount - 1, f2, () => {
                  setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                  if (shouldAbort()) throw new Error("aborted");
                });
                rotate(guidon, -90);
                setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                await new Promise(res => setTimeout(res, guidonTurnDelay));
                if (shouldAbort()) throw new Error("aborted");
                f2.formation = "COLUMN";
              } else if (f2.formation === "COLUMN") {
                console.log('[doMarch] RIGHT FACE from COLUMN');
                f2.formation = "INVERSE_LINE";
              } else if (f2.formation === "INVERSE_LINE") {
                console.log('[doMarch] RIGHT FACE from INVERSE_LINE');
                f2.formation = "INVERSE_COLUMN";
              } else if (f2.formation === "INVERSE_COLUMN") {
                console.log('[doMarch] RIGHT FACE from INVERSE_COLUMN');
                await marchToElement(guidon, 0, f2, () => {
                  setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                  if (shouldAbort()) throw new Error("aborted");
                });
                f2.formation = "LINE";
              }
            } else if (prep === "LEFT") {
              console.log('[doMarch] Handling LEFT FACE, formation:', f2.formation);
              if (f2.formation === "LINE") {
                console.log('[doMarch] LEFT FACE from LINE');
                rotate(guidon, -90);
                setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                await new Promise(res => setTimeout(res, guidonTurnDelay));
                if (shouldAbort()) throw new Error("aborted");
                console.log('[doMarch] Calling marchToElement for LEFT FACE from LINE');
                await marchToElement(guidon, f2.elementCount - 1, f2, () => {
                  setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                  if (shouldAbort()) throw new Error("aborted");
                });
                rotate(guidon, 90);
                setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                await new Promise(res => setTimeout(res, guidonTurnDelay));
                if (shouldAbort()) throw new Error("aborted");
                f2.formation = "INVERSE_COLUMN";
              } else if (f2.formation === "INVERSE_COLUMN") {
                console.log('[doMarch] LEFT FACE from INVERSE_COLUMN');
                f2.formation = "INVERSE_LINE";
              } else if (f2.formation === "INVERSE_LINE") {
                console.log('[doMarch] LEFT FACE from INVERSE_LINE');
                f2.formation = "COLUMN";
              } else if (f2.formation === "COLUMN") {
                console.log('[doMarch] LEFT FACE from COLUMN');
                await marchToElement(guidon, 0, f2, () => {
                  setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                  if (shouldAbort()) throw new Error("aborted");
                });
                f2.formation = "LINE";
              }
            } else if (prep === "ABOUT") {
              console.log('[doMarch] Handling ABOUT FACE, formation:', f2.formation);
              if (f2.formation === "LINE") {
                console.log('[doMarch] ABOUT FACE from LINE');
                setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                await new Promise(res => setTimeout(res, guidonTurnDelay));
                if (shouldAbort()) throw new Error("aborted");
                console.log('[doMarch] Calling marchToElement for ABOUT FACE from LINE');
                await marchToElement(guidon, f2.elementCount - 1, f2, () => {
                  setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                  if (shouldAbort()) throw new Error("aborted");
                });
                f2.formation = "INVERSE_LINE";
              } else if (f2.formation === "INVERSE_LINE") {
                console.log('[doMarch] ABOUT FACE from INVERSE_LINE');
                setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                await new Promise(res => setTimeout(res, guidonTurnDelay));
                if (shouldAbort()) throw new Error("aborted");
                console.log('[doMarch] Calling marchToElement for ABOUT FACE from INVERSE_LINE');
                await marchToElement(guidon, 0, f2, () => {
                  setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
                  if (shouldAbort()) throw new Error("aborted");
                });
                f2.formation = "LINE";
              } else if (f2.formation === "COLUMN") {
                console.log('[doMarch] ABOUT FACE from COLUMN');
                f2.formation = "INVERSE_COLUMN";
              } else if (f2.formation === "INVERSE_COLUMN") {
                console.log('[doMarch] ABOUT FACE from INVERSE_COLUMN');
                f2.formation = "COLUMN";
              }
            }
            setFlight({ ...f2, members: f2.members.map(c => ({ ...c })) });
          } catch (e) {
            console.log('[doMarch] Exception:', e);
            // If aborted, do not update formation
          } finally {
            console.log('[doMarch] Finally block, setting commandInProgressRef to null');
            commandInProgressRef.current = null;
          }
        };
        console.log('[FACE] About to call doMarch with prepCmd:', prepCmd);
        doMarch(prepCmd);
        break;
      }
      case "HALT":
        setCurrentExecutionCommand("HALT");
        showPopupForBeats("HALT");
        pushExec("HALT");
        // Continue marching for 1 more beats before stopping
        const haltDelay = (60000 / flight.cadence.bpm);
        setTimeout(() => {
          setFlight((f) => ({ ...f, isMarching: false }));
        }, haltDelay);
        break;
      case "FALL-IN":
        setCurrentExecutionCommand("FALL-IN");
        showPopupForBeats("FALL-IN");
        pushExec("FALL-IN");
        setFallInMode(true);
        setFallInPreview(null);
        setFallInDir(0);
        break;
      case "ROTATE FALL-IN":
        setCurrentExecutionCommand("ROTATE FALL-IN");
        showPopupForBeats("ROTATE FALL-IN");
        pushExec("ROTATE FALL-IN");
        setFallInDir((d) => ((d + 90) % 360) as Direction);
        break;
    }
  }, [flight, fallInMode, showPopupForBeats]);

  // FALL-IN logic
  const handleFallIn = useCallback((center: {x: number, y: number}, dir: Direction) => {
    const f = createFlight(inputCount, elementCount, {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, center, dir, interval, distance);
    setFlight(f);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false, false, false]);
    setFallInMode(false);
    setFallInPreview(null);
  }, [inputCount, elementCount, interval, distance, MARCHING_AREA_SIZE]);

  // Initialize positions on mount or count/element change
  useEffect(() => {
    const f = createFlight(inputCount, elementCount, {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, undefined, 0, interval, distance);
    // Fix initial direction and position: guidon on right, flight facing up
    initPositions(f, elementCount, {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      areaWidth: MARCHING_AREA_SIZE,
      areaHeight: MARCHING_AREA_SIZE,
    }, undefined, 0, interval, distance);
    // Rotate all cadets to face up (0 degrees)
    f.members.forEach(c => { c.dir = 0; });
    setFlight(f);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false, false, false, false]);
  }, [inputCount, elementCount, interval, distance, MARCHING_AREA_SIZE]);

  // Marching animation
  useEffect(() => {
    if (!flight.isMarching) return;
    let timeoutId: number;
    function step() {
      setFlight((f) => {
        // Use cadence for step length
        const cadence = f.cadence;
        if (cadence.name == "Mark Time") return { ...f }; // Mark Time: no movement
        const newMembers = f.members.map((c) => {
          const step = cadence.stepLength;
          const rad = degToRad(c.dir);
          return {
            ...c,
            x: c.x + inchesToPixels(Math.sin(rad) * step),
            y: c.y - inchesToPixels(Math.cos(rad) * step),
          };
        });
        // Record the time of this step
        lastStepTimeRef.current = Date.now();
        return { ...f, members: newMembers };
      });
      timeoutId = window.setTimeout(step, 60000 / flight.cadence.bpm);
    }
    timeoutId = window.setTimeout(step, 60000 / flight.cadence.bpm);
    return () => clearTimeout(timeoutId);
  }, [flight.isMarching, flight.cadence, inchesToPixels]);

  // Boundary/score penalty
  useEffect(() => {
    const allInBounds = flight.isWithinBounds().every(Boolean);
    setBoundary(!allInBounds);
    if (prevInBoundsRef.current && !allInBounds) {
      setScore((s) => Math.max(0, s - 1));
    }
    prevInBoundsRef.current = allInBounds;
  }, [flight]);

  // Keyboard controls
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (showMenu) return;
      // Prevent spacebar from scrolling the page when used as a command key
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
      }
      if (fallInMode) {
        if (e.key === "r") {
          setFallInDir((d) => ((d + 90) % 360) as Direction);
        }
        if (e.key === "Escape") {
          // Always cancel fall-in state
          setFallInMode(false);
          setFallInPreview(null);
          showPopupForBeats("AS YOU WERE");
          return;
        }
      }
      const idx = COMMANDS.findIndex((cmd) => cmd.key === e.key);
      if (idx === -1) return;
      const uiCommand = COMMANDS[idx].label;
      const atomicSequence = UI_TO_ATOMIC[uiCommand];
      if (!atomicSequence) return;
      if (atomicSequence.length === 1) {
        handleCommand(atomicSequence[0]);
      } else {
        const [prep, exec] = atomicSequence;
        showPopupForBeats(prep);
        handleCommand(prep);
        const cadence = flight.cadence;
        const stepInterval = 60000 / cadence.bpm;
        setTimeout(() => {
          showPopupForBeats(exec);
          handleCommand(exec);
        }, 2 * stepInterval);
      }
    }
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flight, showMenu, fallInMode, showPopupForBeats, handleCommand]);

  // Mouse click for FALL-IN
  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!fallInMode) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFallInPreview({ x, y });
    showPopupForBeats("FALL IN");
    handleFallIn({ x, y }, fallInDir);
  }

  // Mouse move for preview
  function handleCanvasMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!fallInMode) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFallInPreview({ x, y });
  }

  // Helper for DebugMenu to send atomic commands
  const handleSendAtomicCommand = (cmd: string) => {
    handleCommand(cmd as AtomicCommand);
  };

  if (showMenu) {
    return (
      <Menu
        inputCount={inputCount}
        setInputCount={setInputCount}
        elementCount={elementCount}
        setElementCount={setElementCount}
        interval={interval}
        setInterval={setInterval}
        distance={distance}
        setDistance={setDistance}
        areaFeet={areaFeet}
        setAreaFeet={setAreaFeet}
        onStart={() => setShowMenu(false)}
      />
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-background transition-colors duration-300">
      {/* Top bar */}
      <div className="relative flex items-center justify-between w-full px-8 py-4 bg-semiBackground shadow-sm border-b border-border">
        {/* Commander popup (top left) */}
        <div className="absolute left-8 top-1/2 -translate-y-1/2 text-lg font-semibold text-blue-700 dark:text-blue-300 min-w-[220px]">
          {popupCommand && <span>COMMANDER: <span className="font-bold text-blue-600 dark:text-blue-400 animate-pulse">{popupCommand}</span></span>}
        </div>
        {/* Score (centered absolutely) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-foreground">
          Score: {score}
        </div>
        {/* Formation (top right) */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-right text-base font-medium text-blue-700 dark:text-blue-300">
          Formation: <span className="font-bold text-blue-600 dark:text-blue-400">{flight.formation.replace(/_/g, ' ')}</span>
        </div>
      </div>
      <div className="flex flex-1 w-full mx-auto py-8 px-8 gap-4">
        {/* Info/commands panel */}
        <aside className="w-[20%] min-w-[200px] max-w-xs flex flex-col gap-6">
          <div className="bg-semiBackground rounded-xl shadow p-6 border border-border">
            <h2 className="text-lg font-bold text-blue-700 dark:text-blue-300 mb-4">Marching Commands</h2>
            <ul className="flex flex-col gap-3">
              {COMMANDS.map((cmd, i) => (
                <li key={cmd.key}>
                  <button
                    type="button"
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded transition-colors w-full text-left",
                      commandStatus[i]
                        ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/60 hover:text-blue-900 dark:hover:text-blue-100"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 hover:text-blue-700 dark:hover:text-blue-200",
                      cmd.label === "FALL-IN" && fallInMode && "ring-2 ring-blue-500"
                    )}
                    aria-pressed={commandStatus[i]}
                    tabIndex={0}
                    onClick={() => {
                      const atomicSequence = UI_TO_ATOMIC[cmd.label];
                      if (!atomicSequence) return;
                      if (atomicSequence.length === 1) {
                        handleCommand(atomicSequence[0]);
                      } else {
                        const [prep, exec] = atomicSequence;
                        showPopupForBeats(prep);
                        handleCommand(prep);
                        const cadence = flight.cadence;
                        const stepInterval = 60000 / cadence.bpm;
                        setTimeout(() => {
                          showPopupForBeats(exec);
                          handleCommand(exec);
                        }, 2 * stepInterval);
                      }
                    }}
                  >
                    <span className="font-mono font-bold text-base w-8 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900">{cmd.key}</span>
                    <span className="font-medium">{cmd.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        {/* Simulator canvas */}
        <section className="flex-1 flex items-start justify-center">
          <div
            style={{ position: 'relative', width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
          >
            {fallInMode && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <span className="bg-blue-100/80 text-blue-700 px-4 py-2 rounded shadow font-semibold animate-pulse">Click to set guidon position</span>
              </div>
            )}
            <FlightCanvas
              cadets={flight.members}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              areaWidth={MARCHING_AREA_SIZE}
              areaHeight={MARCHING_AREA_SIZE}
              boundary={boundary}
              previewCadets={fallInMode && fallInPreview ? (() => {
                const f = createFlight(inputCount, elementCount, {
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT,
                  areaWidth: MARCHING_AREA_SIZE,
                  areaHeight: MARCHING_AREA_SIZE,
                }, fallInPreview, fallInDir, interval, distance);
                return f.members;
              })() : undefined}
              inchesToPixels={inchesToPixels}
            />
          </div>
        </section>
        {/* Notepad for command history and controls */}
        <aside className="w-[20%] min-w-[200px] max-w-xs flex flex-col gap-4 items-end">
          {/* Controls bar above notepad */}
          <div className="flex flex-col w-full items-end gap-2 mb-2">
            <span className={clsx("font-semibold text-sm px-2 py-1 rounded", boundary ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>{boundary ? "Boundary: OUT" : "Boundary: IN"}</span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded bg-blue-600 dark:bg-blue-700 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-800 transition"
                onClick={() => {
                  // Always re-initialize flight, even if inputCount/elementCount are unchanged
                  const f = createFlight(inputCount, elementCount, {
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT,
                    areaWidth: MARCHING_AREA_SIZE,
                    areaHeight: MARCHING_AREA_SIZE,
                  }, undefined, 0, interval, distance);
                  initPositions(f, elementCount, {
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT,
                    areaWidth: MARCHING_AREA_SIZE,
                    areaHeight: MARCHING_AREA_SIZE,
                  }, undefined, 0, interval, distance);
                  setFlight(f);
                  setScore(0);
                  setBoundary(false);
                  setCommandStatus([false, false, false, false, false, false, false, false, false]);
                  setShowMenu(true);
                }}
              >
                Reset
              </button>
              <button
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                onClick={() => setDebug((d) => !d)}
              >
                {debug ? "Hide Debug" : "Show Debug"}
              </button>
              <button
                className="px-3 py-1 rounded bg-yellow-400 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 font-semibold hover:bg-yellow-500 dark:hover:bg-yellow-600 transition"
                onClick={() => setShowTips((t) => !t)}
              >
                {showTips ? "Hide Tips" : "Show Tips"}
              </button>
            </div>
          </div>
          {/* Tips section */}
          {showTips && (
            <div className="w-full bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-xl shadow p-3 text-xs text-gray-700 dark:text-gray-100 mb-2">
              Use keys 1-6 to issue commands.<br />
              Marching continues until <b>FLIGHT HALT</b>.<br />
              <b>HALF STEPS</b> slows the march.<br />
              <b>LEFT/RIGHT/ABOUT FACE</b> rotate the flight.<br />
              If any cadet leaves the boundary, the indicator turns red.<br />
              <b>FALL-IN</b>: Click the field to set guidon position, or press FALL-IN again to fall in at the cursor.<br />
              <b>ROTATE FALL-IN</b>: Use before or during FALL-IN to adjust direction (press &apos;r&apos; or click the button).<br />
              <b>AS YOU WERE</b>: Cancels the FALL-IN process.
            </div>
          )}
          {/* Notepad for command history */}
          <div className="bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-xl shadow p-4 min-h-[300px] max-h-[500px] overflow-y-auto w-full">
            <h2 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2">Command Notepad</h2>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr>
                  <th className="text-left px-2">Preparatory</th>
                  <th className="text-left px-2">Execution</th>
                </tr>
              </thead>
              <tbody>
                {commandHistory.filter(row => row.prep !== "ROTATE FALL-IN" && row.exec !== "ROTATE FALL-IN").map((row, i) =>
                  row.status === 'asYouWere' ? (
                    <tr key={i}>
                      <td colSpan={2} className="px-2 py-1 text-blue-900 dark:text-blue-200 font-bold">AS YOU WERE</td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td className={
                        'px-2 py-1 ' +
                        (row.status === 'success' ? 'text-green-700 dark:text-green-300 font-bold' :
                          row.status === 'error' && row.prep ? 'text-red-600 dark:text-red-400 font-bold' :
                          '')
                      }>
                        {row.prep ?? ''}
                      </td>
                      <td className={
                        'px-2 py-1 ' +
                        (row.status === 'success' ? 'text-green-700 dark:text-green-300 font-bold' :
                          row.status === 'error' && row.exec ? 'text-red-600 dark:text-red-400 font-bold' :
                          '')
                      }>
                        {row.exec ?? ''}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {debug && (
            <DebugMenu
              flight={flight}
              debugMenuPos={debugMenuPos}
              onDebugMenuMouseDown={onDebugMenuMouseDown}
              currentCommand={currentCommand}
              currentPreparatoryCommand={currentPreparatoryCommand}
              currentExecutionCommand={currentExecutionCommand}
              ATOMIC_COMMANDS={ATOMIC_COMMANDS as unknown as string[]}
              onSendAtomicCommand={handleSendAtomicCommand}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
