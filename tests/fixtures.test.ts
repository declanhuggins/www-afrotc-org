import { describe, it, expect } from 'vitest';
import { scenarios } from '../lib/marching/fixtures/sample-scenarios';
import { reduce } from '../lib/marching';

describe('fixtures run', () => {
  it('each scenario can run without errors', () => {
    for (const sc of scenarios) {
      let state = sc.initial;
      for (const cmd of sc.script) {
        const res = reduce(state, cmd);
        state = res.next;
        // ensure heading stays normalized
        expect(state.headingDeg).toBeGreaterThanOrEqual(0);
        expect(state.headingDeg).toBeLessThan(360);
      }
    }
  });
});
