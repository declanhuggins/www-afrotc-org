import { describe, it, expect } from 'vitest';
import { reduce } from '../lib/marching';
import { createInitialState, Command } from '../lib/marching';
import { parseCommand } from '../lib/marching';

describe('engine reducer', () => {
  it('Forward then Halt toggles motion', () => {
    const s0 = createInitialState({ motion: 'halted' });
    const r1 = reduce(s0, { kind: 'FORWARD_MARCH' });
    expect(r1.next.motion).toBe('marching');
    const r2 = reduce(r1.next, { kind: 'HALT' });
    expect(r2.next.motion).toBe('halted');
  });

  it('Facing requires halt', () => {
    const halted = createInitialState({ motion: 'halted', headingDeg: 0 });
    const rFace = reduce(halted, { kind: 'RIGHT_FACE' });
    expect(rFace.next.headingDeg).toBe(90);

    const marching = createInitialState({ motion: 'marching', headingDeg: 0 });
    const rFace2 = reduce(marching, { kind: 'RIGHT_FACE' });
    expect(rFace2.error).toBeTruthy();
    expect(rFace2.next.headingDeg).toBe(0);
  });

  it('Flanks require marching', () => {
    const s0 = createInitialState({ motion: 'halted', headingDeg: 0 });
    const r0 = reduce(s0, { kind: 'RIGHT_FLANK' });
    expect(r0.error).toBeTruthy();

    const s1 = createInitialState({ motion: 'marching', headingDeg: 0 });
    const r1 = reduce(s1, { kind: 'LEFT_FLANK' });
    expect(r1.error).toBeFalsy();
    expect(r1.next.headingDeg).toBe(270);
  });

  it('To the Rear while marching rotates 180', () => {
    const s = createInitialState({ motion: 'marching', headingDeg: 90 });
    const r = reduce(s, { kind: 'TO_THE_REAR' });
    expect(r.next.headingDeg).toBe(270);
    expect(r.effects?.animationHints?.useHalfStep).toBe(true);
  });

  it('Column Half Right/Left adjust 45 deg when marching', () => {
    const s = createInitialState({ motion: 'marching', headingDeg: 0 });
    const r1 = reduce(s, { kind: 'COLUMN_HALF_RIGHT' });
    expect(r1.next.headingDeg).toBe(45);
    const r2 = reduce(r1.next, { kind: 'COLUMN_HALF_LEFT' });
    expect(r2.next.headingDeg).toBe(0);
  });

  it('Guide Left/Right toggles side', () => {
    const s = createInitialState({ guideSide: 'right' });
    const r1 = reduce(s, { kind: 'GUIDE_LEFT' });
    expect(r1.next.guideSide).toBe('left');
    const r2 = reduce(r1.next, { kind: 'GUIDE_RIGHT' });
    expect(r2.next.guideSide).toBe('right');
  });

  it('FALL IN forms line at normal interval and sets element count', () => {
    const s = createInitialState({ formationType: 'column', interval: 'close', motion: 'marching', composition: { elementCount: 2, rankCount: 4 } });
    const r = reduce(s, { kind: 'FALL_IN', params: { elements: 4 } });
    expect(r.next.formationType).toBe('line');
    expect(r.next.interval).toBe('normal');
    expect(r.next.motion).toBe('halted');
    expect(r.next.composition.elementCount).toBe(4);
  });

  it('parser: "in 3 elements, FALL IN" yields FALL_IN with elements=3', () => {
    const cmd = parseCommand('in 3 elements, FALL IN');
    if ('error' in (cmd as any)) throw new Error('parse failed');
    const s = createInitialState({ formationType: 'column', interval: 'close', motion: 'marching', composition: { elementCount: 2, rankCount: 4 } });
    const r = reduce(s, cmd as Command);
    expect(r.next.composition.elementCount).toBe(3);
    expect(r.next.formationType).toBe('line');
    expect(r.next.motion).toBe('halted');
  });

  it('parser: "FALL IN" without elements still works', () => {
    const cmd = parseCommand('FALL IN');
    if ('error' in (cmd as any)) throw new Error('parse failed');
    const s = createInitialState({ motion: 'marching', formationType: 'column' });
    const r = reduce(s, cmd as Command);
    expect(r.next.formationType).toBe('line');
  });

  it('parser: core commands map to reducer kinds', () => {
    const cases: Array<[string, Command['kind']]> = [
      ['Forward, MARCH', 'FORWARD_MARCH'],
      ['HALT', 'HALT'],
      ['Left Face', 'LEFT_FACE'],
      ['Right Flank', 'RIGHT_FLANK'],
      ['To the Rear, MARCH', 'TO_THE_REAR'],
      ['Column Half Right', 'COLUMN_HALF_RIGHT'],
      ['Guide Left', 'GUIDE_LEFT'],
      ['Open Ranks', 'OPEN_RANKS'],
    ];
    for (const [text, kind] of cases) {
      const cmd = parseCommand(text);
      if ('error' in (cmd as any)) throw new Error(`parse failed for ${text}`);
      expect((cmd as Command).kind).toBe(kind);
    }
  });

  it('At Close Interval, Dress Right, DRESS only at halt', () => {
    const halted = createInitialState({ motion: 'halted', interval: 'normal' });
    const r = reduce(halted, { kind: 'AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS' });
    expect(r.next.interval).toBe('close');

    const marching = createInitialState({ motion: 'marching', interval: 'normal' });
    const r2 = reduce(marching, { kind: 'AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS' });
    expect(r2.error).toBeTruthy();
    expect(r2.next.interval).toBe('normal');
  });

  it('Determinism: same input yields identical output', () => {
    const s = createInitialState({ headingDeg: 180, motion: 'halted' });
    const script: Command[] = [
      { kind: 'LEFT_FACE' },
      { kind: 'FORWARD_MARCH' },
      { kind: 'RIGHT_FLANK' },
      { kind: 'HALT' },
    ];
    const run = (start = s) => script.reduce((acc, cmd) => reduce(acc.next, cmd), { next: start }).next;
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
