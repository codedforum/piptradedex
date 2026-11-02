import { describe, expect, it } from 'vitest';
import tokens from '../../oneclick/src/fixtures/tokens.json' with { type: 'json' };
import type { Token } from '@private-intent/oneclick';
import { CompileError, compile, compileSwap, ladderPrices, type CompileContext } from './compile.js';
import type { LadderSpec, LimitSpec, SwapSpec } from './spec.js';

const ctx: CompileContext = {
  tokens: tokens as Token[],
  confirmedDestination: 'alice.near',
  refundTo: '0x1111111111111111111111111111111111111111',
  deadline: '2026-11-02T00:00:00.000Z',
};

const swap: SwapSpec = {
  kind: 'SWAP',
  sell: { symbol: 'USDC', blockchain: 'base' },
  buy: { symbol: 'USDC', blockchain: 'near' },
  amount: '5',
  amountUnit: 'token',
  privacy: 'basic',
  destination: 'alice.near',
};

describe('compileSwap', () => {
  it('builds a dry confidential quote in smallest units', () => {
    const q = compileSwap(swap, ctx);
    expect(q).toMatchObject({
      dry: true,
      amount: '5000000',
      confidentiality: 'basic',
      recipient: 'alice.near',
      originAsset: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
    });
  });

  it('refuses a destination that differs from the confirmed one, whatever the model said', () => {
    const injected = { ...swap, destination: 'attacker.near' };
    expect(() => compileSwap(injected, ctx)).toThrow(CompileError);
    expect(() => compileSwap(injected, ctx)).toThrow(/does not match the confirmed destination/);
  });

  it('always uses the confirmed destination as recipient', () => {
    const q = compileSwap(swap, { ...ctx, confirmedDestination: 'alice.near' });
    expect(q.recipient).toBe(ctx.confirmedDestination);
  });

  it('fails on unlisted assets', () => {
    expect(() => compileSwap({ ...swap, buy: { symbol: 'FAKE', blockchain: 'near' } }, ctx)).toThrow(
      /No listed asset/,
    );
  });
});

describe('compileLimit and ladder', () => {
  const limit: LimitSpec = {
    kind: 'LIMIT',
    sell: { symbol: 'USDC', blockchain: 'near' },
    buy: { symbol: 'wNEAR', blockchain: 'near' },
    side: 'BUY',
    quantity: '10',
    price: '2.5',
    destination: 'alice.near',
    privacy: 'basic',
  };

  it('maps a BUY limit to base wNEAR and quote USDC', () => {
    const plan = compile(limit, ctx);
    if (plan.kind !== 'LIMIT') throw new Error('wrong kind');
    expect(plan.order).toMatchObject({
      orderType: 'LIMIT',
      baseAsset: 'nep141:wrap.near',
      quantity: '10000000000000000000000000',
      side: 'BUY',
      price: '2.5',
      confidentiality: 'basic',
      timeInForce: 'GTC',
      recipient: 'alice.near',
    });
  });

  it('spaces ladder prices evenly from high to low', () => {
    expect(ladderPrices('3', '2', 3)).toEqual(['3', '2.5', '2']);
    expect(ladderPrices('2.5', '2.0', 2)).toEqual(['2.5', '2']);
  });

  it('compiles a ladder into N limit buys with equal quote per tranche', () => {
    const ladder: LadderSpec = {
      kind: 'LADDER',
      buy: { symbol: 'wNEAR', blockchain: 'near' },
      with: { symbol: 'USDC', blockchain: 'near' },
      tranches: 3,
      priceHigh: '3',
      priceLow: '2',
      totalQuote: '30',
      destination: 'alice.near',
    };
    const plan = compile(ladder, ctx);
    if (plan.kind !== 'LADDER') throw new Error('wrong kind');
    expect(plan.orders).toHaveLength(3);
    expect(plan.orders.map((o) => o.price)).toEqual(['3', '2.5', '2']);
    expect(plan.orders[0]?.quantity).toBe('3333333330000000000000000');
    expect(plan.orders[2]?.quantity).toBe('5000000000000000000000000');
    for (const o of plan.orders) expect(o.recipient).toBe('alice.near');
  });

  it('cancel passes through', () => {
    expect(compile({ kind: 'CANCEL', orderIds: 'all' }, ctx)).toEqual({ kind: 'CANCEL', orderIds: 'all' });
  });

  it('converts a dollar amount at the context price and refuses without one', () => {
    const usd: SwapSpec = { ...swap, amount: '10', amountUnit: 'usd' };
    expect(() => compileSwap(usd, ctx)).toThrow(/USD price/);
    const q = compileSwap(usd, { ...ctx, usdPrice: () => 2 });
    expect(q.amount).toBe('5000000');
  });
  it('turns a question spec into a question plan', () => {
    const p = compile({ kind: 'QUESTION', question: 'How much?', missing: ['amount'] }, ctx);
    expect(p).toEqual({ kind: 'QUESTION', question: 'How much?', missing: ['amount'] });
  });
});
