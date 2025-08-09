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
  const lower = cleaned.toLowerCase();

  // FALL IN
  if (/^fall\s*-?\s*in$/i.test(cleaned)) {
    const params: Command['params'] = {};
    if (elements != null && !Number.isNaN(elements)) {
      params.elements = elements;
    }
    return { kind: 'FALL_IN', params };
  }

  // Forward, MARCH
  if (/^(?:forward\s*)?march$/.test(lower) || /^forward\s*march$/.test(lower)) {
    return { kind: 'FORWARD_MARCH' };
  }

  // HALT
  if (/^halt$/.test(lower)) return { kind: 'HALT' };

  // Facing at the halt
  if (/^left\s*face$/.test(lower)) return { kind: 'LEFT_FACE' };
  if (/^right\s*face$/.test(lower)) return { kind: 'RIGHT_FACE' };
  if (/^about\s*face$/.test(lower)) return { kind: 'ABOUT_FACE' };

  // Flanks while marching
  if (/^right\s*flank$/.test(lower)) return { kind: 'RIGHT_FLANK' };
  if (/^left\s*flank$/.test(lower)) return { kind: 'LEFT_FLANK' };

  // To the Rear, MARCH
  if (/^(?:to\s*the\s*rear\s*,?\s*)?march$/.test(lower) || /^to\s*the\s*rear\s*march$/.test(lower)) {
    return { kind: 'TO_THE_REAR' };
  }

  // Column movements
  if (/^column\s*right$/.test(lower)) return { kind: 'COLUMN_RIGHT' };
  if (/^column\s*left$/.test(lower)) return { kind: 'COLUMN_LEFT' };
  if (/^column\s*half\s*right$/.test(lower)) return { kind: 'COLUMN_HALF_RIGHT' };
  if (/^column\s*half\s*left$/.test(lower)) return { kind: 'COLUMN_HALF_LEFT' };

  // Counter, MARCH
  if (/^counter\s*march$/.test(lower)) return { kind: 'COUNTER_MARCH' };

  // Guide
  if (/^guide\s*left$/.test(lower)) return { kind: 'GUIDE_LEFT' };
  if (/^guide\s*right$/.test(lower)) return { kind: 'GUIDE_RIGHT' };

  // At Close Interval, Dress Right, DRESS
  if (/^at\s*close\s*interval\s*dress\s*right\s*dress$/.test(lower)) {
    return { kind: 'AT_CLOSE_INTERVAL_DRESS_RIGHT_DRESS' };
  }

  // Ready, FRONT
  if (/^ready\s*front$/.test(lower)) return { kind: 'READY_FRONT' };

  // Open/Close Ranks
  if (/^open\s*ranks(?:\s*march)?$/.test(lower)) return { kind: 'OPEN_RANKS' };
  if (/^close\s*ranks(?:\s*march)?$/.test(lower)) return { kind: 'CLOSE_RANKS' };

  return { error: `Unrecognized command: ${input}` };
}
