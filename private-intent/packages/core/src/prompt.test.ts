import { describe, expect, it } from 'vitest';
import { buildParserPrompt, catalogFromTokens } from './prompt.js';

describe('catalogFromTokens', () => {
  it('groups chains per symbol, upper cased and sorted', () => {
    const c = catalogFromTokens([
      { symbol: 'usdc', blockchain: 'near' }, { symbol: 'USDC', blockchain: 'base' }, { symbol: 'ETH', blockchain: 'eth' }, { symbol: 'ETH', blockchain: 'base' },
    ]);
    expect(c).toEqual([{ symbol: 'ETH', blockchains: ['base', 'eth'] }, { symbol: 'USDC', blockchains: ['base', 'near'] }]);
  });
});

describe('buildParserPrompt', () => {
  it('names every shape, the destination rule and the catalog', () => {
    const p = buildParserPrompt([{ symbol: 'USDC', blockchains: ['base', 'near'] }]);
    for (const k of ['SWAP', 'LIMIT', 'LADDER', 'CANCEL', 'QUESTION', 'UNCLEAR']) expect(p).toContain(`"kind":"${k}"`);
    expect(p).toContain('copy it exactly as typed');
    expect(p).toContain('USDC:base,near');
    expect(p).toContain('amountUnit "usd"');
  });
  it('caps the catalog', () => {
    const big = Array.from({ length: 500 }, (_, i) => ({ symbol: 'T' + i, blockchains: ['base'] }));
    expect(buildParserPrompt(big, { maxCatalog: 10 })).not.toContain('T11:');
  });
});
