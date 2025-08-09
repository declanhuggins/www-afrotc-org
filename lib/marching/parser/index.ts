import { Command } from '../types';

export interface ParseError {
  error: string;
}

/**
 * Parse text commands into a Command.
 * Currently supports: "in N elements, FALL IN" and "FALL IN" (case/spacing/punctuation tolerant).
 */
export function parseCommand(input: string): Command | ParseError {
  const raw = (input || '').trim();
  if (!raw) return { error: 'Empty command' };

  // Extract optional leading: in N element(s),
  const match = /^\s*(?:in\s+(\d+)\s+elements?\s*,?\s*)?(.*)$/i.exec(raw);
  let elements: number | undefined;
  let rest = raw;
  if (match) {
    elements = match[1] ? Number(match[1]) : undefined;
    rest = match[2] || '';
  }

  const cleaned = rest.replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();

  // FALL IN
  if (/^fall\s*-?\s*in$/i.test(cleaned)) {
    const params: Command['params'] = {};
    if (elements != null && !Number.isNaN(elements)) {
      params.elements = elements;
    }
    return { kind: 'FALL_IN', params };
  }

  return { error: `Unrecognized command: ${input}` };
}
