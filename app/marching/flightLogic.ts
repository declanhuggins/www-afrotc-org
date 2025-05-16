// Flight creation and initialization logic
import { Flight, Cadet, Direction, getInchesToPixels, clamp, CADENCES, DEFAULT_INTERVAL, DEFAULT_DISTANCE } from "./commonLib";

export function createFlightLogic(count: number, elementCount: number, screen: { width: number; height: number; areaWidth: number; areaHeight: number }, center?: { x: number, y: number }, direction: Direction = 0, interval: number = DEFAULT_INTERVAL, distance: number = DEFAULT_DISTANCE): Flight {
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
  initPositionsLogic(flight, elementCount, screen, { x: cx, y: cy }, direction, interval, distance);
  return flight;
}

export function initPositionsLogic(f: Flight, elements: number, screen: { width: number; height: number; areaWidth: number; areaHeight: number }, center?: { x: number, y: number }, direction: Direction = 0, interval: number = DEFAULT_INTERVAL, distance: number = DEFAULT_DISTANCE) {
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
  const pxInterval = getInchesToPixels()(interval);
  const pxDistance = getInchesToPixels()(distance);
  const cx = center?.x ?? screen.width / 2;
  const cy = center?.y ?? screen.height / 2;
  for (let r = 0; r < ranks; r++) {
    for (let c = 0; c < elements; c++) {
      const idx = grid[r][c];
      if (typeof idx === "number") {
        const dx = -(r) * pxDistance;
        const dy = (c) * pxInterval;
        const rad = (direction * Math.PI) / 180;
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
