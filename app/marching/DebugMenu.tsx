import React from "react";
import { Flight } from "./lib";

interface DebugMenuProps {
  flight: Flight;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ flight }) => (
  <div
    className="z-10 bg-semiBackground border border-border rounded-xl p-4 mb-4 max-w-2xl shadow-md"
    aria-label="Debug Information"
  >
    <h3 className="text-lg font-semibold mb-3 text-primary">Cadet Debug Info</h3>
    <div className="overflow-x-auto">
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
