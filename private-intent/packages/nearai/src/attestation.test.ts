import { describe, expect, it } from 'vitest';
import report from './fixtures/gateway-report.json' with { type: 'json' };
import { AttestationError, fetchAndVerifyReport, readQuoteFields, verifyRecord } from './attestation.js';

const gw = report.gateway_attestation;
const nonce = gw.request_nonce;

describe('readQuoteFields', () => {
  it('reads report_data and rtmr3 from a recorded TDX quote', () => {
    const f = readQuoteFields(gw.intel_quote);
    expect(f.version).toBe(4);
    expect(f.reportData).toBe(gw.report_data);
    expect(f.rtmr3).toBe(report.gateway_attestation.info.tcb_info.rtmr3);
    expect(f.mrtd).toBe(report.gateway_attestation.info.tcb_info.mrtd);
  });
});

describe('verifyRecord', () => {
  it('accepts the recorded gateway report with its nonce', () => {
    const v = verifyRecord(gw, nonce);
    expect(v.signingAddress).toBe(gw.signing_address);
    expect(v.checks).toContain('quote report_data binds signing_address and nonce');
  });

  it('rejects a replayed report under a different nonce', () => {
    expect(() => verifyRecord(gw, 'ab'.repeat(32))).toThrow(/request_nonce/);
    expect(() => verifyRecord({ ...gw, request_nonce: 'ab'.repeat(32) }, 'ab'.repeat(32))).toThrow(/report_data does not bind/);
  });

  it('rejects a swapped signer', () => {
    expect(() => verifyRecord({ ...gw, signing_address: 'cd'.repeat(32) }, nonce)).toThrow(AttestationError);
  });

  it('rejects a mismatched algorithm', () => {
    expect(() => verifyRecord({ ...gw, signing_algo: 'ecdsa' }, nonce)).toThrow(/signing_algo/);
  });
});

describe('fetchAndVerifyReport', () => {
  const fakeFetch = (body: unknown, status = 200): typeof fetch =>
    (async () => Response.json(body, { status })) as unknown as typeof fetch;

  it('verifies the gateway and every model candidate', async () => {
    const modelRecord = { ...gw, signing_public_key: gw.signing_address };
    const ev = await fetchAndVerifyReport({
      model: 'm',
      nonceHex: nonce,
      fetch: fakeFetch({ gateway_attestation: gw, model_attestations: [modelRecord] }),
    });
    expect(ev.models).toHaveLength(1);
    expect(ev.models[0]?.signingPublicKey).toBe(gw.signing_address);
  });

  it('fails closed when model evidence is requested but absent', async () => {
    await expect(
      fetchAndVerifyReport({ model: 'm', nonceHex: nonce, fetch: fakeFetch({ gateway_attestation: gw }) }),
    ).rejects.toThrow(/missing or empty/);
  });

  it('drops bad candidates and keeps good ones', async () => {
    const good = { ...gw, signing_public_key: gw.signing_address };
    const bad = { ...good, signing_address: 'ef'.repeat(32) };
    const ev = await fetchAndVerifyReport({
      model: 'm',
      nonceHex: nonce,
      fetch: fakeFetch({ gateway_attestation: gw, model_attestations: [bad, good] }),
    });
    expect(ev.models).toHaveLength(1);
    expect(ev.rejected).toHaveLength(1);
  });
});
