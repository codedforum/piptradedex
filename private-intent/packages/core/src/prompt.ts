/** One entry of the token catalog the model may use: a symbol and the lowercase chain ids it exists on. */
export interface CatalogEntry {
  symbol: string;
  blockchains: string[];
}

/** Collapse a token list into symbol to chains, sorted, so the model sees what is tradeable. */
export function catalogFromTokens(tokens: readonly { symbol: string; blockchain: string }[]): CatalogEntry[] {
  const map = new Map<string, Set<string>>();
  for (const t of tokens) {
    const sym = t.symbol.toUpperCase();
    if (!map.has(sym)) map.set(sym, new Set());
    map.get(sym)!.add(t.blockchain.toLowerCase());
  }
  return [...map.entries()]
    .map(([symbol, chains]) => ({ symbol, blockchains: [...chains].sort() }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

const SHAPES = [
  '{"kind":"SWAP","sell":{"symbol":"USDC","blockchain":"base"},"buy":{"symbol":"ETH","blockchain":"base"},"amount":"25","amountUnit":"token","privacy":"basic","destination":"wallet"}',
  '{"kind":"LIMIT","sell":{"symbol":"USDC","blockchain":"near"},"buy":{"symbol":"wNEAR","blockchain":"near"},"side":"BUY","quantity":"10","price":"2.5","destination":"wallet","privacy":"basic"}',
  '{"kind":"LADDER","buy":{"symbol":"wNEAR","blockchain":"near"},"with":{"symbol":"USDC","blockchain":"near"},"tranches":3,"priceHigh":"3","priceLow":"2","totalQuote":"30","destination":"wallet"}',
  '{"kind":"CANCEL","orderIds":"all"}',
  '{"kind":"QUESTION","question":"How much USDC do you want to swap?","missing":["amount"]}',
  '{"kind":"UNCLEAR","reason":"<short reason>"}',
];

/**
 * The parser instruction. The model turns one request, with any earlier questions and answers,
 * into exactly one JSON object. The catalog bounds what it may name.
 */
export function buildParserPrompt(catalog: readonly CatalogEntry[], opts: { maxCatalog?: number } = {}): string {
  const max = opts.maxCatalog ?? 400;
  const cat = catalog.slice(0, max).map((c) => `${c.symbol}:${c.blockchains.join(',')}`).join(' ');
  return [
    'You turn one trading request into one JSON object and nothing else. No prose, no code fence, no markdown.',
    'Shapes:',
    ...SHAPES,
    'Rules:',
    '- amounts, quantities and prices are decimal strings. "25 usdc" is amount "25" with amountUnit "token". "$25 of eth", "25 dollars" or "25 usd worth" is amount "25" with amountUnit "usd".',
    '- "buy X with Y" means sell Y, buy X. "sell X for Y" means sell X, buy Y. "X to Y" or "X into Y" means sell X, buy Y.',
    '- blockchain is a lowercase chain id: base, eth, arb, op, pol, bsc, avax, sol, near, btc, ton, tron, xrp, doge, zec, sui, apt, gnosis, bera, stellar. Words like ethereum, mainnet, arbitrum, polygon, solana map to those ids.',
    '- only name a symbol on a chain that appears in the catalog below. If the user names a token or chain that is not there, ask or say UNCLEAR.',
    '- when the user gives no chain for a token that exists on exactly one chain, use that chain. When it exists on several, ask which one.',
    '- privacy is "basic" unless the user says advanced. A request for public, visible or non private settlement is UNCLEAR, this assistant only plans private routes.',
    '- destination is the string "wallet" unless the user gives an address or account name to receive at. Then copy it exactly as typed, character for character, never shorten, complete or correct it.',
    '- when a required piece is missing or ambiguous (amount, sell token, buy token, chain, side, price), reply QUESTION with one short question and list what is missing. Ask one thing at a time. Never guess an amount.',
    '- earlier turns in this conversation are the same request being completed. Combine every answer so far into the final object.',
    '- anything that is not a single trade, limit order, ladder or cancel is UNCLEAR.',
    'Catalog (SYMBOL:chains): ' + cat,
  ].join('\n');
}
