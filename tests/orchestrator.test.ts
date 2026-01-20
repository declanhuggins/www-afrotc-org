import { describe, it, expect } from 'vitest';
import { createInitialState, reduce, Command } from '../lib/marching';
import { orchestrator } from '../lib/marching';

describe('orchestrator', () => {
  it('creates cadets and steps them forward when marching', () => {
    const s0 = createInitialState({ motion: 'halted', headingDeg: 0 });
    const sim0 = orchestrator.createSimulation(s0, { cadetCount: 2 });
    expect(sim0.cadets.length).toBe(2);
    const s1 = { ...s0, motion: 'marching' as const, cadenceSpm: 120, stepLenIn: 24 };
    const sim1 = orchestrator.advanceSimulation(sim0, s1, 1000);
    // Heading 0 => +y direction; in our coordinate system forward is +y
    const dy = sim1.cadets[0].y - sim0.cadets[0].y;
    expect(dy).toBeGreaterThan(0);
  });

  it('queues discrete rotation actions for facing movements', () => {
    const initial = createInitialState({ motion: 'halted', headingDeg: 0, composition: { elementCount: 1, rankCount: 1 } });
    const sim = orchestrator.createSimulation(initial, { cadetCount: 1 });
    const { next } = reduce(initial, { kind: 'LEFT_FACE' });
    const { cadets } = orchestrator.applyCommandToSimulation(sim, initial, next, { kind: 'LEFT_FACE' });
    const queue = cadets[0].actionQueue;
    expect(queue.length).toBe(1);
    expect(queue.every(action => action.kind === 'rotate')).toBe(true);
    expect(queue[0]).toEqual({ kind: 'rotate', deltaDeg: -90 });
  });

  it('aligns cadets back into formation on FALL-IN using queued steps', () => {
    const base = createInitialState({ motion: 'halted', headingDeg: 0, composition: { elementCount: 2, rankCount: 2 } });
    const marching = { ...base, motion: 'marching' as const };
    const sim0 = orchestrator.createSimulation(base, { cadetCount: 4 });
    const moved = orchestrator.advanceSimulation(sim0, marching, 1200);
    const { next } = reduce(marching, { kind: 'FALL_IN' });
    const result = orchestrator.applyCommandToSimulation(moved, marching, next, { kind: 'FALL_IN' });
    const queues = result.cadets.map(c => c.actionQueue);
    expect(queues.some(actions => actions.some(action => action.kind === 'step'))).toBe(true);
    expect(result.accumulatorMs).toBe(moved.accumulatorMs);
  });

  it('plans full-step halt sequence when transitioning to the halt and preserves beat timing', () => {
    const marching = createInitialState({ motion: 'marching', headingDeg: 0, composition: { elementCount: 1, rankCount: 1 } });
    const sim = orchestrator.createSimulation(marching, { cadetCount: 1 });
    const { next } = reduce(marching, { kind: 'HALT' });
    const result = orchestrator.applyCommandToSimulation(sim, marching, next, { kind: 'HALT' });
    const queue = result.cadets[0].actionQueue;
    expect(queue.length).toBeGreaterThanOrEqual(2);
    expect(queue[0].kind).toBe('step');
    expect(queue[1].kind).toBe('step');
    expect(result.accumulatorMs).toBe(sim.accumulatorMs);
  });

  it('builds moving turn sequence for flanks', () => {
    const marching = createInitialState({ motion: 'marching', headingDeg: 0, composition: { elementCount: 1, rankCount: 1 }, stepLenIn: 24 });
    const sim = orchestrator.createSimulation(marching, { cadetCount: 1 });
    const { next } = reduce(marching, { kind: 'RIGHT_FLANK' });
    const result = orchestrator.applyCommandToSimulation(sim, marching, next, { kind: 'RIGHT_FLANK' });
    const queue = result.cadets[0].actionQueue;
    expect(queue.length).toBeGreaterThanOrEqual(1);
    expect(queue[queue.length - 1].kind).toBe('step-rotate');
  });

  it('steps off when flanking from halt', () => {
    const halted = createInitialState({ motion: 'halted', headingDeg: 0, composition: { elementCount: 1, rankCount: 1 }, stepLenIn: 24 });
    const sim = orchestrator.createSimulation(halted, { cadetCount: 1 });
    const { next } = reduce(halted, { kind: 'LEFT_FLANK' });
    const result = orchestrator.applyCommandToSimulation(sim, halted, next, { kind: 'LEFT_FLANK' });
    const queue = result.cadets[0].actionQueue;
    expect(queue.length).toBe(1);
    expect(queue[0].kind).toBe('step-rotate');
  });

  it('delays right flank until the right foot beat', () => {
    const marching = createInitialState({ motion: 'marching', headingDeg: 0, composition: { elementCount: 1, rankCount: 1 }, stepLenIn: 24 });
    const sim = { ...orchestrator.createSimulation(marching, { cadetCount: 1 }), stepCount: 0 };
    const { next } = reduce(marching, { kind: 'RIGHT_FLANK' });
    const result = orchestrator.applyCommandToSimulation(sim, marching, next, { kind: 'RIGHT_FLANK' });
    const queue = result.cadets[0].actionQueue;
    expect(queue.length).toBe(2);
    expect(queue[0].kind).toBe('step');
    expect(queue[1].kind).toBe('step-rotate');
  });

  it('defers guidon repositioning until halt after a flank', () => {
    const marching = createInitialState({ motion: 'marching', headingDeg: 0, composition: { elementCount: 3, rankCount: 2 } });
    const sim0 = orchestrator.createSimulation(marching, { cadetCount: 6 });
    const flank = reduce(marching, { kind: 'RIGHT_FLANK' });
    const sim1 = orchestrator.applyCommandToSimulation(sim0, marching, flank.next, { kind: 'RIGHT_FLANK' });
    const halt = reduce(flank.next, { kind: 'HALT' });
    const sim2 = orchestrator.applyCommandToSimulation(sim1, flank.next, halt.next, { kind: 'HALT' });

    const guidon = sim2.cadets.find(c => c.role === 'guidon-bearer');
    const other = sim2.cadets.find(c => c.role !== 'guidon-bearer');
    if (!guidon || !other) throw new Error('cadets missing');
    expect(guidon.actionQueue.length).toBeGreaterThan(other.actionQueue.length);
  });

  it('keeps guidon facing-only actions limited to the commanded face for straight guidon shifts', () => {
    const cases: Array<{
      name: string;
      start: ReturnType<typeof createInitialState>;
      command: Command;
      expectedRotates: number;
      expectSteps?: boolean;
    }> = [
      {
        name: 'inverted column to line (Right Face)',
        start: createInitialState({ formationType: 'inverted-column', headingDeg: 270, motion: 'halted' }),
        command: { kind: 'RIGHT_FACE' },
        expectedRotates: 1,
      },
      {
        name: 'column to line (Left Face)',
        start: createInitialState({ formationType: 'column', headingDeg: 90, motion: 'halted' }),
        command: { kind: 'LEFT_FACE' },
        expectedRotates: 1,
      },
      {
        name: 'line to inverted line (About Face)',
        start: createInitialState({ formationType: 'line', headingDeg: 0, motion: 'halted' }),
        command: { kind: 'ABOUT_FACE' },
        expectedRotates: 2,
        expectSteps: true,
      },
      {
        name: 'line heading 90 to inverted line (About Face, rotated start)',
        start: createInitialState({ formationType: 'line', headingDeg: 90, motion: 'halted' }),
        command: { kind: 'ABOUT_FACE' },
        expectedRotates: 2,
        expectSteps: true,
      },
      {
        name: 'inverted line to line (About Face)',
        start: createInitialState({ formationType: 'inverted-line', headingDeg: 180, motion: 'halted' }),
        command: { kind: 'ABOUT_FACE' },
        expectedRotates: 2,
        expectSteps: true,
      },
    ];

    for (const scenario of cases) {
      const sim = orchestrator.createSimulation(scenario.start, { cadetCount: 6 });
      const { next } = reduce(scenario.start, scenario.command);
      const { cadets } = orchestrator.applyCommandToSimulation(sim, scenario.start, next, scenario.command);
      const guidon = cadets.find(c => c.role === 'guidon-bearer');
      if (!guidon) throw new Error('guidon not assigned');
      const queue = guidon.actionQueue;
      const rotateCount = queue.filter(a => a.kind === 'rotate').length;
      const stepCount = queue.filter(a => a.kind === 'step').length;
      expect(rotateCount).toBe(scenario.expectedRotates);
      if (scenario.expectSteps) {
        expect(stepCount).toBeGreaterThan(0);
      }
      const firstStep = queue.findIndex(a => a.kind === 'step');
      const lastRotate = queue.map(a => a.kind).lastIndexOf('rotate');
      if (firstStep !== -1) {
        expect(lastRotate).toBeLessThan(firstStep);
      }
    }
  });

  it('orders fall-in cadets with guide only in front rank, then fill ranks front-to-back by element', () => {
    const state = createInitialState({ composition: { elementCount: 3, rankCount: 4 }, motion: 'halted' });
    const sim = orchestrator.createSimulation(state, { cadetCount: 10 });
    const order = sim.cadets.map(c => ({ rank: c.rank, file: c.file }));
    // Guide (base file) at the front rank.
    expect(order[0]).toEqual({ rank: 0, file: 0 });
    // No other cadets in the front rank; ranks start at index 1.
    expect(order[1]).toEqual({ rank: 1, file: 0 });
    expect(order[2]).toEqual({ rank: 1, file: 1 });
    expect(order[3]).toEqual({ rank: 1, file: 2 });
    // Rank 2 fills left-to-right, rank 3+ fill right-to-left (far to near).
    expect(order.slice(4, 7)).toEqual([
      { rank: 2, file: 2 },
      { rank: 2, file: 1 },
      { rank: 2, file: 0 },
    ]);
    expect(order.slice(7, 10)).toEqual([
      { rank: 3, file: 2 },
      { rank: 3, file: 1 },
      { rank: 3, file: 0 },
    ]);
  });

  it('tracks step cadence so footfall parity is deterministic', () => {
    const marching = createInitialState({ motion: 'marching', headingDeg: 0, cadenceSpm: 60 });
    const sim0 = orchestrator.createSimulation(marching, { cadetCount: 1 });
    // Half-beat: should not increment
    const simHalf = orchestrator.advanceSimulation(sim0, marching, 500);
    expect(simHalf.stepCount).toBe(0);
    // Full beat
    const sim1 = orchestrator.advanceSimulation(simHalf, marching, 500);
    expect(sim1.stepCount).toBe(1);
    // Another beat
    const sim2 = orchestrator.advanceSimulation(sim1, marching, 1000);
    expect(sim2.stepCount).toBe(2);
  });
});
