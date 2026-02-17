import { SimulatorState, FormationType, DEFAULT_STEP_LEN_IN, normalizeHeading } from '../types';
import { computeCadetPositions } from '../geometry/positions';
import { buildGuidonShiftPlan } from '../guidon/rules';

export type CadetAction =
  | { kind: 'rotate'; deltaDeg: number }
  | { kind: 'step'; distanceIn: number }
  | { kind: 'step-rotate'; deltaDeg: number; distanceIn: number }
  | { kind: 'wait' };

export interface OrchestratorCadet {
  id: string;
  rank: number;
  file: number;
  role: 'cadet' | 'guide' | 'guidon-bearer';
  x: number;
  y: number;
  headingDeg: number;
  actionQueue: CadetAction[];
}

export interface CadetSimulation {
  cadets: OrchestratorCadet[];
  accumulatorMs: number;
  stepCount: number;
  arrangementHeadingDeg: number;
}

export interface SceneSnapshot {
  state: SimulatorState;
  cadets: OrchestratorCadet[];
  t: number; // milliseconds timeline
}

function assignRoles(cadets: OrchestratorCadet[], state: SimulatorState): OrchestratorCadet[] {
  const currentGuidonId = cadets.find(c => c.role === 'guidon-bearer')?.id;
  const next = cadets.map<OrchestratorCadet>(c => ({ ...c, role: 'cadet' }));
  if (currentGuidonId) {
    const idx = next.findIndex(c => c.id === currentGuidonId);
    if (idx >= 0) {
      next[idx].role = 'guidon-bearer';
      return next;
    }
  }
  const files = state.composition.elementCount;
  const baseFile = state.guideSide === 'right' ? files - 1 : 0;
  const guideIdx = next.findIndex(c => c.rank === 0 && c.file === baseFile);
  if (guideIdx >= 0) next[guideIdx].role = 'guidon-bearer';
  return next;
}

/** Create cadets arranged from the current state positions */
export function createCadets(
  state: SimulatorState,
  options?: { cadetCount?: number }
): OrchestratorCadet[] {
  const targetCount = options?.cadetCount ? Math.max(1, Math.floor(options.cadetCount)) : undefined;
  const files = Math.max(1, Math.floor(state.composition.elementCount));
  const ranksFromState = Math.max(1, Math.floor(state.composition.rankCount));
  const neededRanks = targetCount
    ? Math.max(ranksFromState, 1 + Math.ceil(Math.max(0, targetCount - 1) / files))
    : ranksFromState;
  const positions = orderedPositions(
    { ...state, composition: { ...state.composition, rankCount: neededRanks } },
    targetCount
  );
  const limited = typeof targetCount === 'number' ? positions.slice(0, targetCount) : positions;
  const cadets: OrchestratorCadet[] = limited.map((p, i) => ({
    id: `c${i}`,
    rank: p.rank,
    file: p.file,
    role: 'cadet',
    x: p.x,
    y: p.y,
    headingDeg: state.headingDeg,
    actionQueue: [],
  }));
  return assignRoles(cadets, state);
}

export function createSimulation(
  state: SimulatorState,
  options?: { cadetCount?: number }
): CadetSimulation {
  return {
    cadets: createCadets(state, options),
    accumulatorMs: 0,
    stepCount: 0,
    arrangementHeadingDeg: state.headingDeg,
  };
}

const ROTATION_INCREMENT_DEG = 90;
const EPSILON = 1e-3;
const positionKey = (rank: number, file: number) => `${rank}:${file}`;

function createRotateSequence(deltaDeg: number): CadetAction[] {
  const seq: CadetAction[] = [];
  const total = Math.abs(deltaDeg);
  if (total < EPSILON) return seq;
  const sign = deltaDeg >= 0 ? 1 : -1;
  let remaining = total;
  while (remaining > EPSILON) {
    const step = Math.min(ROTATION_INCREMENT_DEG, remaining);
    seq.push({ kind: 'rotate', deltaDeg: sign * step });
    remaining -= step;
  }
  return seq;
}

