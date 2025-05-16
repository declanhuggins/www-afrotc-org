import React, { useRef } from "react";
import { Flight } from "./commonLib";

interface DebugMenuProps {
  flight: Flight;
  debugMenuPos: { x: number; y: number };
  onDebugMenuMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  currentCommand: string | null;
  currentPreparatoryCommand: string | null;
  currentExecutionCommand: string | null;
  ATOMIC_COMMANDS: string[];
  onSendAtomicCommand: (cmd: string) => void;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({
  flight,
  debugMenuPos,
  onDebugMenuMouseDown,
  currentCommand,
  currentPreparatoryCommand,
  currentExecutionCommand,
  ATOMIC_COMMANDS,
  onSendAtomicCommand,
}) => {
  const debugMenuRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={debugMenuRef}
      style={{
        position: "absolute",
        top: debugMenuPos.y,
        left: debugMenuPos.x,
        zIndex: 1000,
        minWidth: 380, // widened from 320
        maxWidth: 480, // widened from 400
        cursor: "grab",
        boxShadow: "0 4px 24px 0 rgba(0,0,0,0.18)",
      }}
      className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow p-0 mt-2 select-none"
      aria-label="Debug Information"
    >
      <div
        className="w-full rounded-t-xl px-4 py-2 bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold text-base cursor-move"
        style={{ userSelect: "none" }}
        onMouseDown={onDebugMenuMouseDown}
      >
        Send Atomic Command (Debug)
      </div>
      <div className="p-4">
        <div className="mb-2 text-xs text-gray-700 dark:text-gray-200">
          <div>Current Command: <span className="font-mono font-bold">{currentCommand ?? "(none)"}</span></div>
          <div>Preparatory Command: <span className="font-mono font-bold">{currentPreparatoryCommand ?? "(none)"}</span></div>
          <div>Execution Command: <span className="font-mono font-bold">{currentExecutionCommand ?? "(none)"}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ATOMIC_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              className="px-2 py-1 rounded bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 font-mono text-xs hover:bg-blue-300 dark:hover:bg-blue-600 transition"
              onClick={() => onSendAtomicCommand(cmd)}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-3 text-primary px-4">Cadet Debug Info</h3>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-background text-secondary font-bold">
              <th className="px-2 py-1 border-b border-border text-left">#</th>
              <th className="px-2 py-1 border-b border-border text-left">Guidon</th>
              <th className="px-2 py-1 border-b border-border text-left">Rank</th>
              <th className="px-2 py-1 border-b border-border text-left">Element</th>
              <th className="px-2 py-1 border-b border-border text-left">X</th>
              <th className="px-2 py-1 border-b border-border text-left">Y</th>
              <th className="px-2 py-1 border-b border-border text-left">In Bounds</th>
              <th className="px-2 py-1 border-b border-border text-left">Dir</th>
            </tr>
          </thead>
          <tbody>
            {flight.members.map((c, i) => (
              <tr
                key={i}
                className={
                  i % 2 === 0
                    ? "bg-semiBackground"
                    : "bg-background"
                }
              >
                <td className="px-2 py-1 border-b border-border">{i + 1}</td>
                <td className="px-2 py-1 border-b border-border">{c.isGuidon ? 'Yes' : ''}</td>
                <td className="px-2 py-1 border-b border-border">{c.rank + 1}</td>
                <td className="px-2 py-1 border-b border-border">{c.element + 1}</td>
                <td className="px-2 py-1 border-b border-border">{c.x.toFixed(1)}</td>
                <td className="px-2 py-1 border-b border-border">{c.y.toFixed(1)}</td>
                <td
                  className={
                    "px-2 py-1 border-b border-border font-semibold " +
                    (flight.isWithinBounds()[i]
                      ? "text-green-500"
                      : "text-red-500")
                  }
                >
                  {flight.isWithinBounds()[i] ? 'Yes' : 'No'}
                </td>
                <td className="px-2 py-1 border-b border-border">{c.dir}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
