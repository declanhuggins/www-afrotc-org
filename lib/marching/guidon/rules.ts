import { FormationType } from '../types';

export type GuidonShiftMode = 'pivot-right' | 'pivot-left' | 'straight';

export interface GuidonShiftPlan {
  mode: GuidonShiftMode;
  targetFile: number;
}

type TargetSide = 'first' | 'last';

interface TransitionRule {
  mode: GuidonShiftMode;
  target: TargetSide;
}

const TRANSITION_RULES: Partial<Record<`${FormationType}->${FormationType}`, TransitionRule>> = {
  // From line
  'line->column': { mode: 'pivot-right', target: 'last' },
  'line->inverted-column': { mode: 'pivot-left', target: 'last' },
  'line->inverted-line': { mode: 'straight', target: 'last' },

  // To line from non-line starts that require guidon movement
  'column->line': { mode: 'straight', target: 'first' },
  'inverted-line->line': { mode: 'straight', target: 'first' },
  'inverted-column->line': { mode: 'straight', target: 'first' },
};

/**
 * Guidon movement rules for facing-equivalent formation transitions.
 *
 * Returns null when no guidon movement should occur for the transition.
 */
export function buildGuidonShiftPlan(
  fromFormation: FormationType,
  toFormation: FormationType,
  files: number
): GuidonShiftPlan | null {
  if (files <= 1 || fromFormation === toFormation) return null;
  const rule = TRANSITION_RULES[`${fromFormation}->${toFormation}`];
  if (!rule) return null;
  return {
    mode: rule.mode,
    targetFile: rule.target === 'first' ? 0 : Math.max(0, files - 1),
  };
}
