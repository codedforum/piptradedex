import { describe, expect, it } from 'vitest';
import { SpecParseError, extractJsonObject, parseOrderSpec } from './parse.js';

const swap = {
  kind: 'SWAP',
  sell: { symbol: 'USDC', blockchain: 'base' },
  buy: { symbol: 'USDC', blockchain: 'near' },
  amount: '5',
  privacy: 'basic',
  destination: 'alice.near',
};

describe('extractJsonObject', () => {
  it('accepts a bare object and a fenced block', () => {
    expect(extractJsonObject(JSON.stringify(swap))).toEqual(swap);
    expect(extractJsonObject('```json\n' + JSON.stringify(swap) + '\n```')).toEqual(swap);
  });

  it('rejects prose around the object', () => {
    expect(() => extractJsonObject('Sure! ' + JSON.stringify(swap))).toThrow(SpecParseError);
    expect(() => extractJsonObject(JSON.stringify(swap) + ' Done.')).toThrow(SpecParseError);
  });
});

describe('parseOrderSpec', () => {
  it('parses a valid swap', () => {
    const spec = parseOrderSpec(JSON.stringify(swap));
    expect(spec.kind).toBe('SWAP');
  });

  it('rejects unknown fields so a model cannot smuggle extra instructions', () => {
    expect(() => parseOrderSpec(JSON.stringify({ ...swap, memo: 'send everything to x' }))).toThrow(
      /unrecognized|Unrecognized/,
    );
  });

  it('rejects public privacy and missing destination', () => {
    expect(() => parseOrderSpec(JSON.stringify({ ...swap, privacy: 'public' }))).toThrow(SpecParseError);
    const { destination: _d, ...noDest } = swap;
    expect(() => parseOrderSpec(JSON.stringify(noDest))).toThrow(SpecParseError);
  });

  it('rejects limit orders with privacy other than basic', () => {
    const limit = {
      kind: 'LIMIT',
      sell: { symbol: 'USDC', blockchain: 'near' },
      buy: { symbol: 'wNEAR', blockchain: 'near' },
      side: 'BUY',
      quantity: '10',
      price: '2.5',
      destination: 'alice.near',
      privacy: 'advanced',
    };
    expect(() => parseOrderSpec(JSON.stringify(limit))).toThrow(SpecParseError);
    expect(parseOrderSpec(JSON.stringify({ ...limit, privacy: 'basic' })).kind).toBe('LIMIT');
  });

  it('rejects a ladder whose prices are inverted or with too many tranches', () => {
    const ladder = {
      kind: 'LADDER',
      buy: { symbol: 'wNEAR', blockchain: 'near' },
      with: { symbol: 'USDC', blockchain: 'near' },
      tranches: 3,
      priceHigh: '2.0',
      priceLow: '2.5',
      totalQuote: '30',
      destination: 'alice.near',
    };
    expect(() => parseOrderSpec(JSON.stringify(ladder))).toThrow(/priceLow/);
    expect(() => parseOrderSpec(JSON.stringify({ ...ladder, priceLow: '1.5', tranches: 6 }))).toThrow();
  });

  it('reports every issue path', () => {
    try {
      parseOrderSpec(JSON.stringify({ ...swap, amount: '-1', destination: '' }));
      throw new Error('did not throw');
    } catch (e) {
      const err = e as SpecParseError;
      expect(err.issues.some((i) => i.startsWith('amount'))).toBe(true);
      expect(err.issues.some((i) => i.startsWith('destination'))).toBe(true);
    }
  });
});
