"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";
import { createFlight, initPositions, moveForward, rotate, marchToElement, Flight, Command, Direction, degToRad, CADENCES, setInchesToPixels, getInchesToPixels } from "./lib";
import { FlightCanvas } from "./FlightCanvas";
import { DebugMenu } from "./DebugMenu";
import { Menu } from "./Menu";

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 800;
const DEFAULT_INTERVAL = 35; // inches
const DEFAULT_DISTANCE = 30; // inches;
const DEFAULT_AREA_FEET = 25; // feet
const DEFAULT_INPUT_COUNT = 13;
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

export default function MarchingPage() {
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [distance, setDistance] = useState(DEFAULT_DISTANCE);
  const [areaFeet, setAreaFeet] = useState(DEFAULT_AREA_FEET);
  const [inputCount, setInputCount] = useState(DEFAULT_INPUT_COUNT);
  const [elementCount, setElementCount] = useState(3);
  const [showTips, setShowTips] = useState(false);
  // Marching area is always a square
  const MARCHING_AREA_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;
  // Conversion: inches to pixels for current area size
  const inchesToPixels = useCallback((inches: number) => (MARCHING_AREA_SIZE / (areaFeet * 12)) * inches, [MARCHING_AREA_SIZE, areaFeet]);

  // Set global inchesToPixels on mount and whenever areaFeet changes (reset)
  useEffect(() => {
    setInchesToPixels(inchesToPixels);
  }, [areaFeet, MARCHING_AREA_SIZE, inchesToPixels]);

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
  // Track command history
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  // Memoized handleCommand
  const handleCommand = useCallback((cmd: Command, idx: number) => {
    setCommandHistory((hist) => [...hist, cmd]);
    setPopupCommand(cmd);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
    const allInBounds = flight.isWithinBounds().every(Boolean);
    let valid = true;
    if ((flight.isMarching && ["LEFT FACE", "RIGHT FACE", "ABOUT FACE"].includes(cmd)) ||
        (!flight.isMarching && ["HALF STEPS", "FLIGHT HALT"].includes(cmd))) {
      valid = false;
    }
    if (valid && allInBounds && !commandStatus[idx]) {
      setCommandStatus((s) => {
        const arr = [...s];
        arr[idx] = true;
        return arr;
      });
      setScore((s) => s + 1);
    }
    switch (cmd) {
      case "FORWARD MARCH":
        if (!flight.isMarching) {
          setFlight((f) => ({ ...f, isMarching: true, cadence: CADENCES["Quick Time"] }));
        }
        break;
      case "FLIGHT HALT":
        if (flight.isMarching) {
          setFlight((f) => ({ ...f, isMarching: false }));
          // Calculate timing for extra steps
          const cadence = flight.cadence;
          const stepInterval = 60000 / cadence.bpm;
          const now = Date.now();
          const lastStep = lastStepTimeRef.current ?? now;
          const sinceLastStep = now - lastStep;
          const firstDelay = Math.max(0, stepInterval - sinceLastStep);
          const secondDelay = firstDelay + stepInterval;
          const doExtraStep = () => {
            setFlight((f) => {
              const f2 = { ...f, members: f.members.map((c) => ({ ...c })) };
              for (const c of f2.members) moveForward(c, 1, cadence.stepLength);
              return f2;
            });
          };
          setTimeout(doExtraStep, firstDelay);
          setTimeout(doExtraStep, secondDelay);
        }
        break;
      case "HALF STEPS":
        if (flight.isMarching && flight.cadence !== CADENCES["Half Step"]) {
          // Calculate timing for cadence change to take effect after the next step
          const cadence = flight.cadence;
          const stepInterval = 60000 / cadence.bpm;
          const now = Date.now();
          const lastStep = lastStepTimeRef.current ?? now;
          const sinceLastStep = now - lastStep;
          const delayToNextStep = Math.max(0, stepInterval - sinceLastStep);
          setTimeout(() => {
            setFlight((f) => ({ ...f, cadence: CADENCES["Half Step"] }));
          }, delayToNextStep);
        }
        break;
      case "RIGHT FACE":
        if (!flight.isMarching) {
          setFlight((f) => {
            const f2 = { ...f, members: f.members.map((c) => ({ ...c })) };
            const guidon = f2.members[0];
            for (const c of f2.members) rotate(c, 90);
            if (f2.formation === "LINE") {
              rotate(guidon, 90);
              // March guidon from element 1 to last element
              marchToElement(guidon, f2.elementCount - 1, f2);
              rotate(guidon, -90);
              f2.formation = "COLUMN";
            } else if (f2.formation === "COLUMN") {
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              marchToElement(guidon, 0, f2);
              f2.formation = "LINE";
            }
            return f2;
          });
        }
        break;
      case "LEFT FACE":
        if (!flight.isMarching) {
          setFlight((f) => {
            const f2 = { ...f, members: f.members.map((c) => ({ ...c })) };
            const guidon = f2.members[0];
            for (const c of f2.members) rotate(c, -90);
            if (f2.formation === "LINE") {
              rotate(guidon, -90);
              // March guidon from element 0 to last element (rightmost to leftmost)
              marchToElement(guidon, f2.elementCount - 1, f2);
              rotate(guidon, 90);
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              f2.formation = "COLUMN";
            } else if (f2.formation === "COLUMN") {
              marchToElement(guidon, 0, f2);
              f2.formation = "LINE";
            }
            return f2;
          });
        }
        break;
      case "ABOUT FACE":
        if (!flight.isMarching) {
          setFlight((f) => {
            const f2 = { ...f, members: f.members.map((c) => ({ ...c })) };
            const guidon = f2.members[0];
            for (const c of f2.members) rotate(c, 180);
            if (f2.formation === "LINE") {
              marchToElement(guidon, f2.elementCount - 1, f2);
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              marchToElement(guidon, 0, f2);
              f2.formation = "LINE";
            } else if (f2.formation === "COLUMN") {
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              f2.formation = "COLUMN";
            }
            return f2;
          });
        }
        break;
      case "AS YOU WERE":
        if (fallInMode) {
          setFallInMode(false);
          setFallInPreview(null);
          setPopupCommand("AS YOU WERE");
          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
          popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
        }
        break;
    }
  }, [flight, commandStatus, fallInMode]);

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
        // Use cadence for step length and inPlace
        const cadence = f.cadence;
        if (cadence.inPlace) return { ...f }; // Mark Time: no movement
        const newMembers = f.members.map((c) => {
          const step = cadence.stepLength;
          const rad = degToRad(c.dir);
          return {
            ...c,
            x: c.x + getInchesToPixels()(Math.sin(rad) * step),
            y: c.y - getInchesToPixels()(Math.cos(rad) * step),
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
  }, [flight.isMarching, flight.cadence]);

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
          setPopupCommand("AS YOU WERE");
          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
          popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
          return;
        }
      }
      const idx = COMMANDS.findIndex((cmd) => cmd.key === e.key);
      if (idx === -1) return;
      if (COMMANDS[idx].label === "FALL-IN") {
        if (!fallInMode) {
          setPopupCommand("FLIGHT");
          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
          popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
          setFallInMode(true);
          setFallInPreview(null);
          setFallInDir(0);
          return;
        }
        // If in fall-in mode, allow FALL IN even if no preview (default to center)
        setPopupCommand("FALL IN");
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
        const center = fallInPreview || { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
        handleFallIn(center, fallInDir);
        return;
      }
      if (COMMANDS[idx].label === "AS YOU WERE") {
        // Always cancel fall-in state
        setFallInMode(false);
        setFallInPreview(null);
        setPopupCommand("AS YOU WERE");
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
        return;
      }
      handleCommand(COMMANDS[idx].label as Command, idx);
    }
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flight, showMenu, commandStatus, boundary, handleCommand, fallInMode, fallInPreview, fallInDir, handleFallIn]);

  // Mouse click for FALL-IN
  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!fallInMode) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFallInPreview({ x, y });
    setPopupCommand("FALL IN");
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
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
                      if (cmd.label === "FALL-IN") {
                        if (!fallInMode) {
                          setPopupCommand("FLIGHT");
                          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
                          popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
                          setFallInMode(true);
                          setFallInPreview(null);
                          setFallInDir(0);
                          return;
                        }
                        // If in fall-in mode, allow FALL IN even if no preview (default to center)
                        setPopupCommand("FALL IN");
                        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
                        popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
                        const center = fallInPreview || { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
                        handleFallIn(center, fallInDir);
                        return;
                      }
                      if (cmd.label === "ROTATE FALL-IN") {
                        setFallInDir((d) => ((d + 90) % 360) as Direction);
                        return;
                      }
                      if (cmd.label === "AS YOU WERE") {
                        // Always cancel fall-in state
                        setFallInMode(false);
                        setFallInPreview(null);
                        setPopupCommand("AS YOU WERE");
                        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
                        popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);
                        return;
                      }
                      handleCommand(cmd.label as Command, i);
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
            <ul className="flex flex-col gap-1">
              {commandHistory.map((cmd, i) => (
                <li key={i} className="text-sm text-yellow-900 dark:text-yellow-100 font-mono whitespace-pre">
                  {cmd}
                </li>
              ))}
            </ul>
          </div>
          {debug && <DebugMenu flight={flight} />}
        </aside>
      </div>
    </main>
  );
}