function createStepSequence(totalDistanceIn: number, chunkIn: number): CadetAction[] {
  const seq: CadetAction[] = [];
  if (Math.abs(totalDistanceIn) < EPSILON) return seq;
  const stepSize = Math.max(EPSILON, Math.abs(chunkIn));
  const sign = totalDistanceIn >= 0 ? 1 : -1;
  let remaining = Math.abs(totalDistanceIn);
  while (remaining >= stepSize - EPSILON) {
    seq.push({ kind: 'step', distanceIn: sign * stepSize });
    remaining -= stepSize;
  }
  if (remaining > EPSILON) {
    seq.push({ kind: 'step', distanceIn: sign * remaining });
  }
  return seq;
}

function appendActions(
  cadet: OrchestratorCadet,
  actions: CadetAction[]
): OrchestratorCadet {
  if (!actions.length) return cadet;
  return {
    ...cadet,
    actionQueue: [...cadet.actionQueue, ...actions],
  };
}

function appendActionsToCadets(
  cadets: OrchestratorCadet[],
  actions: CadetAction[]
): OrchestratorCadet[] {
  if (!actions.length) return cadets;
  return cadets.map(cadet => appendActions(cadet, actions));
}

function appendActionsToGuidon(
  cadets: OrchestratorCadet[],
  actions: CadetAction[]
): OrchestratorCadet[] {
  if (!actions.length) return cadets;
  return cadets.map(cadet =>
    cadet.role === 'guidon-bearer' ? appendActions(cadet, actions) : cadet
  );
}

function moveCadetToTarget(
  cadet: OrchestratorCadet,
  target: { x: number; y: number },
  headingDeg: number,
  stepLen: number
): OrchestratorCadet {
  const dx = target.x - cadet.x;
  const dy = target.y - cadet.y;
  const dist = Math.hypot(dx, dy);
  const desiredHeading = (Math.atan2(dx, dy) * 180) / Math.PI;
  const rotateTo = normalizeDelta(desiredHeading - cadet.headingDeg);
  const rotateBack = normalizeDelta(headingDeg - desiredHeading);
  const queue = [
    ...createRotateSequence(rotateTo),
    ...createStepSequence(dist, stepLen),
    ...createRotateSequence(rotateBack),
  ];
  return appendActions(cadet, queue);
}

function moveCadetForwardDistance(
  cadet: OrchestratorCadet,
  target: { x: number; y: number },
  stepLen: number
): OrchestratorCadet {
  const dx = target.x - cadet.x;
  const dy = target.y - cadet.y;
  const rad = (cadet.headingDeg * Math.PI) / 180;
  const forwardComponent = dx * Math.sin(rad) + dy * Math.cos(rad);
  if (Math.abs(forwardComponent) < EPSILON) return cadet;
  const queue = createStepSequence(forwardComponent, stepLen);
  return appendActions(cadet, queue);
}

function planGuidonAdvance(
  cadet: OrchestratorCadet,
  target: { x: number; y: number },
  baseHeading: number,
  direction: 'left' | 'right',
  stepLen: number,
  mode: 'pivot-and-walk' | 'walk-only'
): OrchestratorCadet {
  const dx = target.x - cadet.x;
  const dy = target.y - cadet.y;
  const rotateDeg = direction === 'right' ? 90 : -90;
  const headingAfterRotate = normalizeHeading(baseHeading + (mode === 'pivot-and-walk' ? rotateDeg : 0));
  const rad = (headingAfterRotate * Math.PI) / 180;
  const forwardComponent = dx * Math.sin(rad) + dy * Math.cos(rad);

  const actions: CadetAction[] = [];
  if (mode === 'pivot-and-walk') {
    actions.push(...createRotateSequence(rotateDeg));
  }
  actions.push(...createStepSequence(forwardComponent, stepLen));
  if (mode === 'pivot-and-walk') {
    actions.push(...createRotateSequence(-rotateDeg));
  }
  return appendActions(cadet, actions);
}

