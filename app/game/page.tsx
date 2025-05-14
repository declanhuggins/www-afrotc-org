"use client";
import { useState, useEffect, useRef } from "react";

// Marching Simulator constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 800;
const SIMULATED_FEET = 25;
const MARCHING_AREA_WIDTH = SCREEN_WIDTH * 0.7;
const MARCHING_AREA_HEIGHT = SCREEN_HEIGHT * 0.7;
const STEP_SIZE = MARCHING_AREA_WIDTH / SIMULATED_FEET;
const CADET_RADIUS = 14;
const GUIDON_RADIUS = 18;
const COMMANDS = [
  { key: "1", label: "LEFT FACE" },
  { key: "2", label: "RIGHT FACE" },
  { key: "3", label: "ABOUT FACE" },
  { key: "4", label: "FORWARD MARCH" },
  { key: "5", label: "FLIGHT HALT" },
  { key: "6", label: "HALF STEPS" },
];

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// Types
interface Cadet {
  x: number;
  y: number;
  dir: number; // degrees, 0=North
  isGuidon: boolean;
  rank: number; // 0-based rank (row)
  element: number; // 0-based element (column)
}

interface Flight {
  members: Cadet[];
  formation: Formation;
  isMarching: boolean;
  halfSteps: boolean;
  elementCount: number;
  isWithinBounds: () => boolean[];
}

type Formation = "LINE" | "COLUMN" | "INVERSE_LINE" | "INVERSE_COLUMN";
type Command = typeof COMMANDS[number]["label"];

function createFlight(count: number, elementCount: number): Flight {
  count = clamp(count, 1, 22);
  const members: Cadet[] = [];
  for (let i = 0; i < count; ++i) {
    members.push({ x: 0, y: 0, dir: -90, isGuidon: i === 0, rank: 0, element: 0 });
  }
  const flight: Flight = {
    members,
    formation: "LINE",
    isMarching: false,
    halfSteps: false,
    elementCount,
    isWithinBounds: function () {
      const minX = (SCREEN_WIDTH - MARCHING_AREA_WIDTH) / 2;
      const maxX = minX + MARCHING_AREA_WIDTH;
      const minY = (SCREEN_HEIGHT - MARCHING_AREA_HEIGHT) / 2;
      const maxY = minY + MARCHING_AREA_HEIGHT;
      // Return array of booleans for each cadet
      return this.members.map(
        (c) => c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY
      );
    },
  };
  return flight;
}

function initPositions(f: Flight, elements: number) {
  // New fall-in: guidon is cadet 1 at [0][0], facing up, rest fill left to right, top to bottom
  const count = f.members.length;
  const ranks = Math.ceil((count - 1) / elements) + 1;
  // Build empty grid
  const grid: (number | null)[][] = Array.from({ length: ranks }, () => Array(elements).fill(null));
  // Place guidon (cadet 1) at [0][0]
  grid[0][0] = 0;
  // Fill cadets left to right, top to bottom, skipping guidon
  let idx = 1;
  for (let r = 1; r < ranks; r++) {
    for (let c = elements - 1; c >= 0; c--) {
      if (idx >= f.members.length) break;
      grid[r][c] = idx;
      idx++;
    }
  }
  // Calculate grid size
  const spacing = STEP_SIZE * 2;
  const totalW = spacing * (elements - 1);
  const totalH = spacing * (ranks - 1);
  const startX = (SCREEN_WIDTH - MARCHING_AREA_WIDTH) / 2 + (MARCHING_AREA_WIDTH - totalW) / 2;
  const startY = (SCREEN_HEIGHT - MARCHING_AREA_HEIGHT) / 2 + (MARCHING_AREA_HEIGHT - totalH) / 2;
  // Assign positions and rank/element
  for (let r = 0; r < ranks; r++) {
    for (let c = 0; c < elements; c++) {
      const idx = grid[r][c];
      if (typeof idx === "number") {
        f.members[idx].x = startX + c * spacing;
        f.members[idx].y = startY + r * spacing;
        f.members[idx].dir = -90;
        f.members[idx].rank = r;
        f.members[idx].element = c;
      }
    }
  }
}

