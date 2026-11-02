import { describe, expect, it } from 'vitest';
import { ConversationError, buildMessages, destinationFromText, userTexts, validateHistory } from './conversation.js';
import type { OrderSpec } from './spec.js';

const swap = (destination: string): OrderSpec => ({
  kind: 'SWAP', sell: { symbol: 'USDC', blockchain: 'base' }, buy: { symbol: 'ETH', blockchain: 'base' }, amount: '1', amountUnit: 'token', privacy: 'basic', destination,
});

describe('validateHistory', () => {
  it('accepts alternating turns and an empty history', () => {
    expect(validateHistory(undefined)).toEqual([]);
    expect(validateHistory([{ role: 'user', content: 'swap usdc' }, { role: 'assistant', content: '{"kind":"QUESTION"}' }])).toHaveLength(2);
  });
  it('refuses a history that starts with the assistant, is too long or has oversized turns', () => {
    expect(() => validateHistory([{ role: 'assistant', content: 'x' }])).toThrow(ConversationError);
    const long = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'a' }));
    expect(() => validateHistory(long)).toThrow(/longer/);
    expect(() => validateHistory([{ role: 'user', content: 'a'.repeat(601) }])).toThrow(/characters/);
    expect(() => validateHistory('nope')).toThrow(ConversationError);
  });
});

describe('buildMessages and userTexts', () => {
  it('puts the prompt first, then history, then the new text', () => {
    const m = buildMessages('SYS', [{ role: 'user', content: 'swap' }, { role: 'assistant', content: 'q' }], '5');
    expect(m.map((t) => t.content)).toEqual(['SYS', 'swap', 'q', '5']);
    expect(userTexts([{ role: 'user', content: 'swap' }, { role: 'assistant', content: 'q' }], '5')).toEqual(['swap', '5']);
  });
});

describe('destinationFromText', () => {
  const addr = '0x60Bc1234567890abcdef1234567890ABCDEF1234';
  it('passes wallet through and a destination the user typed', () => {
    expect(destinationFromText(swap('wallet'), ['swap 1 usdc'])).toBe('wallet');
    expect(destinationFromText(swap(addr), ['swap 1 usdc and send to ' + addr])).toBe(addr);
    expect(destinationFromText(swap('alice.near'), ['to alice.near please'])).toBe('alice.near');
  });
  it('accepts an EVM address the model recased but nothing it changed', () => {
    expect(destinationFromText(swap(addr.toLowerCase()), ['send to ' + addr])).toBe(addr.toLowerCase());
    expect(() => destinationFromText(swap(addr.replace('1234$', '9999')), ['send to ' + addr.slice(0, 40)])).toThrow(ConversationError);
    expect(() => destinationFromText(swap('bob.near'), ['send to alice.near'])).toThrow(/never typed/);
  });
  it('finds the address in an earlier turn of the conversation', () => {
    expect(destinationFromText(swap(addr), ['send 1 usdc to ' + addr, 'eth on base'])).toBe(addr);
  });
});