function moveGuidonLaterally(
  cadet: OrchestratorCadet,
  targetFile: number,
  nextState: SimulatorState,
  stepLen: number
): OrchestratorCadet {
  const spacing =
    nextState.interval === 'close'
      ? nextState.spacing.intervalCloseIn
      : nextState.spacing.intervalNormalIn;
  const deltaFile = targetFile - cadet.file;
  if (Math.abs(deltaFile) < EPSILON) return cadet;
  const displacement = deltaFile * spacing;
  const direction = displacement >= 0 ? 1 : -1;
  const rotateDeg = direction * 90;
  const distance = Math.abs(displacement);
  const actions = [
    ...createRotateSequence(rotateDeg),
    ...createStepSequence(distance, stepLen),
    ...createRotateSequence(-rotateDeg),
  ];
  return appendActions(cadet, actions);
}

function moveGuidonToPosition(
  cadet: OrchestratorCadet,
  targetX: number,
  targetY: number,
  targetFile: number,
  formationHeading: number,
  stepLen: number
): OrchestratorCadet {
  // Calculate vector from current position to target position
  const dx = targetX - cadet.x;
  const dy = targetY - cadet.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < EPSILON) return { ...cadet, file: targetFile };
  
  // Calculate the angle to the target position (in degrees)
  const targetAngleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;
  
  // Calculate how much to rotate from current heading to face target
  const currentHeading = formationHeading; // Guidon faces same direction as formation
  let rotateToTarget = targetAngleDeg - currentHeading;
  
  // Normalize to [-180, 180]
  while (rotateToTarget > 180) rotateToTarget -= 360;
  while (rotateToTarget < -180) rotateToTarget += 360;
  
  const actions: CadetAction[] = [
    ...createRotateSequence(rotateToTarget),
    ...createStepSequence(distance, stepLen),
    ...createRotateSequence(-rotateToTarget),
  ];
  
  const moved = appendActions(cadet, actions);
  return { ...moved, file: targetFile };
}

/**
 * Compute displacement from one file to another at rank 0 in world coordinates,
 * using the arrangement heading (heading when positions were last placed).
 *
 * Position of file f at rank 0 = rotate(0, y0 - f * spacing, H)
 * where y0 = (files-1)*spacing/2 and H = arrangementHeading.
 */
function computeFileDisplacement(
  fromFile: number,
  toFile: number,
  spacing: number,
  arrangementHeadingDeg: number
): { dx: number; dy: number } {
  const deltaFile = toFile - fromFile;
  const rad = (arrangementHeadingDeg * Math.PI) / 180;
  return {
    dx: deltaFile * spacing * Math.sin(rad),
    dy: -deltaFile * spacing * Math.cos(rad),
  };
}

function buildPositionLookupWithHeading(
  state: SimulatorState,
  headingDeg: number
): Map<string, { x: number; y: number }> {
  const positions = computeCadetPositions({ ...state, headingDeg });
  const map = new Map<string, { x: number; y: number }>();
  for (const pos of positions) {
    map.set(positionKey(pos.rank, pos.file), { x: pos.x, y: pos.y });
  }
  return map;
}

function estimateArrangementOffset(
  cadets: OrchestratorCadet[],
  expectedPositions: Map<string, { x: number; y: number }>
): { x: number; y: number } | null {
  const accumulate = (source: OrchestratorCadet[]) => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const cadet of source) {
      const expected = expectedPositions.get(positionKey(cadet.rank, cadet.file));
      if (!expected) continue;
      sumX += cadet.x - expected.x;
      sumY += cadet.y - expected.y;
      count += 1;
    }
    return count > 0 ? { x: sumX / count, y: sumY / count } : null;
  };

  // Prefer non-guidon cadets to avoid feedback if the guidon is already out of place.
  const nonGuidon = cadets.filter(c => c.role !== 'guidon-bearer');
  return accumulate(nonGuidon) ?? accumulate(cadets);
}

