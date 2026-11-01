import type { Token } from './client.js';

export interface AssetRef {
  symbol: string;
  blockchain: string;
}

export class AssetResolutionError extends Error {
  constructor(
    readonly ref: AssetRef,
    readonly candidates: Token[],
  ) {
    super(
      candidates.length === 0
        ? `No listed asset matches ${ref.symbol} on ${ref.blockchain}`
        : `${ref.symbol} on ${ref.blockchain} is ambiguous: ${candidates.map((c) => c.assetId).join(', ')}`,
    );
    this.name = 'AssetResolutionError';
  }
}

/** Resolve a symbol and chain to exactly one listed token. Fails closed on zero or several matches. */
export function resolveAsset(tokens: readonly Token[], ref: AssetRef): Token {
  const symbol = ref.symbol.trim().toUpperCase();
  const chain = ref.blockchain.trim().toLowerCase();
  const matches = tokens.filter(
    (t) => t.blockchain === chain && t.symbol.toUpperCase() === symbol,
  );
  const only = matches[0];
  if (matches.length === 1 && only) return only;
  throw new AssetResolutionError({ symbol, blockchain: chain }, matches);
}

/** Convert a decimal string such as "12.5" to the integer smallest unit string for the token. */
export function toSmallestUnit(amount: string, decimals: number): string {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid amount: ${amount}`);
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > decimals) throw new Error(`Amount ${amount} has more than ${decimals} decimals`);
  const scaled = (whole + frac.padEnd(decimals, '0')).replace(/^0+(?=\d)/, '');
  return scaled;
}

/** Format a smallest unit string back to a decimal string. */
export function fromSmallestUnit(units: string, decimals: number): string {
  if (!/^\d+$/.test(units)) throw new Error(`Invalid units: ${units}`);
  const padded = units.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
