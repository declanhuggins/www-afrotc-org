import React from 'react';
import {
  Flight,
  Cadet,
  Cadence,
  Direction,
  rotate,
  moveForward,
  DEFAULT_SCREEN_WIDTH,
  DEFAULT_SCREEN_HEIGHT,
  getInchesToPixels,
  getPixelsToInches,
} from './commonLib';
import {
  AtomicCommand,
  ATOMIC_COMMAND_DEFS,
  STATIONARY_PREP_EXEC_PAIRS,
} from './constants';

export async function handleCommandLogic({
  cmd,
  flight,
  setCurrentCommand,
  setCurrentPreparatoryCommand,
  setCurrentExecutionCommand,
  setCommandHistory,
  setFallInMode,
  setFallInPreview,
  setFallInDir,
  showPopupForBeats,
  commandInProgressRef,
  currentPreparatoryCommandRef,
  VALID_PREP_EXEC_PAIRS,
  pushPrep,
  pushExec,
  CADENCES: CADENCE_MAP,
  marchToElement: marchEl,
  setFlight,
  fallInMode,
  lastMousePosRef,
}: {
  cmd: AtomicCommand;
  flight: Flight;
  setCurrentCommand: (cmd: AtomicCommand) => void;
  setCurrentPreparatoryCommand: (cmd: AtomicCommand | null) => void;
  setCurrentExecutionCommand: (cmd: AtomicCommand | null) => void;
  setCommandHistory: (
    fn: (
      hist: { prep?: AtomicCommand; exec?: AtomicCommand; status: 'pending' | 'error' | 'success' | 'asYouWere' }[]
    ) => { prep?: AtomicCommand; exec?: AtomicCommand; status: 'pending' | 'error' | 'success' | 'asYouWere' }[]
  ) => void;
  setFallInMode: (b: boolean) => void;
  setFallInPreview: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setFallInDir: (v: Direction | ((d: Direction) => Direction)) => void;
  showPopupForBeats: (cmd: string, beats?: number) => void;
  commandInProgressRef: React.RefObject<AbortController | null>;
  currentPreparatoryCommandRef: React.RefObject<AtomicCommand | null>;
  VALID_PREP_EXEC_PAIRS: Set<string>;
  pushPrep: (cmd: AtomicCommand) => void;
  pushExec: (cmd: AtomicCommand) => void;
  CADENCES: Record<string, Cadence>;
  marchToElement: (
    cadet: Cadet,
    targetElement: number,
    flight: Flight,
    onStep?: () => void
  ) => Promise<void>;
  setFlight: (f: Flight | ((prev: Flight) => Flight)) => void;
  fallInMode: boolean;
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>;
}) {
  setCurrentCommand(cmd);
  if (cmd === 'AS YOU WERE') {
    setCurrentPreparatoryCommand(null);
    setCurrentExecutionCommand(null);
    currentPreparatoryCommandRef.current = null;
    if (commandInProgressRef.current) {
      commandInProgressRef.current.abort();
      commandInProgressRef.current = null;
    }
    setCommandHistory((hist) => {
      if (
        hist.length > 0 &&
        hist[hist.length - 1].status === 'pending' &&
        hist[hist.length - 1].prep &&
        !hist[hist.length - 1].exec
      ) {
        return [
          ...hist.slice(0, -1),
          { ...hist[hist.length - 1], status: 'error' },
          { status: 'asYouWere' },
        ];
      }
      return [...hist, { status: 'asYouWere' }];
    });
    showPopupForBeats(cmd);
    if (fallInMode) {
      setFallInMode(false);
      setFallInPreview(null);
    }
    return;
  }

  let abortController: AbortController | null = null;
  const shouldAbort = () => abortController && abortController.signal.aborted;

  const isExecution = ATOMIC_COMMAND_DEFS[cmd]?.type === 'execution';
  if (isExecution) {
    const prep = currentPreparatoryCommandRef.current;
    const pairKey = prep ? `${prep}|${cmd}` : null;
    const isValid = prep && VALID_PREP_EXEC_PAIRS.has(pairKey as string);
    if (!prep) {
      pushExec(cmd);
      setCurrentExecutionCommand(null);
      return;
    }
    if (!isValid) {
      pushExec(cmd);
      setCurrentExecutionCommand(null);
      return;
    }
    if (pairKey && STATIONARY_PREP_EXEC_PAIRS.has(pairKey) && flight.isMarching) {
      setCurrentExecutionCommand(cmd);
      showPopupForBeats(cmd);
      setCommandHistory((hist) => {
        for (let i = hist.length - 1; i >= 0; i--) {
          if (hist[i].status === 'pending' && hist[i].prep && !hist[i].exec) {
            return [
              ...hist.slice(0, i),
              { ...hist[i], exec: cmd, status: 'error' },
              ...hist.slice(i + 1),
            ];
          }
        }
        return [...hist, { prep: undefined, exec: cmd, status: 'error' }];
      });
      setCurrentPreparatoryCommand(null);
      setCurrentExecutionCommand(null);
      currentPreparatoryCommandRef.current = null;
      return;
    }
  }

  switch (cmd) {
    case 'FORWARD':
    case 'HALF STEPS':
    case 'LEFT':
    case 'RIGHT':
    case 'ABOUT':
    case 'COLUMN LEFT':
    case 'COLUMN RIGHT':
    case 'FLIGHT':
      setCurrentPreparatoryCommand(cmd);
      currentPreparatoryCommandRef.current = cmd;
      showPopupForBeats(cmd);
      pushPrep(cmd);
      break;
    case 'MARCH': {
      setCurrentExecutionCommand('MARCH');
      showPopupForBeats('MARCH');
      pushExec('MARCH');
      switch (currentPreparatoryCommandRef.current) {
        case 'FORWARD': {
          const cadence = CADENCE_MAP['Quick Time'];
          const stepInterval = 60000 / cadence.bpm;
          setTimeout(() => {
            setFlight((f: Flight) => ({ ...f, cadence, isMarching: true }));
          }, stepInterval);
          break;
        }
        case 'HALF STEPS': {
          const cadence = CADENCE_MAP['Half Step'];
          const stepInterval = 60000 / cadence.bpm;
          setTimeout(() => {
            setFlight((f: Flight) => ({ ...f, cadence, isMarching: true }));
          }, stepInterval);
          break;
        }
        case 'COLUMN RIGHT': {
          if (flight.formation !== 'COLUMN') break;
          const f2 = { ...flight, members: flight.members.map((c) => ({ ...c })) };
          const elementCount = f2.elementCount;
          const stepLength = getInchesToPixels()(24);
          const quickTime = CADENCE_MAP['Quick Time'];
          const halfStep = CADENCE_MAP['Half Step'];
          const elements: Cadet[][] = Array.from({ length: elementCount }, (_, i) =>
            f2.members
              .filter((c) => c.element === i)
              .sort((a, b) => a.rank - b.rank)
          );
          const guide = f2.members[0];
          const elementLeaders = elements.map((e) => {
            const nonGuidon = e.filter((c) => c.rank > 0);
            return nonGuidon.length > 0 ? nonGuidon[0] : e[0];
          });
          const leaderPlan = (elIdx: number) => {
            if (elIdx === elementCount - 1) {
              return { firstPivot: 90, afterFirstPivotSteps: 1, secondPivot: 0 };
            } else {
              return {
                firstPivot: 45,
                afterFirstPivotSteps: 2 * (elementCount - 1 - elIdx) + 1,
                secondPivot: 45,
              };
            }
          };
          const cadetState: Record<number, { pivot1: boolean; stepsAfterPivot1: number; pivot2: boolean; inHalfStep: boolean }> = {};
          f2.members.forEach((_, idx) => {
            cadetState[idx] = { pivot1: false, stepsAfterPivot1: 0, pivot2: false, inHalfStep: false };
          });
          const dir = guide.dir;
          const elementPivotLines = Array(elementCount).fill(null) as Array<number | null>;
          if (dir === 90) {
            for (let elIdx = 0; elIdx < elementCount; ++elIdx) {
              elementPivotLines[elIdx] = elementLeaders[elIdx].x + stepLength;
            }
          } else if (dir === 0) {
            for (let elIdx = 0; elIdx < elementCount; ++elIdx) {
              elementPivotLines[elIdx] = elementLeaders[elIdx].y - stepLength;
            }
          }
          (window as unknown as { marchingStep: () => void }).marchingStep = () => {
            for (let elIdx = 0; elIdx < elementCount; ++elIdx) {
              const element = elements[elIdx];
              const plan = leaderPlan(elIdx);
              const leader = elementLeaders[elIdx];
              for (let r = 0; r < element.length; ++r) {
                const cadet = element[r];
                const idx = f2.members.indexOf(cadet);
                const state = cadetState[idx];
                let crossed = false;
                let step = getInchesToPixels()(state.inHalfStep ? halfStep.stepLength : quickTime.stepLength);
                if (dir === 90 && elementPivotLines[elIdx] !== null && !state.pivot1) {
                  if (cadet.x + step >= (elementPivotLines[elIdx] as number)) {
                    step = (elementPivotLines[elIdx] as number) - cadet.x;
                    crossed = true;
                  }
                } else if (dir === 0 && elementPivotLines[elIdx] !== null && !state.pivot1) {
                  if (cadet.y - step <= (elementPivotLines[elIdx] as number)) {
                    step = cadet.y - (elementPivotLines[elIdx] as number);
                    crossed = true;
                  }
                }
                moveForward(cadet, 1, getPixelsToInches()(step));
                if (cadet === leader && !state.pivot1) {
                  state.stepsAfterPivot1 = (state.stepsAfterPivot1 || 0) + 1;
                }
                if (cadet === leader && elIdx === elementCount - 1 && !state.pivot1 && crossed) {
                  rotate(cadet, 90);
                  state.pivot1 = true;
                  state.inHalfStep = true;
                } else if (cadet === leader && elIdx !== elementCount - 1 && !state.pivot1 && crossed) {
                  rotate(cadet, plan.firstPivot);
                  state.pivot1 = true;
                  state.stepsAfterPivot1 = 0;
                } else if (cadet !== leader && !state.pivot1 && crossed) {
                  rotate(cadet, plan.firstPivot);
                  state.pivot1 = true;
                  state.stepsAfterPivot1 = 0;
                }
                if (state.pivot1 && !state.pivot2 && elIdx !== elementCount - 1) {
                  state.stepsAfterPivot1 = (state.stepsAfterPivot1 || 0) + 1;
                  if (state.stepsAfterPivot1 === plan.afterFirstPivotSteps && plan.secondPivot) {
                    rotate(cadet, plan.secondPivot);
                    state.pivot2 = true;
                  }
                } else if (state.pivot1 && elIdx === elementCount - 1) {
                  state.inHalfStep = true;
                }
                if (state.pivot2 && !state.inHalfStep && elIdx !== elementCount - 1) {
                  const rightmostElement = elements[elementCount - 1].filter((c) => c.rank > 0);
                  const rightmostCadet = rightmostElement.find((c) => c.rank === cadet.rank);
                  if (rightmostCadet) {
                    let caughtUp = false;
                    if (dir === 0) {
                      if (cadet.x >= rightmostCadet.x) caughtUp = true;
                    } else if (dir === 90) {
                      if (cadet.y >= rightmostCadet.y) caughtUp = true;
                    }
                    if (caughtUp) {
                      state.inHalfStep = true;
                    }
                  }
                }
              }
            }
            if (guide) {
              const guideIdx = f2.members.indexOf(guide);
              const state = cadetState[guideIdx];
              const step = state.inHalfStep ? halfStep.stepLength : quickTime.stepLength;
              if (dir === 90 && elementPivotLines[elementCount - 1] !== null && !state.pivot1) {
                if (guide.x + step >= (elementPivotLines[elementCount - 1] as number)) {
                  moveForward(guide, 1, getPixelsToInches()(step));
                  rotate(guide, 90);
                  state.pivot1 = true;
                  rotate(guide, 45);
                  moveForward(guide, 1, getPixelsToInches()(step));
                  rotate(guide, 45);
                  state.inHalfStep = true;
                } else {
                  moveForward(guide, 1, getPixelsToInches()(step));
                }
              } else {
                moveForward(guide, 1, getPixelsToInches()(step));
              }
            }
            setFlight({ ...f2, members: f2.members.map((c) => ({ ...c })) });
          };
          (window as unknown as { marchingStep: () => void }).marchingStep();
          break;
        }
        case 'COLUMN LEFT': {
          break;
        }
        default: {
          break;
        }
      }
      break;
    }
    case 'FACE': {
      setCurrentExecutionCommand('FACE');
      showPopupForBeats('FACE');
      pushExec('FACE');
      abortController = new AbortController();
      commandInProgressRef.current = abortController;
      const f2 = { ...flight, members: flight.members.map((c) => ({ ...c })) };
      const guidon = f2.members[0];
      const guidonTurnDelay = 60000 / flight.cadence.bpm;
      if (currentPreparatoryCommandRef.current === 'RIGHT') for (const c of f2.members) rotate(c, 90);
      if (currentPreparatoryCommandRef.current === 'LEFT') for (const c of f2.members) rotate(c, -90);
      if (currentPreparatoryCommandRef.current === 'ABOUT') for (const c of f2.members) rotate(c, 180);
      setFlight({ ...f2, members: f2.members.map((c) => ({ ...c })) });
      const prepCmd = currentPreparatoryCommandRef.current;
      const awaitDelay = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const updateFlightMembers = () => setFlight({ ...f2, members: f2.members.map((c) => ({ ...c })) });
      const abortIfNeeded = () => {
        if (shouldAbort()) throw new Error('aborted');
      };
      await awaitDelay(guidonTurnDelay);
      if (shouldAbort()) {
        commandInProgressRef.current = null;
        return;
      }
      const doMarch = async (prep: AtomicCommand | null) => {
        try {
          if (prep === 'RIGHT') {
            if (f2.formation === 'LINE') {
              rotate(guidon, 90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchEl(guidon, f2.elementCount - 1, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              rotate(guidon, -90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              f2.formation = 'COLUMN';
            } else if (f2.formation === 'COLUMN') {
              f2.formation = 'INVERSE_LINE';
            } else if (f2.formation === 'INVERSE_LINE') {
              f2.formation = 'INVERSE_COLUMN';
            } else if (f2.formation === 'INVERSE_COLUMN') {
              await marchEl(guidon, 0, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = 'LINE';
            }
          } else if (prep === 'LEFT') {
            if (f2.formation === 'LINE') {
              rotate(guidon, -90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchEl(guidon, f2.elementCount - 1, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              rotate(guidon, 90);
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              f2.formation = 'INVERSE_COLUMN';
            } else if (f2.formation === 'INVERSE_COLUMN') {
              f2.formation = 'INVERSE_LINE';
            } else if (f2.formation === 'INVERSE_LINE') {
              f2.formation = 'COLUMN';
            } else if (f2.formation === 'COLUMN') {
              await marchEl(guidon, 0, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = 'LINE';
            }
          } else if (prep === 'ABOUT') {
            if (f2.formation === 'LINE') {
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchEl(guidon, f2.elementCount - 1, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = 'INVERSE_LINE';
            } else if (f2.formation === 'INVERSE_LINE') {
              updateFlightMembers();
              await awaitDelay(guidonTurnDelay);
              abortIfNeeded();
              await marchEl(guidon, 0, f2, () => {
                updateFlightMembers();
                abortIfNeeded();
              });
              f2.formation = 'LINE';
            } else if (f2.formation === 'COLUMN') {
              f2.formation = 'INVERSE_COLUMN';
            } else if (f2.formation === 'INVERSE_COLUMN') {
              f2.formation = 'COLUMN';
            }
          }
          updateFlightMembers();
        } catch (e) {
          console.error('Command aborted:', e);
        } finally {
          commandInProgressRef.current = null;
        }
      };
      doMarch(prepCmd);
      break;
    }
    case 'HALT': {
      setCurrentExecutionCommand('HALT');
      showPopupForBeats('HALT');
      pushExec('HALT');
      const haltDelay = 60000 / flight.cadence.bpm;
      setTimeout(() => {
        setFlight((f: Flight) => ({ ...f, isMarching: false }));
      }, haltDelay);
      break;
    }
    case 'FALL-IN': {
      setCurrentExecutionCommand('FALL-IN');
      showPopupForBeats('FALL-IN');
      pushExec('FALL-IN');
      setFallInMode(true);
      setFallInPreview(
        lastMousePosRef.current || {
          x: DEFAULT_SCREEN_WIDTH / 2,
          y: DEFAULT_SCREEN_HEIGHT / 2,
        }
      );
      setFallInDir(0);
      break;
    }
    case 'ROTATE FALL-IN': {
      setCurrentExecutionCommand('ROTATE FALL-IN');
      showPopupForBeats('ROTATE FALL-IN');
      pushExec('ROTATE FALL-IN');
      setFallInDir((d: Direction) => ((d + 90) % 360) as Direction);
      break;
    }
  }
}