function resolveGuidonTargetPosition(
  cadets: OrchestratorCadet[],
  stateForGeometry: SimulatorState,
  arrangementHeadingDeg: number,
  targetFile: number
): { x: number; y: number } | null {
  const expectedPositions = buildPositionLookupWithHeading(stateForGeometry, arrangementHeadingDeg);
  const targetExpected = expectedPositions.get(positionKey(0, targetFile));
  if (!targetExpected) return null;
  const offset = estimateArrangementOffset(cadets, expectedPositions);
  if (!offset) return null;
  return {
    x: targetExpected.x + offset.x,
    y: targetExpected.y + offset.y,
  };
}

/**
 * Apply a guidon shift for a formation transition (face or deferred flank).
 *
 * Shift rules (per DAFPAM 34-1203):
 *   FROM LINE → any: shift to last element (files-1)
 *   FROM non-LINE → LINE: shift to first element (0)
 *   All other transitions: no shift
 *
 * Movement mode comes from the rules table (buildGuidonShiftPlan) so it is
 * always correct regardless of the current arrangement heading.
 */
function applyGuidonShift(
  cadets: OrchestratorCadet[],
  fromFormation: FormationType,
  toFormation: FormationType,
  nextHeadingDeg: number,
  arrangementHeadingDeg: number,
  stateForGeometry: SimulatorState,
  stepLen: number
): OrchestratorCadet[] {
  const files = Math.max(1, Math.floor(stateForGeometry.composition.elementCount));
  const shiftPlan = buildGuidonShiftPlan(fromFormation, toFormation, files);
  if (!shiftPlan) return cadets;

  const guidonIdx = cadets.findIndex(c => c.role === 'guidon-bearer');
  if (guidonIdx < 0) return cadets;

  const guidon = cadets[guidonIdx];
  if (guidon.file === shiftPlan.targetFile) return cadets;

  let dx = 0;
  let dy = 0;
  const resolvedTarget = resolveGuidonTargetPosition(
    cadets,
    stateForGeometry,
    arrangementHeadingDeg,
    shiftPlan.targetFile
  );
  if (resolvedTarget) {
    dx = resolvedTarget.x - guidon.x;
    dy = resolvedTarget.y - guidon.y;
  } else {
    const spacing = stateForGeometry.interval === 'close'
      ? stateForGeometry.spacing.intervalCloseIn
      : stateForGeometry.spacing.intervalNormalIn;
    const fallback = computeFileDisplacement(
      guidon.file, shiftPlan.targetFile, spacing, arrangementHeadingDeg
    );
    dx = fallback.dx;
    dy = fallback.dy;
  }

  let actions: CadetAction[];
  switch (shiftPlan.mode) {
    case 'pivot-right': {
      const distance = Math.hypot(dx, dy);
      actions = [
        ...createRotateSequence(90),
        ...createStepSequence(distance, stepLen),
        ...createRotateSequence(-90),
      ];
      break;
    }
    case 'pivot-left': {
      const distance = Math.hypot(dx, dy);
      actions = [
        ...createRotateSequence(-90),
        ...createStepSequence(distance, stepLen),
        ...createRotateSequence(90),
      ];
      break;
    }
    case 'straight': {
      const rad = (nextHeadingDeg * Math.PI) / 180;
      const forward = dx * Math.sin(rad) + dy * Math.cos(rad);
      actions = createStepSequence(forward, stepLen);
      break;
    }
  }

  const updated = { ...appendActions(guidon, actions), file: shiftPlan.targetFile };
  return cadets.map((c, i) => i === guidonIdx ? updated : c);
}

