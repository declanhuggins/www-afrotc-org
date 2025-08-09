'use client';

import { useMemo, useReducer, useState } from 'react';
import { createInitialState, reduce, type Command } from '../../../lib/marching';
import { parseCommand } from '../../../lib/marching';

function reducerWrapper(state: ReturnType<typeof createInitialState>, cmd: Command) {
  const res = reduce(state, cmd);
  return res.next;
}

export default function SimulatorClient() {
  const [state, dispatch] = useReducer(reducerWrapper, undefined, () => createInitialState({}));
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pretty = useMemo(() => JSON.stringify(state, null, 2), [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = parseCommand(input);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    dispatch(parsed as Command);
    setInput('');
  }

  function quick(cmd: Command) {
    dispatch(cmd);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <label className="sr-only" htmlFor="cmd">Command</label>
        <input
          id="cmd"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., in 3 elements, FALL IN"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black text-white px-3 py-2">Execute</button>
      </form>
      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'FALL_IN' })}>FALL IN</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'FORWARD_MARCH' })}>Forward, MARCH</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'HALT' })}>HALT</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'LEFT_FACE' })}>Left Face</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'RIGHT_FACE' })}>Right Face</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'ABOUT_FACE' })}>About Face</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'RIGHT_FLANK' })}>Right Flank</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'LEFT_FLANK' })}>Left Flank</button>
        <button className="rounded border px-2 py-1" onClick={() => quick({ kind: 'TO_THE_REAR' })}>To the Rear</button>
      </div>

      <div>
        <h2 className="font-mono text-sm">State</h2>
        <pre className="bg-gray-50 border rounded p-3 overflow-auto text-xs" style={{ maxHeight: 300 }}>{pretty}</pre>
      </div>
    </div>
  );
}
