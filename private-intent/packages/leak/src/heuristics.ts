import type { Deposit, HeuristicResult, Ledger, Payout } from './model.js';

export interface HeuristicConfig {
  /** Expected output per unit of input for the deposit's route, for example 0.998 after fees. */
  rate: number;
  /** Relative tolerance on the amount match, 0.01 means one percent. */
  amountTolerance: number;
  /** Payouts must land inside this window after the deposit, in seconds. */
  windowSeconds: number;
  /** Lower rarity bound: pairs seen fewer than this many times in the window count as rare. */
  rarePairThreshold: number;
}

export const DEFAULT_CONFIG: HeuristicConfig = {
  rate: 1,
  amountTolerance: 0.02,
  windowSeconds: 3600,
  rarePairThreshold: 3,
};

/** H1: payout amount equals the deposit amount times the route rate, within tolerance. */
export function amountMatch(d: Deposit, payouts: Payout[], cfg: HeuristicConfig): HeuristicResult {
  const expected = d.amount * cfg.rate;
  const candidates = payouts
    .filter((p) => p.timestamp >= d.timestamp && Math.abs(p.amount - expected) <= expected * cfg.amountTolerance)
    .map((p) => p.id);
  return { heuristic: 'H1_amount', candidates };
}

/** H2: payout lands after the deposit and inside the window, closest first. */
export function timingMatch(d: Deposit, payouts: Payout[], cfg: HeuristicConfig): HeuristicResult {
  const candidates = payouts
    .filter((p) => p.timestamp >= d.timestamp && p.timestamp - d.timestamp <= cfg.windowSeconds)
    .sort((a, b) => a.timestamp - d.timestamp - (b.timestamp - d.timestamp))
    .map((p) => p.id);
  return { heuristic: 'H2_timing', candidates };
}

/** H3: the deposit sender also appears as a recipient, or the recipient repeats across payouts. */
export function addressReuse(d: Deposit, ledger: Ledger): HeuristicResult {
  const direct = ledger.payouts.filter((p) => p.recipient === d.sender).map((p) => p.id);
  if (direct.length > 0) return { heuristic: 'H3_address_reuse', candidates: direct };
  const seen = new Map<string, number>();
  for (const p of ledger.payouts) seen.set(p.recipient, (seen.get(p.recipient) ?? 0) + 1);
  const repeated = ledger.payouts.filter((p) => (seen.get(p.recipient) ?? 0) > 1).map((p) => p.id);
  return { heuristic: 'H3_address_reuse', candidates: repeated.length > 0 ? repeated : ledger.payouts.map((p) => p.id) };
}

/** H4: if the deposit's asset pair is rare in the window, only payouts of the matching asset survive. */
export function pairRarity(d: Deposit, ledger: Ledger, cfg: HeuristicConfig, destinationAsset: string): HeuristicResult {
  const inWindow = ledger.payouts.filter(
    (p) => p.timestamp >= d.timestamp && p.timestamp - d.timestamp <= cfg.windowSeconds,
  );
  const sameAsset = inWindow.filter((p) => p.asset === destinationAsset);
  const rare = sameAsset.length > 0 && sameAsset.length < cfg.rarePairThreshold;
  return { heuristic: 'H4_pair_rarity', candidates: (rare ? sameAsset : inWindow).map((p) => p.id) };
}
