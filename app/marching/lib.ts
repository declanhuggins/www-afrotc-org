// Marching simulation types and logic

export interface Cadet {
  x: number;
  y: number;
  dir: number; // degrees, 0=North
  isGuidon: boolean;
  rank: number; // 0-based rank (row)
  element: number; // 0-based element (column)
}

export type Formation = "LINE" | "COLUMN" | "INVERSE_LINE" | "INVERSE_COLUMN";

export type Direction = 0 | 90 | 180 | 270; // 0=up, 90=right, 180=down, 270=left

export function getDirectionVector(dir: Direction) {
  switch (dir) {
    case 0: return { dx: 0, dy: -1 };
    case 90: return { dx: 1, dy: 0 };
    case 180: return { dx: 0, dy: 1 };
    case 270: return { dx: -1, dy: 0 };
    default: return { dx: 0, dy: -1 };
  }
}

export interface Cadence {
  name: string;
  bpm: number;
  stepLength: number; // in inches
  inPlace?: boolean;
}

export const CADENCES: Record<string, Cadence> = {
  "Quick Time": { name: "Quick Time", bpm: 120, stepLength: 24 },
  "Double Time": { name: "Double Time", bpm: 180, stepLength: 30 },
  "Mark Time": { name: "Mark Time", bpm: 120, stepLength: 0, inPlace: true },
  "Half Step": { name: "Half Step", bpm: 120, stepLength: 12 },
};

export interface Flight {
  members: Cadet[];
  formation: Formation;
  isMarching: boolean;
  elementCount: number;
  isWithinBounds: () => boolean[];
  cadence: Cadence;
  interval: number; // side-to-side distance between cadets (in inches)
  distance: number; // front-to-back distance between cadets (in inches)
}

export type Command = "LEFT FACE" | "RIGHT FACE" | "ABOUT FACE" | "FORWARD MARCH" | "FLIGHT HALT" | "HALF STEPS" | "FALL-IN" | "ROTATE FALL-IN" | "AS YOU WERE";

export function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function moveForward(cadet: Cadet, steps: number, stepLengthInInches: number) {
  const stepPx = getInchesToPixels()(stepLengthInInches);
  const rad = degToRad(cadet.dir);
  cadet.x += Math.sin(rad) * stepPx * steps;
  cadet.y -= Math.cos(rad) * stepPx * steps;
}

export function rotate(cadet: Cadet, deg: number) {
  cadet.dir += deg;
}

export function createFlight(
  count: number,
  elementCount: number,
  screen: { width: number; height: number; areaWidth: number; areaHeight: number },
  center?: { x: number, y: number },
  direction: Direction = 0,
  interval: number = 35, // default 35 inches
  distance: number = 30  // default 30 inches
): Flight {
  count = clamp(count, 1, 22);
  const members: Cadet[] = [];
  for (let i = 0; i < count; ++i) {
    members.push({ x: 0, y: 0, dir: direction, isGuidon: i === 0, rank: 0, element: 0 });
  }
  const flight: Flight = {
    members,
    formation: "LINE",
    isMarching: false,
    elementCount,
    isWithinBounds: function () {
      const minX = (screen.width - screen.areaWidth) / 2;
      const maxX = minX + screen.areaWidth;
      const minY = (screen.height - screen.areaHeight) / 2;
      const maxY = minY + screen.areaHeight;
      return this.members.map(
        (c) => c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY
      );
    },
    cadence: CADENCES["Quick Time"],
    interval,
    distance,
  };
  // Default center is screen center
  const cx = center?.x ?? screen.width / 2;
  const cy = center?.y ?? screen.height / 2;
  initPositions(flight, elementCount, screen, { x: cx, y: cy }, direction, interval, distance);
  return flight;
}

export function initPositions(
  f: Flight,
  elements: number,
  screen: { width: number; height: number; areaWidth: number; areaHeight: number },
  center?: { x: number, y: number },
  direction: Direction = 0,
  interval: number = 35,
  distance: number = 30
) {
  const count = f.members.length;
  const ranks = Math.ceil((count - 1) / elements) + 1;
  const grid: (number | null)[][] = Array.from({ length: ranks }, () => Array(elements).fill(null));
  grid[0][0] = 0;
  let idx = 1;
  for (let r = 1; r < ranks; r++) {
    for (let c = elements - 1; c >= 0; c--) {
      if (idx >= f.members.length) break;
      grid[r][c] = idx;
      idx++;
    }
  }
  // Use global getInchesToPixels for spacing
  const pxInterval = getInchesToPixels()(interval);
  const pxDistance = getInchesToPixels()(distance);
  const cx = center?.x ?? screen.width / 2;
  const cy = center?.y ?? screen.height / 2;
  for (let r = 0; r < ranks; r++) {
    for (let c = 0; c < elements; c++) {
      const idx = grid[r][c];
      if (typeof idx === "number") {
        // Offset from guidon
        const dx = -(r) * pxDistance;
        const dy = (c) * pxInterval;
        // Rotate offset by direction
        const rad = degToRad(direction);
        const x = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
        const y = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
        f.members[idx].x = x;
        f.members[idx].y = y;
        f.members[idx].dir = direction;
        f.members[idx].rank = r;
        f.members[idx].element = c;
      }
    }
  }
}

// March guidon (or any cadet) from their current element to a target element, taking full steps and a final partial step to align exactly in-line with the target element's axis.
export function marchToElement(cadet: Cadet, targetElement: number, flight: Flight) {
  // Find any cadet in the target element (not the guidon)
  const targetCadet = flight.members.find(c => c.element === targetElement && !c.isGuidon);
  if (!targetCadet) return;
  // Determine axis: if facing up/down (0/180), align y; if facing left/right (90/270), align x
  const dirNorm = ((cadet.dir % 360) + 360) % 360;
  let targetAxis, cadetAxis;
  if (dirNorm === 0 || dirNorm === 180) {
    // Align y
    targetAxis = targetCadet.y;
    cadetAxis = cadet.y;
  } else {
    // Align x
    targetAxis = targetCadet.x;
    cadetAxis = cadet.x;
  }
  // Compute distance in inches
  const pxPerInch = getInchesToPixels()(1);
  const distInPx = targetAxis - cadetAxis;
  // Direction: positive if moving toward increasing axis, negative otherwise
  // For 0 (up), negative y is forward; for 180 (down), positive y is forward
  // For 90 (right), positive x is forward; for 270 (left), negative x is forward
  let sign = 1;
  if ((dirNorm === 0 && distInPx < 0) || (dirNorm === 180 && distInPx > 0) ||
      (dirNorm === 270 && distInPx < 0) || (dirNorm === 90 && distInPx > 0)) {
    sign = 1;
  } else {
    sign = -1;
  }
  let distInInches = Math.abs(distInPx) / pxPerInch;
  const step = flight.distance;
  while (distInInches > step) {
    moveForward(cadet, 1, step * sign);
    distInInches -= step;
  }
  if (distInInches > 0.01) {
    moveForward(cadet, 1, distInInches * sign);
  }
  cadet.element = targetElement;
}

// Global inchesToPixels function, default to identity
let _inchesToPixels: (inches: number) => number = (inches) => inches;

export function setInchesToPixels(fn: (inches: number) => number) {
  _inchesToPixels = fn;
}

export function getInchesToPixels() {
  return _inchesToPixels;
}
