"use client";
import React, { useEffect } from "react";
import clsx from "clsx";
import { DEFAULT_SCREEN_WIDTH, DEFAULT_SCREEN_HEIGHT } from "./commonLib";
import { createFlightLogic } from "./flightLogic";
import { ATOMIC_COMMANDS, UI_TO_ATOMIC, COMMANDS, useMarchingState } from "./commandLogic";
import { setPixelsToInches } from "./commonLib";
import { FlightCanvas } from "./FlightCanvas";
import { DebugMenu } from "./DebugMenu";
import { Menu } from "./Menu";
import { useDraggablePosition } from "./commonLib";

export default function MarchingPage() {
  const {
    flight,
    score,
    boundary,
    commandStatus,
    showMenu,
    setShowMenu,
    debug,
    popupCommand,
    fallInMode,
    fallInDir,
    fallInPreview,
    commandHistory,
    currentCommand,
    currentPreparatoryCommand,
    currentExecutionCommand,
    handleCommand,
    handleCanvasClick,
    handleCanvasMove,
    handleSendAtomicCommand,
    resetFlight,
    toggleDebug,
    showTips,
    toggleTips,
    inputCount,
    setInputCount,
    elementCount,
    setElementCount,
    interval,
    setInterval,
    distance,
    setDistance,
    areaFeet,
    setAreaFeet,
    inchesToPixels,
    MARCHING_AREA_SIZE,
    handleKeyDown, // <-- Add this to the destructure from useMarchingState
  } = useMarchingState();

  // Conversion: inches to pixels and pixels to inches for current area size
  useEffect(() => {
    setPixelsToInches((pixels) => (areaFeet * 12 / MARCHING_AREA_SIZE) * pixels);
  }, [areaFeet, MARCHING_AREA_SIZE]);

  // Draggable debug menu state and logic
  const [debugMenuPosState, handleDebugMenuMouseDown] = useDraggablePosition({ x: 100, y: 100 }, debug);

  // Mouse click for FALL-IN
  function handleCanvasClickWrapper(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    handleCanvasClick(e);
  }

  // Mouse move for preview
  function handleCanvasMoveWrapper(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    handleCanvasMove(e);
  }

  // Keyboard event handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      handleKeyDown?.(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleKeyDown]);

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
        onStart={() => {
          // When starting, fall in the flight with the chosen parameters
          resetFlight();
          setShowMenu(false);
        }}
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
                        ? "bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-800/60 hover:text-green-900 dark:hover:text-green-100"
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
                        handleCommand(prep);
                        const cadence = flight.cadence;
                        const stepInterval = 60000 / cadence.bpm;
                        setTimeout(() => {
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
            style={{ position: 'relative', width: DEFAULT_SCREEN_WIDTH, height: DEFAULT_SCREEN_HEIGHT }}
            onClick={handleCanvasClickWrapper}
            onMouseMove={handleCanvasMoveWrapper}
          >
            {fallInMode && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <span className="bg-blue-100/80 text-blue-700 px-4 py-2 rounded shadow font-semibold animate-pulse">Click to set guidon position</span>
              </div>
            )}
            <FlightCanvas
              cadets={flight.members}
              width={DEFAULT_SCREEN_WIDTH}
              height={DEFAULT_SCREEN_HEIGHT}
              areaWidth={MARCHING_AREA_SIZE}
              areaHeight={MARCHING_AREA_SIZE}
              boundary={boundary}
              previewCadets={fallInMode && fallInPreview ? (() => {
                const f = createFlightLogic(inputCount, elementCount, {
                  width: DEFAULT_SCREEN_WIDTH,
                  height: DEFAULT_SCREEN_HEIGHT,
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
                onClick={() => resetFlight()}
              >
                Reset
              </button>
              <button
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                onClick={toggleDebug}
              >
                {debug ? "Hide Debug" : "Show Debug"}
              </button>
              <button
                className="px-3 py-1 rounded bg-yellow-400 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 font-semibold hover:bg-yellow-500 dark:hover:bg-yellow-600 transition"
                onClick={() => toggleTips()}
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
                {commandHistory
                  .filter(row => row.prep !== "ROTATE FALL-IN" && row.exec !== "ROTATE FALL-IN")
                  .slice().reverse()
                  .map((row, i) =>
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
              debugMenuPos={debugMenuPosState}
              onDebugMenuMouseDown={handleDebugMenuMouseDown}
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
