import { DEFAULT_CONFIG, addressReuse, amountMatch, pairRarity, timingMatch, type HeuristicConfig } from './heuristics.js';
import type { Deposit, Ledger, LinkReport, TruePairs } from './model.js';

export interface LinkOptions {
  config?: Partial<HeuristicConfig> | undefined;
  /** Destination asset symbol for the route under test, used by H4. */
  destinationAsset: string;
  truth?: TruePairs | undefined;
}

function intersect(sets: string[][]): string[] {
  const first = sets[0];
  if (!first) return [];
  return first.filter((id) => sets.every((s) => s.includes(id)));
}

export function linkDeposit(d: Deposit, ledger: Ledger, options: LinkOptions): LinkReport {
  const cfg = { ...DEFAULT_CONFIG, ...options.config };
  const perHeuristic = [
    amountMatch(d, ledger.payouts, cfg),
    timingMatch(d, ledger.payouts, cfg),
    addressReuse(d, ledger),
    pairRarity(d, ledger, cfg, options.destinationAsset),
  ];
  const combined = intersect(perHeuristic.map((h) => h.candidates));
  const report: LinkReport = {
    depositId: d.id,
    perHeuristic,
    combined,
    anonymitySet: combined.length,
    uniquelyLinked: combined.length === 1,
  };
  const truth = options.truth?.[d.id];
  if (truth !== undefined) report.truePayoutInSet = combined.includes(truth);
  return report;
}

export interface StudySummary {
  trades: number;
  uniquelyLinked: number;
  /** Of the uniquely linked ones, how many pointed at the true payout. */
  correctlyLinked: number;
  meanAnonymitySet: number;
  reports: LinkReport[];
}

/** Run the adversary over every deposit and summarise. Ground truth only scores, it never guides. */
export function runStudy(ledger: Ledger, options: LinkOptions): StudySummary {
  const reports = ledger.deposits.map((d) => linkDeposit(d, ledger, options));
  const unique = reports.filter((r) => r.uniquelyLinked);
  const correct = unique.filter((r) => options.truth && r.combined[0] === options.truth[r.depositId]);
  const mean = reports.length ? reports.reduce((a, r) => a + r.anonymitySet, 0) / reports.length : 0;
  return {
    trades: reports.length,
    uniquelyLinked: unique.length,
    correctlyLinked: correct.length,
    meanAnonymitySet: Number(mean.toFixed(2)),
    reports,
  };
}
