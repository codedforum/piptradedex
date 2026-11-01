/** A deposit seen on an origin chain by an adversary reading public data only. */
export interface Deposit {
  id: string;
  chain: string;
  asset: string;
  /** Amount in whole units as a number, after decimals. */
  amount: number;
  sender: string;
  depositAddress: string;
  timestamp: number;
}

/** A payout seen on a destination chain. */
export interface Payout {
  id: string;
  chain: string;
  asset: string;
  amount: number;
  recipient: string;
  timestamp: number;
}

export interface Ledger {
  deposits: Deposit[];
  payouts: Payout[];
}

/** Ground truth used only to score the adversary. Never available to it. */
export type TruePairs = Record<string, string>;

export interface HeuristicResult {
  heuristic: 'H1_amount' | 'H2_timing' | 'H3_address_reuse' | 'H4_pair_rarity';
  /** Payout ids the heuristic keeps as candidates for the deposit. */
  candidates: string[];
}

export interface LinkReport {
  depositId: string;
  perHeuristic: HeuristicResult[];
  /** Intersection of every heuristic's candidate set. */
  combined: string[];
  anonymitySet: number;
  uniquelyLinked: boolean;
  /** Filled when ground truth is supplied: did the combined set contain the true payout. */
  truePayoutInSet?: boolean;
}
