import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { expectedSignedText, verifySignature, type SignatureResponse } from './signature.js';

const modelKey = ed25519.utils.randomSecretKey();
const modelPub = bytesToHex(ed25519.getPublicKey(modelKey));
const gatewayKey = ed25519.utils.randomSecretKey();
const gatewayPub = bytesToHex(ed25519.getPublicKey(gatewayKey));
const req = utf8ToBytes('{"model":"m","messages":[]}');
const resp = utf8ToBytes('{"id":"chat-1","choices":[]}');

function sign(text: string, key: Uint8Array): string {
  return bytesToHex(ed25519.sign(utf8ToBytes(text), key));
}

function teeSig(text = expectedSignedText('provider_tee', req, resp, 'm')): SignatureResponse {
  return { text, signature: sign(text, modelKey), signing_address: modelPub, signing_algo: 'ed25519', signature_kind: 'provider_tee' };
}

const base = { requestBytes: req, responseBytes: resp, modelId: 'm', modelSigners: [modelPub], gatewaySigner: gatewayPub };

describe('verifySignature', () => {
  it('accepts a provider_tee signature over the exact bytes from the one verified model', () => {
    const v = verifySignature({ sig: teeSig(), ...base });
    expect(v).toMatchObject({ verified: true, kind: 'provider_tee' });
  });

  it('accepts a gateway signature from the verified gateway', () => {
    const text = expectedSignedText('gateway', req, resp);
    const sig: SignatureResponse = { text, signature: sign(text, gatewayKey), signing_address: gatewayPub, signing_algo: 'ed25519', signature_kind: 'gateway' };
    expect(verifySignature({ sig, ...base }).verified).toBe(true);
  });

  it('rejects when the response bytes changed by one byte', () => {
    const altered = new Uint8Array(resp);
    altered[0] = 0x20;
    const v = verifySignature({ sig: teeSig(), ...base, responseBytes: altered });
    expect(v.verified).toBe(false);
    expect(v.reason).toMatch(/exact request and response bytes/);
  });

  it('rejects a signer that is not in the preflight set, or is ambiguous', () => {
    expect(verifySignature({ sig: teeSig(), ...base, modelSigners: [] }).reason).toMatch(/matched 0/);
    expect(verifySignature({ sig: teeSig(), ...base, modelSigners: [modelPub, modelPub] }).reason).toMatch(/matched 2/);
  });

  it('rejects a forged signature, a missing kind, and an unavailable result', () => {
    const forged = { ...teeSig(), signature: sign('other', modelKey) };
    expect(verifySignature({ sig: forged, ...base }).reason).toMatch(/ed25519 signature check failed/);
    const nokind = { ...teeSig() };
    delete nokind.signature_kind;
    expect(verifySignature({ sig: nokind, ...base }).kind).toBe('unknown');
    const unavailable: SignatureResponse = { text: '', signature: '', signing_address: '', signing_algo: 'ed25519', error_code: 'unavailable', message: 'stream disconnected' };
    expect(verifySignature({ sig: unavailable, ...base }).reason).toBe('stream disconnected');
  });
});