function planMovementToFormation(
  cadets: OrchestratorCadet[],
  state: SimulatorState,
  stepLen: number
): OrchestratorCadet[] {
  const targets = computeFormationTargets(state, cadets.length);
  return cadets.map((cadet, index) => {
    const target = targets[index];
    if (!target) return cadet;
    const dx = target.x - cadet.x;
    const dy = target.y - cadet.y;
    const distance = Math.hypot(dx, dy);
    const actions: CadetAction[] = [];

    let headingAfterRotation = cadet.headingDeg;
    if (distance > EPSILON) {
      const toTargetHeading = (Math.atan2(dx, dy) * 180) / Math.PI;
      const rotateToTarget = normalizeDelta(toTargetHeading - cadet.headingDeg);
      if (Math.abs(rotateToTarget) > EPSILON) {
        const rotateSeq = createRotateSequence(rotateToTarget);
        actions.push(...rotateSeq);
        headingAfterRotation = normalizeHeading(cadet.headingDeg + rotateToTarget);
      } else {
        headingAfterRotation = cadet.headingDeg;
      }
      const stepSeq = createStepSequence(distance, stepLen);
      actions.push(...stepSeq);
      headingAfterRotation = normalizeHeading(toTargetHeading);
    }

    const rotateToFinal = normalizeDelta(state.headingDeg - headingAfterRotation);
    if (Math.abs(rotateToFinal) > EPSILON) {
      actions.push(...createRotateSequence(rotateToFinal));
    }

    if (!actions.length) {
      return {
        ...cadet,
        rank: target.rank,
        file: target.file,
      };
    }

    return {
      ...cadet,
      rank: target.rank,
      file: target.file,
      actionQueue: [...cadet.actionQueue, ...actions],
    };
  });
}

function createMovingTurnSequence(
  deltaDeg: number,
  stepLen: number,
  options?: { halfStep?: boolean }
): CadetAction[] {
  const actions: CadetAction[] = [];
  const initial = options?.halfStep ? stepLen / 2 : stepLen / 2;
  if (initial > EPSILON) {
    actions.push(...createStepSequence(initial, initial));
  }
  actions.push(...createRotateSequence(deltaDeg));
  const finalStep = options?.halfStep ? stepLen / 2 : stepLen;
  if (finalStep > EPSILON) {
    actions.push(...createStepSequence(finalStep, finalStep));
  }
  return actions;
}

function createFlankTurnSequence(
  deltaDeg: number,
  stepLen: number,
  mode: 'step-then-rotate' | 'rotate-then-step'
): CadetAction[] {
  if (stepLen <= EPSILON) return createRotateSequence(deltaDeg);
  if (mode === 'step-then-rotate') {
    return [{ kind: 'step-rotate', deltaDeg, distanceIn: stepLen }];
  }
  return [...createRotateSequence(deltaDeg), ...createStepSequence(stepLen, stepLen)];
}

function stepIntervalMs(state: SimulatorState): number {
  const cadence = Math.max(10, state.cadenceSpm || 0);
  return (60_000 / cadence);
}

function performStep(
  cadets: OrchestratorCadet[],
  state: SimulatorState
): { cadets: OrchestratorCadet[]; didStep: boolean } {
  const stepLen = state.stepLenIn || DEFAULT_STEP_LEN_IN;
  let didStep = false;
  const nextCadets = cadets.map(cadet => {
    let next = cadet;
    if (cadet.actionQueue.length > 0) {
      const [action, ...rest] = cadet.actionQueue;
      if (action.kind === 'rotate') {
        next = {
          ...cadet,
          headingDeg: normalizeHeading(cadet.headingDeg + action.deltaDeg),
          actionQueue: rest,
        };
      } else if (action.kind === 'step') {
        didStep = true;
        const rad = (cadet.headingDeg * Math.PI) / 180;
        const dist = action.distanceIn;
        next = {
          ...cadet,
          x: cadet.x + Math.sin(rad) * dist,
          y: cadet.y + Math.cos(rad) * dist,
          actionQueue: rest,
        };
      } else if (action.kind === 'wait') {
        next = { ...cadet, actionQueue: rest };
      } else {
        didStep = true;
        const heading = normalizeHeading(cadet.headingDeg + action.deltaDeg);
        const rad = (cadet.headingDeg * Math.PI) / 180;
        const dist = action.distanceIn;
        next = {
          ...cadet,
          headingDeg: heading,
          x: cadet.x + Math.sin(rad) * dist,
          y: cadet.y + Math.cos(rad) * dist,
          actionQueue: rest,
        };
      }
      return next;
    }

    if (state.motion !== 'marching') return cadet;
    didStep = true;
    const rad = (cadet.headingDeg * Math.PI) / 180;
    return {
      ...cadet,
      x: cadet.x + Math.sin(rad) * stepLen,
      y: cadet.y + Math.cos(rad) * stepLen,
    };
  });
  return { cadets: nextCadets, didStep };
}