function moveForward(cadet: Cadet, steps: number, halfStep: boolean) {
  // Use a fixed step size (STEP_SIZEpx per step)
  const step = halfStep ? STEP_SIZE/2 : STEP_SIZE;
  // Fix: 0 deg = up, so y -= step
  const rad = degToRad(cadet.dir);
  cadet.x += Math.sin(rad) * step * steps;
  cadet.y -= Math.cos(rad) * step * steps;
}

function rotate(cadet: Cadet, deg: number) {
  cadet.dir += deg;
}

export default function GamePage() {
  // State
  const [flight, setFlight] = useState<Flight>(() => createFlight(10, 3));
  const [score, setScore] = useState(0);
  const [boundary, setBoundary] = useState(false);
  const [commandStatus, setCommandStatus] = useState<boolean[]>([false, false, false, false, false, false]);
  const [inputCount, setInputCount] = useState(10);
  const [elementCount, setElementCount] = useState(3);
  const [showMenu, setShowMenu] = useState(true);
  const [debug, setDebug] = useState(false);
  const requestRef = useRef<number | undefined>(undefined);

  // Track previous in-bounds state for penalty logic
  const prevInBoundsRef = useRef(true);

  // New: State for command popup
  const [popupCommand, setPopupCommand] = useState<string | null>(null);
  // New: Timer ref for popup
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize positions on mount or count/element change
  useEffect(() => {
    const f = createFlight(inputCount, elementCount);
    initPositions(f, elementCount);
    setFlight(f);
    setScore(0);
    setBoundary(false);
    setCommandStatus([false, false, false, false, false, false]);
  }, [inputCount, elementCount]);

  // Marching animation (STEP_SIZEpx per 500ms)
  useEffect(() => {
    if (!flight.isMarching) return;
    let animId: number;
    function step() {
      setFlight((f) => {
        const f2 = {
          ...f,
          members: f.members.map((c) => ({ ...c })),
        };
        for (const c of f2.members) moveForward(c, 1, f.halfSteps);
        return f2;
      });
      // Always check the latest flight state for boundary
      setBoundary((prev) => {
        // Use the latest flight after movement
        const latest = flight.isWithinBounds().every(Boolean);
        return !latest;
      });
      animId = window.setTimeout(step, 500);
    }
    animId = window.setTimeout(step, 500);
    return () => clearTimeout(animId);
  }, [flight.isMarching, flight.halfSteps, flight]);

  // Also update boundary status and handle point penalty on any flight change (not just marching)
  useEffect(() => {
    const allInBounds = flight.isWithinBounds().every(Boolean);
    setBoundary(!allInBounds);
    if (prevInBoundsRef.current && !allInBounds) {
      // Just left bounds, subtract a point
      setScore((s) => Math.max(0, s - 1));
    }
    prevInBoundsRef.current = allInBounds;
  }, [flight]);

  // Keyboard controls
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (showMenu) return;
      const idx = COMMANDS.findIndex((cmd) => cmd.key === e.key);
      if (idx === -1) return;
      handleCommand(COMMANDS[idx].label as Command, idx);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flight, showMenu, commandStatus, boundary]);

  function handleCommand(cmd: Command, idx: number) {
    // Show popup for 1.2s
    setPopupCommand(cmd);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => setPopupCommand(null), 1200);

    let animId: number;
    // Always allow command execution, but only count for points if all in bounds
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
    // Always execute the command logic
    switch (cmd) {
      case "FORWARD MARCH":
        if (!flight.isMarching || flight.halfSteps) {
          setFlight((f) => ({ ...f, isMarching: true, halfSteps: false }));
        }
        break;
      case "FLIGHT HALT":
        if (flight.isMarching) {
          // Take two more steps, then halt
          setTimeout(() => {
            setFlight((f) => {
              const f2 = { ...f, members: f.members.map((c) => ({ ...c })) };
              for (const c of f2.members) moveForward(c, 1, f.halfSteps);
              return { ...f2, isMarching: false };
            });
          }, 500);
        }
        break;
      case "HALF STEPS":
        if (flight.isMarching && !flight.halfSteps) {
          setFlight((f) => ({ ...f, halfSteps: true }));
        }
        break;
      case "RIGHT FACE":
        if (!flight.isMarching) {
          setFlight((f) => {
            const f2 = { ...f, members: f.members.map((c) => ({ ...c })) };
            const guidon = f2.members[0];
            if (f2.formation === "LINE") {
              // All cadets turn right
              for (const c of f2.members) rotate(c, 90);
              // Guidon turns right again
              rotate(guidon, 90);
              // Guidon steps to last element
              for (let i = 0; i < f2.elementCount - 1; i++) moveForward(guidon, 2, false);
              // Guidon turns left
              rotate(guidon, -90);
              // Flight is now in COLUMN
              f2.formation = "COLUMN";
            } else if (f2.formation === "COLUMN") {
              // All cadets turn right
              for (const c of f2.members) rotate(c, 90);
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              // All cadets turn right
              for (const c of f2.members) rotate(c, 90);
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              // All cadets turn right
              for (const c of f2.members) rotate(c, 90);
              // Guidon steps to first element
              for (let i = 0; i < f2.elementCount - 1; i++) moveForward(guidon, 2, false);
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
            if (f2.formation === "LINE") {
              // All cadets turn left
              for (const c of f2.members) rotate(c, -90);
              // Guidon turns left again
              rotate(guidon, -90);
              // Guidon steps to last element
              for (let i = 0; i < f2.elementCount - 1; i++) moveForward(guidon, 2, false);
              // Guidon turns right
              rotate(guidon, 90);
              // Flight is now in INVERSE_COLUMN
              f2.formation = "INVERSE_COLUMN";
            } else if (f2.formation === "INVERSE_COLUMN") {
              // All cadets turn left
              for (const c of f2.members) rotate(c, -90);
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              // All cadets turn left
              for (const c of f2.members) rotate(c, -90);
              f2.formation = "COLUMN";
            } else if (f2.formation === "COLUMN") {
              // All cadets turn left
              for (const c of f2.members) rotate(c, -90);
              // Guidon steps to first element
              for (let i = 0; i < f2.elementCount - 1; i++) moveForward(guidon, 2, false);
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
            // All cadets turn 180
            for (const c of f2.members) rotate(c, 180);
            if (f2.formation === "LINE") {
              // Guidon steps to last element
              for (let i = 0; i < f2.elementCount - 1; i++) moveForward(guidon, 2, false);
              f2.formation = "INVERSE_LINE";
            } else if (f2.formation === "INVERSE_LINE") {
              // Guidon steps to first element
              for (let i = 0; i < f2.elementCount - 1; i++) moveForward(guidon, 2, false);
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
    }
  }

  // Drawing
  function drawFlight(ctx: CanvasRenderingContext2D) {
    // Draw boundary
    const minX = (SCREEN_WIDTH - MARCHING_AREA_WIDTH) / 2;
    const minY = (SCREEN_HEIGHT - MARCHING_AREA_HEIGHT) / 2;
    ctx.strokeStyle = "#f00";
    ctx.lineWidth = 3;
    ctx.strokeRect(minX, minY, MARCHING_AREA_WIDTH, MARCHING_AREA_HEIGHT);
    // Draw cadets
    for (const cadet of flight.members) {
      ctx.save();
      ctx.translate(cadet.x, cadet.y);
      ctx.rotate(degToRad(cadet.dir));
      if (cadet.isGuidon) {
        ctx.fillStyle = "gold";
        ctx.beginPath();
        ctx.moveTo(0, -GUIDON_RADIUS);
        ctx.lineTo(GUIDON_RADIUS, GUIDON_RADIUS);
        ctx.lineTo(-GUIDON_RADIUS, GUIDON_RADIUS);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "#0074D9";
        ctx.beginPath();
        ctx.arc(0, 0, CADET_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -CADET_RADIUS - 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawFlight(ctx);
  }, [flight, boundary, showMenu]);

  // Debug menu
  const debugMenu = debug && (
    <div style={{ background: '#222', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, maxWidth: 600 }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Cadet Debug Info</h3>
      <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Guidon</th>
            <th>Rank</th>
            <th>Element</th>
            <th>X</th>
            <th>Y</th>
            <th>In Bounds</th>
          </tr>
        </thead>
        <tbody>
          {flight.members.map((c, i) => (
            <tr key={i} style={{ background: i % 2 ? '#333' : '#222' }}>
              <td>{i + 1}</td>
              <td>{c.isGuidon ? 'Yes' : ''}</td>
              <td>{c.rank + 1}</td>
              <td>{c.element + 1}</td>
              <td>{c.x.toFixed(1)}</td>
              <td>{c.y.toFixed(1)}</td>
              <td style={{ color: flight.isWithinBounds()[i] ? 'lime' : 'red' }}>{flight.isWithinBounds()[i] ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // UI
  if (showMenu) {
    return (
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <h1>Marching Simulator</h1>
        <label>
          Number of personnel (1-22):
          <input
            type="number"
            min={1}
            max={22}
            value={inputCount}
            onChange={(e) => setInputCount(clamp(Number(e.target.value), 1, 22))}
            style={{ marginLeft: 8, width: 60 }}
          />
        </label>
        <label style={{ marginTop: 12 }}>
          Number of elements (1-10):
          <input
            type="number"
            min={1}
            max={10}
            value={elementCount}
            onChange={(e) => setElementCount(clamp(Number(e.target.value), 1, 10))}
            style={{ marginLeft: 8, width: 60 }}
          />
        </label>
        <button style={{ marginTop: 16, fontSize: 18 }} onClick={() => setShowMenu(false)}>
          Start Simulation
        </button>
      </main>
    );
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <h1>Marching Simulator</h1>
      <button style={{ marginBottom: 8 }} onClick={() => setDebug((d) => !d)}>
        {debug ? "Hide Debug" : "Show Debug"}
      </button>
      {debugMenu}
      <canvas
        ref={canvasRef}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={{ border: "1px solid #ccc", background: boundary ? "#ffeaea" : "#f8f8f8", marginBottom: 16 }}
      />
      <div style={{ display: "flex", gap: 24, marginBottom: 8, alignItems: 'center' }}>
        <span>Score: {score}</span>
        <span style={{ color: boundary ? "red" : "green" }}>
          {boundary ? "Boundary: OUT" : "Boundary: IN"}
        </span>
        <span style={{ color: '#333', fontWeight: 500 }}>
          Formation: {flight.formation.replace(/_/g, ' ')}
        </span>
      </div>
      {popupCommand && (
        <div style={{
          background: '#222',
          color: '#fff',
          padding: '10px 24px',
          borderRadius: 8,
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 10,
          boxShadow: '0 2px 12px #0003',
          letterSpacing: 1,
          zIndex: 10,
          animation: 'fadein 0.2s',
        }}>
          Flight Commander: {popupCommand}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        {COMMANDS.map((cmd, i) => (
          <span key={cmd.key} style={{ marginRight: 16, color: commandStatus[i] ? "green" : "#888" }}>
            [{cmd.key}] {cmd.label}
          </span>
        ))}
      </div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => setShowMenu(true)} style={{ fontSize: 16 }}>
          Reset
        </button>
      </div>
      <div style={{ fontSize: 14, color: "#666" }}>
        Use keys 1-6 to issue commands. Marching continues until "FLIGHT HALT".<br />
        "HALF STEPS" slows the march. "LEFT/RIGHT/ABOUT FACE" rotate the flight.<br />
        If any cadet leaves the boundary, the boundary indicator turns red.
      </div>
    </main>
  );
}
