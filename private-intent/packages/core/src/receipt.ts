import { canonicalJson, sha256Hex } from './canonical.js';

export type Visibility = 'PUBLIC' | 'CONFIDENTIAL' | 'LINKABLE' | 'UNKNOWN';

export interface ReceiptLeg {
  name: string;
  venue: string;
  visibility: Visibility;
  observers: string[];
  evidence: Record<string, string>;
  notes: string[];
}

export interface PrivacyReceipt {
  version: 1;
  createdAt: string;
  orderId: string;
  promptHash: string;
  legs: ReceiptLeg[];
  summary: { publicLegs: number; confidentialLegs: number; linkableLegs: number; unknownLegs: number };
  limits: string[];
  receiptHash: string;
}

export interface PromptEvidence {
  model: string;
  /** True only when the request was sent with the E2EE headers and the response decrypted under the client key. */
  e2eeVerified: boolean;
  /** True only when the response signature matched the preflight attestation signer over the exact bytes. */
  signatureVerified: boolean;
  signerFingerprint?: string;
  requestHash?: string;
  responseHash?: string;
}

export interface ReceiptInput {
  orderId: string;
  createdAt: string;
  /** sha256 of the prompt text. The text itself is never stored. */
  promptHash: string;
  prompt?: PromptEvidence;
  confidentiality: 'public' | 'basic' | 'advanced';
  originChain: string;
  destinationChain: string;
  depositTxHash?: string;
  payoutTxHash?: string;
  intentHashes?: string[];
  nearTxHashes?: string[];
  status?: string;
  /** Stated only when the integrator discloses it. Omitted otherwise. */
  platformFeeBps?: number | undefined;
  /** Present when the deposit or payout side runs through a Confidential Intents balance. */
  shieldTxHash?: string;
  unshieldTxHash?: string;
  /** Result of the leak tester for this trade, when it has been run. */
  linkage?: { anonymitySet: number; uniquelyLinked: boolean; heuristics: string[] };
}

export const CONFIDENTIAL_OBSERVERS = [
  'FAR validator set (permissioned, not named in the docs)',
  'private PoA bridge operator (not named in the docs)',
  'private relay (reads FAR balances and quote traffic)',
  'solvers (see quote requests and their own balances)',
];

export const BASE_LIMITS = [
  'The deposit and the payout are ordinary public transactions on their chains.',
  'Confidential Intents privacy rests on a permissioned validator set and a private RPC staying restricted. The docs do not say what the validators, bridge operator or relay can see beyond this.',
  'A shield or unshield transaction publicly links a wallet to an Intents account.',
  'The NEAR AI Cloud gateway sees request metadata (model id, timing, size, public key headers) even when the content is end-to-end encrypted.',
  'Linkability between deposit and payout is measured by the leak tester, not proven. The sample size is stated with every result.',
  'This receipt describes what the software did and what the documentation states. It is not a proof of privacy.',
];

