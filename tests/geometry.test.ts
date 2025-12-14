import { describe, it, expect } from 'vitest';
import { createInitialState } from '../lib/marching';
import { computeCadetPositions } from '../lib/marching';

describe('geometry positions', () => {
  it('centers files laterally and uses correct spacing at normal interval', () => {
    const s = createInitialState({
      formationType: 'line',
      interval: 'normal',
      composition: { elementCount: 3, rankCount: 2 },
    });
    const pts = computeCadetPositions(s);
    // 3 files -> y positions should be symmetric: [-35, 0, 35] given 35" interval, with front rank at x=0.
    const ysFront = pts.filter(p => p.rank === 0).map(p => Math.round(p.y));
    expect(ysFront.sort((a,b)=>a-b)).toEqual([-35, 0, 35]);
    // depth uses 30" cover along -X
    const xsRanks = pts.filter(p => p.file === 1).map(p => Math.round(p.x));
    const xsSorted = xsRanks.sort((a,b)=>b-a).map(v => Math.abs(v));
    expect(xsSorted).toEqual([0, 30]);
  });

  it('close interval reduces lateral spacing', () => {
    const s = createInitialState({
      interval: 'close',
      composition: { elementCount: 2, rankCount: 1 },
    });
    const pts = computeCadetPositions(s);
    const ys = pts.map(p => Math.round(p.y)).sort((a,b)=>a-b);
    // 2 files -> positions should be [-2, 2] with 4" close interval (lateral along Y)
    expect(ys).toEqual([-2, 2]);
  });

  it('respects heading rotation (90 deg rotates y->x)', () => {
    const s = createInitialState({ headingDeg: 90, composition: { elementCount: 1, rankCount: 2 } });
    const pts = computeCadetPositions(s);
    // Without rotation, rank 0 at x=0, rank 1 at x=-30. Rotated 90°, they map along -y.
    const p0 = pts.find(p => p.rank === 0)!;
    const p1 = pts.find(p => p.rank === 1)!;
    expect(Math.abs(Math.round(p0.x))).toBe(0);
    expect(Math.round(p0.y)).toBe(0);
    expect(Math.round(p1.y)).toBe(-30);
  });
});
