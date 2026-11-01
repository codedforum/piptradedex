import { describe, expect, it } from 'vitest';
import { createOneClick } from './client.js';
import { resolveAsset, toSmallestUnit } from './tokens.js';

// Runs only with LIVE_ONECLICK=1. Dry quotes move no funds.
const live = process.env.LIVE_ONECLICK === '1';

describe.skipIf(!live)('1Click live dry quote', () => {
  it('returns a public dry quote for 5 USDC Base to USDC NEAR', async () => {
    const client = createOneClick({ apiKey: process.env.ONECLICK_API_KEY });
    const tokens = await client.tokens();
    const origin = resolveAsset(tokens, { symbol: 'USDC', blockchain: 'base' });
    const dest = resolveAsset(tokens, { symbol: 'USDC', blockchain: 'near' });
    const res = await client.quote({
      dry: true,
      swapType: 'EXACT_INPUT',
      slippageTolerance: 100,
      originAsset: origin.assetId,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: dest.assetId,
      amount: toSmallestUnit('5', origin.decimals),
      refundTo: '0x1111111111111111111111111111111111111111',
      refundType: 'ORIGIN_CHAIN',
      recipient: 'intents.near',
      recipientType: 'DESTINATION_CHAIN',
      deadline: new Date(Date.now() + 3600_000).toISOString(),
      confidentiality: 'public',
    });
    expect(res.quote.amountOut).toMatch(/^\d+$/);
    expect(Number(res.quote.amountOutFormatted)).toBeGreaterThan(4);
  }, 30_000);
});
