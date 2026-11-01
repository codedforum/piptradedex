import { buildReceipt, compile, parseOrderSpec, sha256Hex } from '@private-intent/core';
import { runStudy, type Ledger } from '@private-intent/leak';
import { fetchAndVerifyReport } from '@private-intent/nearai';
import { createOneClick, fromSmallestUnit } from '@private-intent/oneclick';

// Demo path: parse a fixed order, dry quote it publicly (no funds move), check the gateway
// attestation, build a receipt and run the leak tester on a synthetic ledger.

const apiKey = process.env.ONECLICK_API_KEY;
const specText = JSON.stringify({
  kind: 'SWAP',
  sell: { symbol: 'USDC', blockchain: 'base' },
  buy: { symbol: 'USDC', blockchain: 'near' },
  amount: '5',
  privacy: 'basic',
  destination: 'intents.near',
});

function section(title: string): void {
  console.log(`\n== ${title}`);
}

section('1. parse the order spec (strict schema, fails closed)');
const spec = parseOrderSpec(specText);
console.log(spec);

section('2. compile against the live 1Click token list');
const oneclick = createOneClick({ apiKey });
const tokens = await oneclick.tokens();
const plan = compile(spec, {
  tokens,
  confirmedDestination: 'intents.near',
  refundTo: '0x1111111111111111111111111111111111111111',
  deadline: new Date(Date.now() + 3600_000).toISOString(),
});
if (plan.kind !== 'SWAP') throw new Error('expected a swap');
console.log({ ...plan.quote, confidentiality: plan.quote.confidentiality });

section('3. dry quote (no deposit address is created)');
const confidentiality = oneclick.hasApiKey ? plan.quote.confidentiality : 'public';
if (!oneclick.hasApiKey) {
  console.log('ONECLICK_API_KEY is not set: confidential quotes need authentication, so this run quotes the public route.');
}
const quote = await oneclick.quote({ ...plan.quote, confidentiality });
const origin = tokens.find((t) => t.assetId === plan.quote.originAsset);
const dest = tokens.find((t) => t.assetId === plan.quote.destinationAsset);
console.log({
  confidentiality: quote.quoteRequest.confidentiality,
  amountIn: fromSmallestUnit(quote.quote.amountIn, origin?.decimals ?? 6),
  amountOut: fromSmallestUnit(quote.quote.amountOut, dest?.decimals ?? 6),
  minAmountOut: fromSmallestUnit(quote.quote.minAmountOut, dest?.decimals ?? 6),
  timeEstimateSeconds: quote.quote.timeEstimate,
  appFees: quote.quoteRequest.appFees,
});

section('4. NEAR AI Cloud gateway attestation (fresh nonce, public endpoint)');
const evidence = await fetchAndVerifyReport({ signingAlgo: 'ed25519' });
console.log({
  gatewaySigner: evidence.gateway.signingAddress,
  mrtd: evidence.gateway.mrtd.slice(0, 16) + '...',
  rtmr3: evidence.gateway.rtmr3.slice(0, 16) + '...',
  checks: evidence.gateway.checks,
});

section('5. Privacy Receipt for this plan (no trade executed, so no tx hashes)');
const receipt = buildReceipt({
  orderId: `dry-${quote.correlationId}`,
  createdAt: new Date().toISOString(),
  promptHash: sha256Hex('swap 5 usdc on base to usdc on near, keep it private'),
  prompt: { model: 'z-ai/glm-5.3-flash', e2eeVerified: false, signatureVerified: false },
  confidentiality: quote.quoteRequest.confidentiality,
  originChain: 'base',
  destinationChain: 'near',
  platformFeeBps: 0,
});
for (const leg of receipt.legs) console.log(`${leg.visibility.padEnd(12)} ${leg.name}`);
console.log({ summary: receipt.summary, receiptHash: receipt.receiptHash });

section('6. leak tester on a synthetic ledger (5 equal trades in one minute)');
const t0 = Math.floor(Date.now() / 1000);
const ledger: Ledger = {
  deposits: Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, chain: 'base', asset: 'USDC', amount: 5, sender: `s${i}`, depositAddress: `a${i}`, timestamp: t0 + i })),
  payouts: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, chain: 'near', asset: 'USDC', amount: 4.99, recipient: `r${i}`, timestamp: t0 + 30 + i })),
};
const study = runStudy(ledger, { destinationAsset: 'USDC' });
console.log({ trades: study.trades, uniquelyLinked: study.uniquelyLinked, meanAnonymitySet: study.meanAnonymitySet });
