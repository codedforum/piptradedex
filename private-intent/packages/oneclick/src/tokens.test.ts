import { describe, expect, it } from 'vitest';
import tokens from './fixtures/tokens.json' with { type: 'json' };
import type { Token } from './client.js';
import { AssetResolutionError, fromSmallestUnit, resolveAsset, toSmallestUnit } from './tokens.js';

const list = tokens as Token[];

describe('resolveAsset', () => {
  it('resolves a unique symbol on a chain', () => {
    const t = resolveAsset(list, { symbol: 'usdc', blockchain: 'NEAR' });
    expect(t.assetId).toBe('nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1');
    expect(t.decimals).toBe(6);
  });

  it('fails closed when nothing matches', () => {
    expect(() => resolveAsset(list, { symbol: 'NOPE', blockchain: 'near' })).toThrow(AssetResolutionError);
  });

  it('fails closed when several tokens share a symbol on one chain', () => {
    const dup: Token[] = [
      ...list,
      { ...(list[0] as Token), assetId: 'nep141:duplicate.near' },
    ];
    const first = list[0] as Token;
    expect(() => resolveAsset(dup, { symbol: first.symbol, blockchain: first.blockchain })).toThrow(/ambiguous/);
  });
});

describe('unit conversion', () => {
  it('scales decimals to smallest units', () => {
    expect(toSmallestUnit('5', 6)).toBe('5000000');
    expect(toSmallestUnit('0.5', 6)).toBe('500000');
    expect(toSmallestUnit('1.25', 24)).toBe('1250000000000000000000000');
  });

  it('rejects too many decimals and bad input', () => {
    expect(() => toSmallestUnit('1.1234567', 6)).toThrow();
    expect(() => toSmallestUnit('-1', 6)).toThrow();
    expect(() => toSmallestUnit('1e3', 6)).toThrow();
  });

  it('round trips', () => {
    expect(fromSmallestUnit('4999699', 6)).toBe('4.999699');
    expect(fromSmallestUnit('5000000', 6)).toBe('5');
    expect(fromSmallestUnit(toSmallestUnit('0.000001', 6), 6)).toBe('0.000001');
  });
});
