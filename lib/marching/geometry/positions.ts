import { SimulatorState } from '../types';

export interface CadetPosition {
  x: number; // inches, world coordinates (right = +x)
  y: number; // inches, world coordinates (forward = +y)
  rank: number; // 0 = front rank
  file: number; // 0 = leftmost file when facing forward (before rotation)
}

function rotate(x: number, y: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Compute cadet positions for a rectangular formation grid using spacing from state.
 * Assumptions (documented in requirements notes):
 * - elementCount = files abreast; rankCount = depth.
 * - Local frame: forward = +Y, right = +X. For line fall-in, depth extends left/right (X) so ranks stack along -X.
 * - Center the formation laterally around y=0 so the front rank aligns around the origin vertically.
 * - Apply headingDeg rotation around origin to world coordinates.
 */
export function computeCadetPositions(state: SimulatorState): CadetPosition[] {
  const files = Math.max(1, Math.floor(state.composition.elementCount));
  const ranks = Math.max(1, Math.floor(state.composition.rankCount));
  const lateral = state.interval === 'close' ? state.spacing.intervalCloseIn : state.spacing.intervalNormalIn;
  const depth = state.spacing.coverIn;

  // Compute lateral origin so files are centered around y=0 in local frame.
  const width = (files - 1) * lateral;
  const y0 = width / 2;

  const out: CadetPosition[] = [];
  for (let r = 0; r < ranks; r++) {
    for (let f = 0; f < files; f++) {
      // Depth extends along -X so ranks build to the left of the guidon when heading=0.
      const lx = -r * depth; // local X (front rank at x=0, deeper ranks negative X)
      const ly = y0 - f * lateral; // local Y (centered laterally, elements extend downward on canvas)
      const rotated = rotate(lx, ly, state.headingDeg);
      out.push({ x: rotated.x, y: rotated.y, rank: r, file: f });
    }
  }
  return out;
}
