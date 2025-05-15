import React from "react";
import { clamp } from "./lib";

interface MenuProps {
  inputCount: number;
  setInputCount: (n: number) => void;
  elementCount: number;
  setElementCount: (n: number) => void;
  interval: number;
  setInterval: (n: number) => void;
  distance: number;
  setDistance: (n: number) => void;
  areaFeet: number;
  setAreaFeet: (n: number) => void;
  onStart: () => void;
}

export const Menu: React.FC<MenuProps> = ({ inputCount, setInputCount, elementCount, setElementCount, interval, setInterval, distance, setDistance, areaFeet, setAreaFeet, onStart }) => (
  <main className="flex flex-col min-h-screen bg-background transition-colors duration-300 items-center justify-center">
    <div className="bg-semiBackground rounded-2xl shadow-xl border border-border px-10 py-12 flex flex-col items-center gap-8 w-full max-w-md">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-2">Marching Simulator</h1>
      <div className="flex flex-col gap-4 w-full">
        <label className="flex flex-col gap-1 text-foreground font-medium">
          Number of cadets (1-22):
          <input
            type="number"
            min={1}
            max={22}
            value={inputCount}
            onChange={(e) => setInputCount(clamp(Number(e.target.value), 1, 22))}
            className="mt-1 px-3 py-2 rounded border border-border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ width: 100 }}
          />
        </label>
        <label className="flex flex-col gap-1 text-foreground font-medium">
          Number of elements (1-10):
          <input
            type="number"
            min={1}
            max={10}
            value={elementCount}
            onChange={(e) => setElementCount(clamp(Number(e.target.value), 1, 10))}
            className="mt-1 px-3 py-2 rounded border border-border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ width: 100 }}
          />
        </label>
        <label className="flex flex-col gap-1 text-foreground font-medium">
          Interval (side-to-side, inches):
          <input
            type="number"
            min={0}
            max={60}
            value={interval}
            onChange={(e) => setInterval(clamp(Number(e.target.value), 0, 60))}
            className="mt-1 px-3 py-2 rounded border border-border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ width: 100 }}
          />
        </label>
        <label className="flex flex-col gap-1 text-foreground font-medium">
          Distance (front-to-back, inches):
          <input
            type="number"
            min={0}
            max={60}
            value={distance}
            onChange={(e) => setDistance(clamp(Number(e.target.value), 0, 60))}
            className="mt-1 px-3 py-2 rounded border border-border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ width: 100 }}
          />
        </label>
        <label className="flex flex-col gap-1 text-foreground font-medium">
          Marching Area Size (feet):
          <input
            type="number"
            min={10}
            max={50}
            value={areaFeet}
            onChange={(e) => setAreaFeet(Math.max(10, Math.min(50, Number(e.target.value))))}
            className="mt-1 px-3 py-2 rounded border border-border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ width: 100 }}
          />
        </label>
      </div>
      <button
        className="mt-4 px-6 py-3 rounded-lg bg-blue-600 dark:bg-blue-700 text-white font-semibold text-lg shadow hover:bg-blue-700 dark:hover:bg-blue-800 transition"
        onClick={onStart}
      >
        Start Simulation
      </button>
    </div>
  </main>
);