export function advanceSimulation(
  simulation: CadetSimulation,
  state: SimulatorState,
  dtMs: number
): CadetSimulation {
  if (dtMs <= 0) return simulation;
  const idleHalt = state.motion !== 'marching' && simulation.cadets.every(cadet => cadet.actionQueue.length === 0);
  if (idleHalt) {
    if (simulation.accumulatorMs === 0 && simulation.stepCount === 0) return simulation;
    return { ...simulation, accumulatorMs: 0, stepCount: 0 };
  }
  let accumulator = simulation.accumulatorMs + dtMs;
  const frame = stepIntervalMs(state);
  if (!Number.isFinite(frame) || frame <= 0) {
    return simulation;
  }

  let cadets = simulation.cadets;
  let changed = false;
  let stepCount = simulation.stepCount;
  while (accumulator >= frame) {
    accumulator -= frame;
    const stepResult = performStep(cadets, state);
    cadets = stepResult.cadets;
    changed = true;
    if (stepResult.didStep) {
      stepCount += 1;
    }
  }

  if (!changed) {
    return { ...simulation, accumulatorMs: accumulator };
  }

  return {
    ...simulation,
    cadets,
    accumulatorMs: accumulator,
    stepCount,
  };
}

function normalizeDelta(delta: number): number {
  const d = ((delta + 180) % 360 + 360) % 360 - 180;
  if (d === -180) return 180;
  return d;
}

function enqueueHeadingChange(
  cadets: OrchestratorCadet[],
  deltaDeg: number,
  opts?: { halfStep?: boolean; stepLen?: number }
): OrchestratorCadet[] {
  if (Math.abs(deltaDeg) < 1e-6) return cadets;
  const stepLen = opts?.stepLen ?? DEFAULT_STEP_LEN_IN;
  const actions: CadetAction[] = [];
  if (opts?.halfStep) {
    actions.push(...createStepSequence(stepLen / 2, stepLen / 2));
  }
  actions.push(...createRotateSequence(deltaDeg));
  if (opts?.halfStep) {
    actions.push(...createStepSequence(stepLen / 2, stepLen / 2));
  }
  return appendActionsToCadets(cadets, actions);
}

