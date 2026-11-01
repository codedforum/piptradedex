import { ed25519 } from '@noble/curves/ed25519.js';
import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { sha256Hex } from './crypto.js';

export interface SignatureResponse {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
  signature_kind?: 'provider_tee' | 'gateway' | string;
  error_code?: string;
  message?: string;
}

export interface SignatureVerdict {
  verified: boolean;
  kind: 'provider_tee' | 'gateway' | 'unknown';
  expectedText: string;
  reason: string;
  signer: string;
}

export function expectedSignedText(
  kind: 'provider_tee' | 'gateway',
  requestBytes: Uint8Array,
  responseBytes: Uint8Array,
  modelId?: string,
): string {
  const pair = `${sha256Hex(requestBytes)}:${sha256Hex(responseBytes)}`;
  if (kind === 'provider_tee') {
    if (!modelId) throw new Error('provider_tee text needs the canonical model id');
    return `${modelId}:${pair}`;
  }
  return pair;
}

export function verifyEd25519Text(text: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return ed25519.verify(hexToBytes(signatureHex), utf8ToBytes(text), hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

/**
 * Verify a response signature over the exact bytes and match the signer to the
 * preflight evidence: exactly one verified model report for provider_tee, the
 * verified gateway report for gateway. Anything else is unverified.
 */
export function verifySignature(input: {
  sig: SignatureResponse;
  requestBytes: Uint8Array;
  responseBytes: Uint8Array;
  modelId: string;
  modelSigners: string[];
  gatewaySigner: string;
}): SignatureVerdict {
  const { sig } = input;
  const signer = sig.signing_address;
  if (sig.error_code || !sig.signature || !sig.text) {
    return { verified: false, kind: 'unknown', expectedText: '', reason: sig.message ?? 'signature unavailable', signer };
  }
  if (sig.signing_algo !== 'ed25519') {
    return { verified: false, kind: 'unknown', expectedText: '', reason: `unsupported signing_algo ${sig.signing_algo}`, signer };
  }
  const kind = sig.signature_kind === 'provider_tee' || sig.signature_kind === 'gateway' ? sig.signature_kind : 'unknown';
  if (kind === 'unknown') {
    return { verified: false, kind, expectedText: '', reason: 'signature_kind absent or unfamiliar', signer };
  }
  const expectedText = expectedSignedText(kind, input.requestBytes, input.responseBytes, input.modelId);
  if (sig.text !== expectedText) {
    return { verified: false, kind, expectedText, reason: 'signed text does not match the exact request and response bytes', signer };
  }
  if (kind === 'provider_tee') {
    const matches = input.modelSigners.filter((s) => s.toLowerCase() === signer.toLowerCase());
    if (matches.length !== 1) {
      return { verified: false, kind, expectedText, reason: `signer matched ${matches.length} verified model reports, need exactly 1`, signer };
    }
  } else if (input.gatewaySigner.toLowerCase() !== signer.toLowerCase()) {
    return { verified: false, kind, expectedText, reason: 'signer is not the verified gateway', signer };
  }
  if (!verifyEd25519Text(sig.text, sig.signature, signer)) {
    return { verified: false, kind, expectedText, reason: 'ed25519 signature check failed', signer };
  }
  return { verified: true, kind, expectedText, reason: 'ok', signer };
}
