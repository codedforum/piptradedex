import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256Hex } from './canonical.js';
import { buildReceipt, verifyReceipt, type ReceiptInput } from './receipt.js';

const base: ReceiptInput = {
  orderId: 'order-1',
  createdAt: '2026-11-01T21:00:00.000Z',
  promptHash: sha256Hex('swap 5 usdc on base to usdc on near, keep it private'),
  prompt: { model: 'z-ai/glm-5.3-flash', e2eeVerified: true, signatureVerified: true, signerFingerprint: 'ab12' },
  confidentiality: 'basic',
  originChain: 'base',
  destinationChain: 'near',
  depositTxHash: '0xdeposit',
  payoutTxHash: 'payoutHash',
  status: 'SUCCESS',
  platformFeeBps: 0,
};

describe('canonicalJson', () => {
  it('sorts keys at every depth and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [{ z: 1, y: 2 }] } })).toBe('{"a":{"c":[{"y":2,"z":1}]},"b":1}');
  });
});

describe('buildReceipt', () => {
  it('is deterministic and self verifying', () => {
    const r1 = buildReceipt(base);
    const r2 = buildReceipt({ ...base });
    expect(r1.receiptHash).toBe(r2.receiptHash);
    expect(verifyReceipt(r1)).toBe(true);
    expect(verifyReceipt({ ...r1, orderId: 'tampered' })).toBe(false);
  });

  it('never contains the prompt text', () => {
    const text = JSON.stringify(buildReceipt(base));
    expect(text).not.toContain('keep it private');
    expect(text).toContain(base.promptHash);
  });

  it('classifies a verified confidential trade', () => {
    const r = buildReceipt(base);
    const byName = Object.fromEntries(r.legs.map((l) => [l.name, l.visibility]));
    expect(byName).toEqual({
      'prompt to model': 'CONFIDENTIAL',
      deposit: 'PUBLIC',
      swap: 'CONFIDENTIAL',
      payout: 'PUBLIC',
      'deposit to payout linkage': 'UNKNOWN',
    });
    expect(r.summary).toEqual({ publicLegs: 2, confidentialLegs: 2, linkableLegs: 0, unknownLegs: 1 });
    expect(r.limits.length).toBeGreaterThanOrEqual(6);
  });

  it('marks the prompt UNKNOWN and adds a limit when E2EE is not verified', () => {
    const r = buildReceipt({ ...base, prompt: { model: 'm', e2eeVerified: false, signatureVerified: true } });
    expect(r.legs[0]?.visibility).toBe('UNKNOWN');
    expect(r.limits.some((l) => l.includes('not verified as end-to-end encrypted'))).toBe(true);
  });

  it('marks a public route swap PUBLIC and shield legs LINKABLE', () => {
    const r = buildReceipt({ ...base, confidentiality: 'public', shieldTxHash: 'sh', unshieldTxHash: 'un' });
    const names = r.legs.map((l) => `${l.name}:${l.visibility}`);
    expect(names).toContain('swap:PUBLIC');
    expect(names).toContain('shield into Confidential Intents:LINKABLE');
    expect(names).toContain('unshield from Confidential Intents:LINKABLE');
    expect(r.summary.linkableLegs).toBe(2);
  });

  it('reports measured linkage', () => {
    const linked = buildReceipt({ ...base, linkage: { anonymitySet: 1, uniquelyLinked: true, heuristics: ['H1', 'H2'] } });
    const hidden = buildReceipt({ ...base, linkage: { anonymitySet: 7, uniquelyLinked: false, heuristics: ['H1'] } });
    expect(linked.legs.at(-1)?.visibility).toBe('PUBLIC');
    expect(hidden.legs.at(-1)?.visibility).toBe('CONFIDENTIAL');
    expect(hidden.legs.at(-1)?.notes[0]).toContain('7 candidates');
  });

  it('never says 100% private anywhere', () => {
    expect(JSON.stringify(buildReceipt(base))).not.toMatch(/100%/);
  });
});
