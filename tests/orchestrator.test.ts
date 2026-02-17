import { describe, it, expect } from 'vitest';
import { createInitialState, reduce, Command, computeCadetPositions } from '../lib/marching';
import { orchestrator } from '../lib/marching';

describe('orchestrator', () => {
  function withGuidonAtFile(
    sim: ReturnType<typeof orchestrator.createSimulation>,
    state: ReturnType<typeof createInitialState>,
    file: number
  ) {
    const target = computeCadetPositions(state).find(p => p.rank === 0 && p.file === file);
    if (!target) throw new Error('guidon target position missing');
    return {
      ...sim,
      cadets: sim.cadets.map(c =>
        c.role === 'guidon-bearer'
          ? { ...c, file, x: target.x, y: target.y }
          : c
      ),
    };
  }

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

  it('applies DAFPAM guidon choreography for halted facing transitions', () => {
    const cases: Array<{
      name: string;
      start: ReturnType<typeof createInitialState>;
      startFile: number;
      command: Command;
      expectedShift: 'pivot-right' | 'pivot-left' | 'straight' | null;
      targetFile: number;
    }> = [
      {
        name: 'line -> column (Right Face)',
        start: createInitialState({ formationType: 'line', headingDeg: 0, motion: 'halted' }),
        startFile: 0,
        command: { kind: 'RIGHT_FACE' },
        expectedShift: 'pivot-right',
        targetFile: 2,
      },
      {
        name: 'line -> inverted-line (About Face)',
        start: createInitialState({ formationType: 'line', headingDeg: 0, motion: 'halted' }),
        startFile: 0,
        command: { kind: 'ABOUT_FACE' },
        expectedShift: 'straight',
        targetFile: 2,
      },
      {
        name: 'line -> inverted-column (Left Face)',
        start: createInitialState({ formationType: 'line', headingDeg: 0, motion: 'halted' }),
        startFile: 0,
        command: { kind: 'LEFT_FACE' },
        expectedShift: 'pivot-left',
        targetFile: 2,
      },
      {
        name: 'column -> inverted-line (Right Face)',
        start: createInitialState({ formationType: 'column', headingDeg: 90, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'RIGHT_FACE' },
        expectedShift: null,
        targetFile: 2,
      },
      {
        name: 'column -> inverted-column (About Face)',
        start: createInitialState({ formationType: 'column', headingDeg: 90, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'ABOUT_FACE' },
        expectedShift: null,
        targetFile: 2,
      },
      {
        name: 'column -> line (Left Face)',
        start: createInitialState({ formationType: 'column', headingDeg: 90, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'LEFT_FACE' },
        expectedShift: 'straight',
        targetFile: 0,
      },
      {
        name: 'inverted-line -> inverted-column (Right Face)',
        start: createInitialState({ formationType: 'inverted-line', headingDeg: 180, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'RIGHT_FACE' },
        expectedShift: null,
        targetFile: 2,
      },
      {
        name: 'inverted-line -> line (About Face)',
        start: createInitialState({ formationType: 'inverted-line', headingDeg: 180, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'ABOUT_FACE' },
        expectedShift: 'straight',
        targetFile: 0,
      },
      {
        name: 'inverted-line -> column (Left Face)',
        start: createInitialState({ formationType: 'inverted-line', headingDeg: 180, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'LEFT_FACE' },
        expectedShift: null,
        targetFile: 2,
      },
      {
        name: 'inverted-column -> line (Right Face)',
        start: createInitialState({ formationType: 'inverted-column', headingDeg: 270, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'RIGHT_FACE' },
        expectedShift: 'straight',
        targetFile: 0,
      },
      {
        name: 'inverted-column -> column (About Face)',
        start: createInitialState({ formationType: 'inverted-column', headingDeg: 270, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'ABOUT_FACE' },
        expectedShift: null,
        targetFile: 2,
      },
      {
        name: 'inverted-column -> inverted-line (Left Face)',
        start: createInitialState({ formationType: 'inverted-column', headingDeg: 270, motion: 'halted' }),
        startFile: 2,
        command: { kind: 'LEFT_FACE' },
        expectedShift: null,
        targetFile: 2,
      },
    ];

    for (const scenario of cases) {
      const sim = withGuidonAtFile(
        orchestrator.createSimulation(scenario.start, { cadetCount: 6 }),
        scenario.start,
        scenario.startFile
      );
      const { next } = reduce(scenario.start, scenario.command);
      const { cadets } = orchestrator.applyCommandToSimulation(sim, scenario.start, next, scenario.command);
      const guidon = cadets.find(c => c.role === 'guidon-bearer');
      if (!guidon) throw new Error('guidon not assigned');
      const queue = guidon.actionQueue;
      const rotates = queue.filter(a => a.kind === 'rotate');
      const stepCount = queue.filter(a => a.kind === 'step').length;
      const commandRotates = scenario.command.kind === 'ABOUT_FACE' ? 2 : 1;
      const pivotRotates =
        scenario.expectedShift === 'pivot-right' || scenario.expectedShift === 'pivot-left' ? 2 : 0;
      expect(rotates.length).toBe(commandRotates + pivotRotates);
      if (scenario.expectedShift === 'pivot-right') {
        expect(rotates[commandRotates]).toEqual({ kind: 'rotate', deltaDeg: 90 });
        expect(rotates[commandRotates + 1]).toEqual({ kind: 'rotate', deltaDeg: -90 });
      } else if (scenario.expectedShift === 'pivot-left') {
        expect(rotates[commandRotates]).toEqual({ kind: 'rotate', deltaDeg: -90 });
        expect(rotates[commandRotates + 1]).toEqual({ kind: 'rotate', deltaDeg: 90 });
      }
      const expectsTravel =
        scenario.expectedShift !== null && scenario.start.formationType === 'line';
      if (expectsTravel) {
        expect(stepCount).toBeGreaterThan(0);
      } else if (scenario.expectedShift === null) {
        expect(stepCount).toBe(0);
      }
      expect(guidon.file).toBe(scenario.targetFile);
      const firstStep = queue.findIndex(a => a.kind === 'step');
      const lastRotate = queue.map(a => a.kind).lastIndexOf('rotate');
      if (scenario.expectedShift === 'straight' && firstStep !== -1) {
        expect(lastRotate).toBeLessThan(firstStep);
      }
    }
  });

  it('guidon repositions correctly after RIGHT FACE from line (3 elements)', () => {
    // Per DAFPAM 34-1203: after RIGHT FACE from line, the guidon bearer
    // turns right (with everyone), turns right again, marches to the last
    // element, then left faces back to the formation heading.
    const state = createInitialState({
      formationType: 'line',
      headingDeg: 0,
      motion: 'halted',
      composition: { elementCount: 3, rankCount: 4 },
    });
    const sim = orchestrator.createSimulation(state, { cadetCount: 10 });
    const guidonBefore = sim.cadets.find(c => c.role === 'guidon-bearer');
    if (!guidonBefore) throw new Error('guidon not assigned');
    expect(guidonBefore.file).toBe(0); // guide-left → file 0

    const { next } = reduce(state, { kind: 'RIGHT_FACE' });
    const result = orchestrator.applyCommandToSimulation(sim, state, next, { kind: 'RIGHT_FACE' });
    const guidon = result.cadets.find(c => c.role === 'guidon-bearer');
    if (!guidon) throw new Error('guidon not assigned');

    const queue = guidon.actionQueue;
    // Action sequence: rotate +90 (face), rotate +90 (pivot), steps, rotate -90 (back)
    const rotates = queue.filter(a => a.kind === 'rotate');
    const steps = queue.filter(a => a.kind === 'step');

    // 3 rotations: face (+90), pivot (+90), return (-90)
    expect(rotates.length).toBe(3);
    expect(rotates[0]).toEqual({ kind: 'rotate', deltaDeg: 90 });  // face right
    expect(rotates[1]).toEqual({ kind: 'rotate', deltaDeg: 90 });  // pivot right
    expect(rotates[2]).toEqual({ kind: 'rotate', deltaDeg: -90 }); // left face back

    // March distance = 2 intervals (70 inches for 3 elements at normal 35" spacing)
    const totalStepDist = steps.reduce((sum, s) => sum + (s.kind === 'step' ? s.distanceIn : 0), 0);
    expect(totalStepDist).toBeCloseTo(70, 1);

    // Guidon file updated to target
    expect(guidon.file).toBe(2);
  });

  it('guidon target after RIGHT FACE is anchored to current formation position', () => {
    const state = createInitialState({
      formationType: 'line',
      headingDeg: 0,
      motion: 'halted',
      composition: { elementCount: 3, rankCount: 4 },
    });
    const sim0 = orchestrator.createSimulation(state, { cadetCount: 10 });
    const sim = {
      ...sim0,
      cadets: sim0.cadets.map(c => ({ ...c, x: c.x + 400, y: c.y + 300 })),
    };

    const { next } = reduce(state, { kind: 'RIGHT_FACE' });
    const queued = orchestrator.applyCommandToSimulation(sim, state, next, { kind: 'RIGHT_FACE' });

    let resolved = queued;
    for (let i = 0; i < 20; i++) {
      resolved = orchestrator.advanceSimulation(resolved, next, 1000);
    }

    const guidon = resolved.cadets.find(c => c.role === 'guidon-bearer');
    if (!guidon) throw new Error('guidon not assigned');
    expect(guidon.file).toBe(2);
    expect(guidon.x).toBeCloseTo(400, 3);
    expect(guidon.y).toBeCloseTo(265, 3);
  });

  it('guidon repositions correctly on LEFT FACE from line', () => {
    // Per DAFPAM 34-1203: after LEFT FACE from line, the guidon bearer
    // turns left (with everyone), turns left again, marches to the last
    // element, then right faces back to the formation heading.
    const state = createInitialState({
      formationType: 'line',
      headingDeg: 0,
      motion: 'halted',
      composition: { elementCount: 3, rankCount: 4 },
    });
    const sim = orchestrator.createSimulation(state, { cadetCount: 10 });
    const { next } = reduce(state, { kind: 'LEFT_FACE' });
    const result = orchestrator.applyCommandToSimulation(sim, state, next, { kind: 'LEFT_FACE' });
    const guidon = result.cadets.find(c => c.role === 'guidon-bearer');
    if (!guidon) throw new Error('guidon not assigned');

    const queue = guidon.actionQueue;
    const rotates = queue.filter(a => a.kind === 'rotate');
    const steps = queue.filter(a => a.kind === 'step');

    // 3 rotations: face (-90), pivot (-90), return (+90)
    expect(rotates.length).toBe(3);
    expect(rotates[0]).toEqual({ kind: 'rotate', deltaDeg: -90 }); // face left
    expect(rotates[1]).toEqual({ kind: 'rotate', deltaDeg: -90 }); // pivot left
    expect(rotates[2]).toEqual({ kind: 'rotate', deltaDeg: 90 });  // right face back

    // March distance = 2 intervals (70 inches for 3 elements at normal 35" spacing)
    const totalStepDist = steps.reduce((sum, s) => sum + (s.kind === 'step' ? s.distanceIn : 0), 0);
    expect(totalStepDist).toBeCloseTo(70, 1);
    expect(guidon.file).toBe(2);
  });

  it('guidon repositions correctly on ABOUT FACE from line', () => {
    // After ABOUT FACE from line, the guidon marches straight to the
    // opposite end of the formation.
    const state = createInitialState({
      formationType: 'line',
      headingDeg: 0,
      motion: 'halted',
      composition: { elementCount: 3, rankCount: 4 },
    });
    const sim = orchestrator.createSimulation(state, { cadetCount: 10 });
    const { next } = reduce(state, { kind: 'ABOUT_FACE' });
    const result = orchestrator.applyCommandToSimulation(sim, state, next, { kind: 'ABOUT_FACE' });
    const guidon = result.cadets.find(c => c.role === 'guidon-bearer');
    if (!guidon) throw new Error('guidon not assigned');

    const queue = guidon.actionQueue;
    const rotates = queue.filter(a => a.kind === 'rotate');
    const steps = queue.filter(a => a.kind === 'step');

    // 2 rotations for the 180° about face, then straight march (no pivot)
    expect(rotates.length).toBe(2);
    expect(steps.length).toBeGreaterThan(0);

    // March distance = 2 intervals (70 inches)
    const totalStepDist = steps.reduce((sum, s) => sum + (s.kind === 'step' ? s.distanceIn : 0), 0);
    expect(totalStepDist).toBeCloseTo(70, 1);

    expect(guidon.file).toBe(2);
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
