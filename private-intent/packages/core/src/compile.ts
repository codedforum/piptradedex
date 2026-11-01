import {
  resolveAsset,
  toSmallestUnit,
  type OrderAttributes,
  type QuoteInput,
  type Token,
} from '@private-intent/oneclick';
import type { LadderSpec, LimitSpec, OrderSpec, SwapSpec } from './spec.js';

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}

export interface CompileContext {
  tokens: readonly Token[];
  /** Destination the user typed or confirmed in the UI. The spec must match it exactly. */
  confirmedDestination: string;
  refundTo: string;
  /** ISO timestamp after which an unfunded quote expires. */
  deadline: string;
  slippageBps?: number;
}

function assertDestination(spec: { destination: string }, ctx: CompileContext): void {
  if (spec.destination !== ctx.confirmedDestination) {
    throw new CompileError(
      `destination in the parsed order (${spec.destination}) does not match the confirmed destination`,
    );
  }
}

export function compileSwap(spec: SwapSpec, ctx: CompileContext): QuoteInput {
  assertDestination(spec, ctx);
  const origin = resolveAsset(ctx.tokens, spec.sell);
  const dest = resolveAsset(ctx.tokens, spec.buy);
  if (origin.assetId === dest.assetId) throw new CompileError('sell and buy resolve to the same asset');
  return {
    dry: true,
    swapType: 'EXACT_INPUT',
    slippageTolerance: ctx.slippageBps ?? 100,
    originAsset: origin.assetId,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: dest.assetId,
    amount: toSmallestUnit(spec.amount, origin.decimals),
    refundTo: ctx.refundTo,
    refundType: 'ORIGIN_CHAIN',
    recipient: ctx.confirmedDestination,
    recipientType: 'DESTINATION_CHAIN',
    deadline: ctx.deadline,
    confidentiality: spec.privacy,
  };
}

export function compileLimit(spec: LimitSpec, ctx: CompileContext): OrderAttributes {
  assertDestination(spec, ctx);
  const sell = resolveAsset(ctx.tokens, spec.sell);
  const buy = resolveAsset(ctx.tokens, spec.buy);
  if (sell.assetId === buy.assetId) throw new CompileError('sell and buy resolve to the same asset');
  const base = spec.side === 'BUY' ? buy : sell;
  const quote = spec.side === 'BUY' ? sell : buy;
  return {
    orderType: 'LIMIT',
    baseAsset: base.assetId,
    quoteAsset: quote.assetId,
    quantity: toSmallestUnit(spec.quantity, base.decimals),
    side: spec.side,
    price: spec.price,
    depositType: 'ORIGIN_CHAIN',
    refundTo: ctx.refundTo,
    refundType: 'ORIGIN_CHAIN',
    recipient: ctx.confirmedDestination,
    recipientType: 'DESTINATION_CHAIN',
    ...(spec.deadline ? { deadline: spec.deadline } : {}),
    depositMode: 'SIMPLE',
    confidentiality: 'basic',
    timeInForce: 'GTC',
  };
}

/** Prices for N tranches spaced evenly from priceHigh down to priceLow, as decimal strings. */
export function ladderPrices(priceHigh: string, priceLow: string, tranches: number, decimals = 8): string[] {
  const hi = Number(priceHigh);
  const lo = Number(priceLow);
  const step = (hi - lo) / (tranches - 1);
  return Array.from({ length: tranches }, (_, i) => (hi - step * i).toFixed(decimals).replace(/\.?0+$/, ''));
}

export function compileLadder(spec: LadderSpec, ctx: CompileContext): OrderAttributes[] {
  assertDestination(spec, ctx);
  const base = resolveAsset(ctx.tokens, spec.buy);
  const quote = resolveAsset(ctx.tokens, spec.with);
  if (base.assetId === quote.assetId) throw new CompileError('buy and with resolve to the same asset');
  const prices = ladderPrices(spec.priceHigh, spec.priceLow, spec.tranches);
  const quotePerTranche = Number(spec.totalQuote) / spec.tranches;
  return prices.map((price) => {
    const quantity = (quotePerTranche / Number(price)).toFixed(Math.min(base.decimals, 8));
    return {
      orderType: 'LIMIT',
      baseAsset: base.assetId,
      quoteAsset: quote.assetId,
      quantity: toSmallestUnit(quantity, base.decimals),
      side: 'BUY',
      price,
      depositType: 'ORIGIN_CHAIN',
      refundTo: ctx.refundTo,
      refundType: 'ORIGIN_CHAIN',
      recipient: ctx.confirmedDestination,
      recipientType: 'DESTINATION_CHAIN',
      depositMode: 'SIMPLE',
      confidentiality: 'basic',
      timeInForce: 'GTC',
    };
  });
}

export type CompiledPlan =
  | { kind: 'SWAP'; quote: QuoteInput }
  | { kind: 'LIMIT'; order: OrderAttributes }
  | { kind: 'LADDER'; orders: OrderAttributes[] }
  | { kind: 'CANCEL'; orderIds: string[] | 'all' };

export function compile(spec: OrderSpec, ctx: CompileContext): CompiledPlan {
  switch (spec.kind) {
    case 'SWAP':
      return { kind: 'SWAP', quote: compileSwap(spec, ctx) };
    case 'LIMIT':
      return { kind: 'LIMIT', order: compileLimit(spec, ctx) };
    case 'LADDER':
      return { kind: 'LADDER', orders: compileLadder(spec, ctx) };
    case 'CANCEL':
      return { kind: 'CANCEL', orderIds: spec.orderIds };
  }
}