export function applyCommandToSimulation(
  simulation: CadetSimulation,
  prevState: SimulatorState,
  nextState: SimulatorState,
  command: { kind: string },
  opts?: { halfStep?: boolean }
): CadetSimulation {
  // Handle drastic composition changes by rebuilding the formation outright.
  const isFacing = command.kind === 'LEFT_FACE' || command.kind === 'RIGHT_FACE' || command.kind === 'ABOUT_FACE' || command.kind === 'ROTATE_FALL_IN';
  const isFlank = command.kind === 'LEFT_FLANK' || command.kind === 'RIGHT_FLANK';
  const compositionChanged =
    prevState.composition.elementCount !== nextState.composition.elementCount ||
    prevState.composition.rankCount !== nextState.composition.rankCount ||
    prevState.interval !== nextState.interval ||
    (!isFacing && !isFlank && prevState.formationType !== nextState.formationType);
  const stepLen = nextState.stepLenIn || DEFAULT_STEP_LEN_IN;
  let cadets = simulation.cadets;

  if (command.kind === 'FALL_IN') {
    cadets = planMovementToFormation(cadets, nextState, stepLen);
    return { ...simulation, cadets, arrangementHeadingDeg: nextState.headingDeg };
  }

  if (compositionChanged) {
    cadets = planMovementToFormation(cadets, nextState, stepLen);
    return { ...simulation, cadets, arrangementHeadingDeg: nextState.headingDeg };
  }

  switch (command.kind) {
    case 'FORWARD_MARCH': {
      if (prevState.motion === 'halted' && nextState.motion === 'marching') {
        const startSeq: CadetAction[] = [{ kind: 'wait' }, ...createStepSequence(stepLen, stepLen)];
        cadets = appendActionsToCadets(cadets, startSeq);
        return { ...simulation, cadets, accumulatorMs: 0, stepCount: 0 };
      }
      break;
    }
    case 'HALT': {
      if (prevState.motion === 'marching' && nextState.motion === 'halted') {
        const haltSeq: CadetAction[] = [
          ...createStepSequence(stepLen, stepLen),
          { kind: 'step', distanceIn: 0 },
        ];
        cadets = appendActionsToCadets(cadets, haltSeq);
        if (prevState.pendingGuidonShift) {
          cadets = applyGuidonShift(
            cadets,
            prevState.pendingGuidonShift.fromFormation,
            nextState.formationType,
            nextState.headingDeg,
            simulation.arrangementHeadingDeg,
            nextState,
            stepLen
          );
        }
        return { ...simulation, cadets };
      }
      break;
    }
    case 'LEFT_FACE':
    case 'RIGHT_FACE':
    case 'ABOUT_FACE':
    case 'ROTATE_FALL_IN': {
      const delta = normalizeDelta(nextState.headingDeg - prevState.headingDeg);
      const actions = createRotateSequence(delta);
      cadets = appendActionsToCadets(cadets, actions);
      if ((command.kind === 'RIGHT_FACE' || command.kind === 'LEFT_FACE' || command.kind === 'ABOUT_FACE') && prevState.motion === 'halted') {
        cadets = applyGuidonShift(
          cadets,
          prevState.formationType,
          nextState.formationType,
          nextState.headingDeg,
          simulation.arrangementHeadingDeg,
          prevState,
          stepLen
        );
      }
      return { ...simulation, cadets };
    }
    case 'LEFT_FLANK':
    case 'RIGHT_FLANK': {
      const delta = normalizeDelta(nextState.headingDeg - prevState.headingDeg);
      const requiresRightFoot = command.kind === 'RIGHT_FLANK';
      const nextFoot = simulation.stepCount % 2 === 0 ? 'left' : 'right';
      const needsDelay = prevState.motion === 'marching' && nextFoot !== (requiresRightFoot ? 'right' : 'left');
      if (needsDelay) {
        cadets = appendActionsToCadets(cadets, createStepSequence(stepLen, stepLen));
      }
      const actions = createFlankTurnSequence(delta, stepLen, 'step-then-rotate');
      cadets = appendActionsToCadets(cadets, actions);
      return { ...simulation, cadets };
    }
    case 'COLUMN_RIGHT':
    case 'COLUMN_LEFT':
    case 'COLUMN_HALF_RIGHT':
    case 'COLUMN_HALF_LEFT':
    case 'COUNTER_MARCH': {
      const delta = normalizeDelta(nextState.headingDeg - prevState.headingDeg);
      const actions = createMovingTurnSequence(delta, stepLen, { halfStep: opts?.halfStep });
      cadets = appendActionsToCadets(cadets, actions);
      return { ...simulation, cadets };
    }
    case 'TO_THE_REAR': {
      const delta = normalizeDelta(nextState.headingDeg - prevState.headingDeg);
      const nextFoot = simulation.stepCount % 2 === 0 ? 'left' : 'right';
      const needsDelay = prevState.motion === 'marching' && nextFoot !== 'right';

      if (needsDelay) {
        cadets = appendActionsToCadets(cadets, createStepSequence(stepLen, stepLen));
      }

      const actions = createMovingTurnSequence(delta, stepLen, { halfStep: opts?.halfStep });
      cadets = appendActionsToCadets(cadets, actions);
      return { ...simulation, cadets };
    }
    default:
      break;
  }

  const delta = normalizeDelta(nextState.headingDeg - prevState.headingDeg);
  cadets = enqueueHeadingChange(cadets, delta, {
    halfStep: opts?.halfStep,
    stepLen,
  });
  return { ...simulation, cadets };
}

