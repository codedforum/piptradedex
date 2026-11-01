import { describe, expect, it } from 'vitest';
import { linkDeposit, runStudy } from './link.js';
import type { Deposit, Ledger, Payout, TruePairs } from './model.js';

const t0 = 1_700_000_000;

function dep(id: string, amount: number, ts: number, sender = `s-${id}`): Deposit {
  return { id, chain: 'base', asset: 'USDC', amount, sender, depositAddress: `da-${id}`, timestamp: ts };
}
function pay(id: string, amount: number, ts: number, recipient = `r-${id}`, asset = 'USDC'): Payout {
  return { id, chain: 'near', asset, amount, recipient, timestamp: ts };
}

describe('linkDeposit', () => {
  it('links a lone trade with a distinctive amount uniquely', () => {
    const ledger: Ledger = {
      deposits: [dep('d1', 5, t0)],
      payouts: [pay('p1', 4.99, t0 + 40), pay('p2', 120, t0 + 50), pay('p3', 5, t0 + 7200)],
    };
    const r = linkDeposit(ledger.deposits[0] as Deposit, ledger, { destinationAsset: 'USDC', truth: { d1: 'p1' } });
    expect(r.combined).toEqual(['p1']);
    expect(r.uniquelyLinked).toBe(true);
    expect(r.truePayoutInSet).toBe(true);
  });

  it('cannot single out one of several equal trades in the same window', () => {
    const ledger: Ledger = {
      deposits: [dep('d1', 5, t0), dep('d2', 5, t0 + 5), dep('d3', 5, t0 + 10)],
      payouts: [pay('p1', 4.99, t0 + 40), pay('p2', 4.99, t0 + 45), pay('p3', 4.99, t0 + 50)],
    };
    const r = linkDeposit(ledger.deposits[0] as Deposit, ledger, { destinationAsset: 'USDC' });
    expect(r.anonymitySet).toBe(3);
    expect(r.uniquelyLinked).toBe(false);
  });

  it('uses address reuse to collapse the set', () => {
    const ledger: Ledger = {
      deposits: [dep('d1', 5, t0, 'alice')],
      payouts: [pay('p1', 4.99, t0 + 40, 'bob'), pay('p2', 4.99, t0 + 45, 'alice')],
    };
    const r = linkDeposit(ledger.deposits[0] as Deposit, ledger, { destinationAsset: 'USDC' });
    expect(r.combined).toEqual(['p2']);
    expect(r.perHeuristic.find((h) => h.heuristic === 'H3_address_reuse')?.candidates).toEqual(['p2']);
  });

  it('pair rarity keeps only the matching asset when the pair is rare', () => {
    const ledger: Ledger = {
      deposits: [dep('d1', 5, t0)],
      payouts: [pay('p1', 4.99, t0 + 40, 'x', 'wNEAR'), pay('p2', 4.99, t0 + 45, 'y', 'USDC')],
    };
    const r = linkDeposit(ledger.deposits[0] as Deposit, ledger, { destinationAsset: 'USDC' });
    expect(r.perHeuristic.find((h) => h.heuristic === 'H4_pair_rarity')?.candidates).toEqual(['p2']);
  });

  it('respects the rate and tolerance', () => {
    const ledger: Ledger = { deposits: [dep('d1', 100, t0)], payouts: [pay('p1', 97, t0 + 10), pay('p2', 99.8, t0 + 12)] };
    const r = linkDeposit(ledger.deposits[0] as Deposit, ledger, { destinationAsset: 'USDC', config: { rate: 0.998, amountTolerance: 0.001 } });
    expect(r.combined).toEqual(['p2']);
  });
});

describe('runStudy', () => {
  it('recovers planted links in a sparse ledger and reports the fraction', () => {
    const deposits = [dep('d1', 5, t0), dep('d2', 17, t0 + 600), dep('d3', 42, t0 + 1200)];
    const payouts = [pay('p1', 4.99, t0 + 40), pay('p2', 16.97, t0 + 640), pay('p3', 41.9, t0 + 1240)];
    const truth: TruePairs = { d1: 'p1', d2: 'p2', d3: 'p3' };
    const s = runStudy({ deposits, payouts }, { destinationAsset: 'USDC', truth });
    expect(s.trades).toBe(3);
    expect(s.uniquelyLinked).toBe(3);
    expect(s.correctlyLinked).toBe(3);
    expect(s.meanAnonymitySet).toBe(1);
  });

  it('reports a larger anonymity set when amounts and times overlap', () => {
    const deposits = Array.from({ length: 5 }, (_, i) => dep(`d${i}`, 5, t0 + i));
    const payouts = Array.from({ length: 5 }, (_, i) => pay(`p${i}`, 4.99, t0 + 30 + i));
    const s = runStudy({ deposits, payouts }, { destinationAsset: 'USDC' });
    expect(s.uniquelyLinked).toBe(0);
    expect(s.meanAnonymitySet).toBe(5);
  });
});
