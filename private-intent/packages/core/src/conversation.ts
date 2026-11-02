import type { OrderSpec } from './spec.js';

export const MAX_TURNS = 6;
export const MAX_TURN_CHARS = 600;

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export class ConversationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationError';
  }
}

/**
 * Validate a client supplied history: alternating user and assistant turns, bounded in count and
 * size. Anything else is refused rather than trimmed, so a caller cannot smuggle a long or
 * malformed transcript past the model.
 */
export function validateHistory(raw: unknown): Turn[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ConversationError('history must be an array');
  if (raw.length > MAX_TURNS * 2) throw new ConversationError(`history is longer than ${MAX_TURNS} exchanges`);
  const turns: Turn[] = raw.map((t, i) => {
    const o = t as { role?: unknown; content?: unknown };
    if (!o || (o.role !== 'user' && o.role !== 'assistant')) throw new ConversationError(`history[${i}].role must be user or assistant`);
    if (typeof o.content !== 'string' || o.content.length === 0 || o.content.length > MAX_TURN_CHARS) {
      throw new ConversationError(`history[${i}].content must be 1 to ${MAX_TURN_CHARS} characters`);
    }
    return { role: o.role, content: o.content };
  });
  turns.forEach((t, i) => {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (t.role !== expected) throw new ConversationError(`history[${i}] must be a ${expected} turn`);
  });
  return turns;
}

/** The message list for one parse: system prompt first, the validated history, then the new user text. */
export function buildMessages(systemPrompt: string, history: Turn[], text: string): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  return [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }];
}

/** Every piece of text the user typed in this conversation, in order. */
export function userTexts(history: Turn[], text: string): string[] {
  return [...history.filter((t) => t.role === 'user').map((t) => t.content), text];
}

/**
 * The destination the plan may carry. "wallet" means the signed in user's own wallet. Anything
 * else must appear verbatim in something the user typed, so the model can relay an address but
 * never invent or alter one. Returns the verified destination.
 */
export function destinationFromText(spec: OrderSpec, texts: readonly string[]): string {
  if (!('destination' in spec)) return 'wallet';
  const d = spec.destination.trim();
  if (d === 'wallet') return 'wallet';
  const found = texts.some((t) => t.includes(d)) || texts.some((t) => t.toLowerCase().includes(d.toLowerCase()) && /^0x[0-9a-f]{40}$/i.test(d));
  if (!found) throw new ConversationError('the model named a destination the user never typed');
  return d;
}