/** Plan a discrete path to the regulation formation instead of teleporting cadets. */
export function snapCadetsToFormation(
  simulation: CadetSimulation,
  state: SimulatorState
): CadetSimulation {
  const pts = computeCadetPositions(state);
  const stepLen = state.stepLenIn || DEFAULT_STEP_LEN_IN;
  const cadets = simulation.cadets.map(cadet => {
    const target = pts.find(p => p.rank === cadet.rank && p.file === cadet.file);
    if (!target) return cadet;
    const dx = target.x - cadet.x;
    const dy = target.y - cadet.y;
    const dist = Math.hypot(dx, dy);
    const desiredHeading = (Math.atan2(dx, dy) * 180) / Math.PI;
    const toTarget = normalizeDelta(desiredHeading - cadet.headingDeg);
    const backToFormation = normalizeDelta(state.headingDeg - desiredHeading);
    const queue = [
      ...cadet.actionQueue,
      ...createRotateSequence(toTarget),
      ...createStepSequence(dist, stepLen),
      ...createRotateSequence(backToFormation),
    ];
    return { ...cadet, actionQueue: queue };
  });
  return { ...simulation, cadets };
}

export function assignCadetRoles(
  simulation: CadetSimulation,
  state: SimulatorState
): CadetSimulation {
  return {
    ...simulation,
    cadets: assignRoles(simulation.cadets, state),
  };
}
function orderedPositions(state: SimulatorState, limit?: number) {
  const files = Math.max(1, Math.floor(state.composition.elementCount));
  const positions = computeCadetPositions(state);
  const posKey = (rank: number, file: number) => `${rank}:${file}`;
  const positionMap = new Map<string, typeof positions[number]>();
  for (const pos of positions) {
    positionMap.set(posKey(pos.rank, pos.file), pos);
  }

  const ranks = Math.max(1, Math.floor(state.composition.rankCount));
  const baseFile = state.guideSide === 'right' ? files - 1 : 0;
  const fileOrder = Array.from({ length: files }, (_, file) => file);

  const visited = new Set<string>();
  const ordered: typeof positions = [];
  const pushPosition = (rank: number, file: number) => {
    const key = posKey(rank, file);
    if (visited.has(key)) return;
    const pos = positionMap.get(key);
    if (!pos) return;
    visited.add(key);
    ordered.push(pos);
  };

  // Guide at the front rank, base file only.
  pushPosition(0, baseFile);

  for (let rank = 1; rank < ranks; rank += 1) {
    const perRankOrder = rank === 1 ? fileOrder : [...fileOrder].reverse();
    for (const file of perRankOrder) {
      pushPosition(rank, file);
    }
  }

  return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
}

function computeFormationTargets(state: SimulatorState, count: number) {
  const files = Math.max(1, Math.floor(state.composition.elementCount));
  const ranksNeeded = Math.max(
    Math.floor(state.composition.rankCount),
    1 + Math.ceil(Math.max(0, count - 1) / files)
  );
  return computeCadetPositions({
    ...state,
    composition: { ...state.composition, rankCount: ranksNeeded },
  }).slice(0, count);
}