export function buildReceipt(input: ReceiptInput): PrivacyReceipt {
  const legs: ReceiptLeg[] = [];
  const limits = [...BASE_LIMITS];

  if (input.prompt) {
    const p = input.prompt;
    const confidential = p.e2eeVerified && p.signatureVerified;
    legs.push({
      name: 'prompt to model',
      venue: 'NEAR AI Cloud',
      visibility: confidential ? 'CONFIDENTIAL' : 'UNKNOWN',
      observers: ['NEAR AI Cloud gateway: metadata only when E2EE is verified, content otherwise'],
      evidence: {
        model: p.model,
        e2eeVerified: String(p.e2eeVerified),
        signatureVerified: String(p.signatureVerified),
        ...(p.signerFingerprint ? { signerFingerprint: p.signerFingerprint } : {}),
        ...(p.requestHash ? { requestHash: p.requestHash } : {}),
        ...(p.responseHash ? { responseHash: p.responseHash } : {}),
      },
      notes: confidential
        ? ['Content encrypted to the attested model key. Response signature matched the attested signer.']
        : ['E2EE or signature verification did not complete. Treat the prompt as visible to the gateway.'],
    });
    if (!confidential) limits.push('The prompt for this trade was not verified as end-to-end encrypted.');
  }

  if (input.shieldTxHash) {
    legs.push({
      name: 'shield into Confidential Intents',
      venue: `${input.originChain} to intents.far`,
      visibility: 'LINKABLE',
      observers: ['anyone on the origin chain and on NEAR'],
      evidence: { txHash: input.shieldTxHash },
      notes: ['The shield publicly links the depositing wallet to the Intents account.'],
    });
  }

  legs.push({
    name: 'deposit',
    venue: input.originChain,
    visibility: 'PUBLIC',
    observers: [`anyone on ${input.originChain}`],
    evidence: input.depositTxHash ? { txHash: input.depositTxHash } : {},
    notes: ['Asset, amount and sender are visible on the origin chain.'],
  });

  const swapConfidential = input.confidentiality !== 'public';
  legs.push({
    name: 'swap',
    venue: swapConfidential ? 'NEAR Confidential Intents (intents.far)' : 'NEAR Intents (intents.near)',
    visibility: swapConfidential ? 'CONFIDENTIAL' : 'PUBLIC',
    observers: swapConfidential ? CONFIDENTIAL_OBSERVERS : ['anyone on NEAR'],
    evidence: {
      confidentiality: input.confidentiality,
      ...(input.status ? { status: input.status } : {}),
      ...(input.intentHashes?.length ? { intentHashes: input.intentHashes.join(',') } : {}),
      ...(input.nearTxHashes?.length ? { nearTxHashes: input.nearTxHashes.join(',') } : {}),
      ...(input.platformFeeBps !== undefined ? { platformFeeBps: String(input.platformFeeBps) } : {}),
    },
    notes: swapConfidential
      ? [
          'Per the Confidential Intents docs, public observers see the Treasury shield and unshield (asset, amount, sender) but not swaps or FAR balances.',
          'What the validators, bridge operator and relay can see is not stated in the docs and is marked UNKNOWN above.',
        ]
      : ['The intent and its settlement are public on NEAR.'],
  });

  legs.push({
    name: 'payout',
    venue: input.destinationChain,
    visibility: 'PUBLIC',
    observers: [`anyone on ${input.destinationChain}`],
    evidence: input.payoutTxHash ? { txHash: input.payoutTxHash } : {},
    notes: ['Asset, amount and recipient are visible on the destination chain.'],
  });

  if (input.unshieldTxHash) {
    legs.push({
      name: 'unshield from Confidential Intents',
      venue: `intents.far to ${input.destinationChain}`,
      visibility: 'LINKABLE',
      observers: ['anyone on NEAR and on the destination chain'],
      evidence: { txHash: input.unshieldTxHash },
      notes: ['The unshield publicly links the Intents account to the receiving wallet.'],
    });
  }

  const linkage = input.linkage;
  legs.push({
    name: 'deposit to payout linkage',
    venue: 'public chain data',
    visibility: linkage ? (linkage.uniquelyLinked ? 'PUBLIC' : 'CONFIDENTIAL') : 'UNKNOWN',
    observers: ['an adversary reading public chain data only'],
    evidence: linkage
      ? {
          anonymitySet: String(linkage.anonymitySet),
          uniquelyLinked: String(linkage.uniquelyLinked),
          heuristics: linkage.heuristics.join(','),
        }
      : {},
    notes: linkage
      ? [
          linkage.uniquelyLinked
            ? 'The leak tester linked this deposit to its payout uniquely.'
            : `The leak tester could not single out this trade: ${linkage.anonymitySet} candidates matched.`,
        ]
      : ['Not measured for this trade.'],
  });

  const summary = {
    publicLegs: legs.filter((l) => l.visibility === 'PUBLIC').length,
    confidentialLegs: legs.filter((l) => l.visibility === 'CONFIDENTIAL').length,
    linkableLegs: legs.filter((l) => l.visibility === 'LINKABLE').length,
    unknownLegs: legs.filter((l) => l.visibility === 'UNKNOWN').length,
  };

  const unhashed = {
    version: 1 as const,
    createdAt: input.createdAt,
    orderId: input.orderId,
    promptHash: input.promptHash,
    legs,
    summary,
    limits,
  };
  return { ...unhashed, receiptHash: sha256Hex(canonicalJson(unhashed)) };
}

/** Recompute the hash over every field except receiptHash and compare. */
export function verifyReceipt(receipt: PrivacyReceipt): boolean {
  const { receiptHash, ...rest } = receipt;
  return sha256Hex(canonicalJson(rest)) === receiptHash;
}
