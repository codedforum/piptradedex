import { hexToBytes } from '@noble/hashes/utils.js';
import { randomNonceHex } from './crypto.js';

export interface AttestationRecord {
  signing_address: string;
  signing_algo: string;
  intel_quote: string;
  report_data?: string;
  request_nonce?: string;
  signing_public_key?: string;
  info?: unknown;
  event_log?: unknown;
}

export interface AttestationReport {
  gateway_attestation: AttestationRecord;
  model_attestations?: AttestationRecord[];
}

export interface VerifiedReport {
  signingAddress: string;
  signingAlgo: string;
  /** Hex of the 64 report_data bytes read from the quote body. */
  quoteReportData: string;
  /** Hex of the quote's MRTD and RTMR3 measurements. */
  mrtd: string;
  rtmr3: string;
  checks: string[];
}

export class AttestationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttestationError';
  }
}

/** Offsets in an Intel TDX quote: 48 byte header, then the TD report body. */
const QUOTE_HEADER_BYTES = 48;
const TD_REPORT_MRTD_OFFSET = 136;
const TD_REPORT_RTMR3_OFFSET = 472;
const TD_REPORT_DATA_OFFSET = 520;
const TD_REPORT_DATA_BYTES = 64;

export function readQuoteFields(intelQuoteHex: string): { version: number; reportData: string; mrtd: string; rtmr3: string } {
  const quote = hexToBytes(intelQuoteHex);
  if (quote.length < QUOTE_HEADER_BYTES + TD_REPORT_DATA_OFFSET + TD_REPORT_DATA_BYTES) {
    throw new AttestationError('intel_quote is shorter than a TDX quote body');
  }
  const version = (quote[0] ?? 0) | ((quote[1] ?? 0) << 8);
  const start = QUOTE_HEADER_BYTES + TD_REPORT_DATA_OFFSET;
  const rtStart = QUOTE_HEADER_BYTES + TD_REPORT_RTMR3_OFFSET;
  const mrStart = QUOTE_HEADER_BYTES + TD_REPORT_MRTD_OFFSET;
  return {
    version,
    reportData: toHex(quote.subarray(start, start + TD_REPORT_DATA_BYTES)),
    mrtd: toHex(quote.subarray(mrStart, mrStart + 48)),
    rtmr3: toHex(quote.subarray(rtStart, rtStart + 48)),
  };
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Structural checks on one attestation record against the client nonce:
 * the echoed nonce matches, the quote's report_data binds signing key then nonce,
 * and any returned report_data field equals the quote. Intel DCAP quote signature
 * verification is a separate step, see docs/LIMITS.md.
 */
export function verifyRecord(record: AttestationRecord, clientNonceHex: string, expectAlgo = 'ed25519'): VerifiedReport {
  const checks: string[] = [];
  if (record.signing_algo !== expectAlgo) {
    throw new AttestationError(`signing_algo ${record.signing_algo} is not ${expectAlgo}`);
  }
  checks.push('signing_algo matches');
  if (record.request_nonce !== clientNonceHex) {
    throw new AttestationError('request_nonce does not echo the client nonce');
  }
  checks.push('request_nonce echoes client nonce');
  const fields = readQuoteFields(record.intel_quote);
  const expected = (record.signing_address + clientNonceHex).toLowerCase();
  if (fields.reportData !== expected) {
    throw new AttestationError('quote report_data does not bind signing_address and nonce');
  }
  checks.push('quote report_data binds signing_address and nonce');
  if (record.report_data !== undefined && record.report_data.toLowerCase() !== fields.reportData) {
    throw new AttestationError('report_data field differs from the quote');
  }
  if (record.report_data !== undefined) checks.push('report_data field equals quote');
  return {
    signingAddress: record.signing_address,
    signingAlgo: record.signing_algo,
    quoteReportData: fields.reportData,
    mrtd: fields.mrtd,
    rtmr3: fields.rtmr3,
    checks,
  };
}

export interface FetchReportOptions {
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
  model?: string | undefined;
  signingAlgo?: 'ed25519' | 'ecdsa' | undefined;
  nonceHex?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export interface PreflightEvidence {
  nonceHex: string;
  gateway: VerifiedReport;
  /** Every model candidate that passed verification. Empty when none was returned. */
  models: (VerifiedReport & { signingPublicKey: string })[];
  rejected: string[];
}

/** Fetch the attestation report with a fresh nonce and verify every candidate. */
export async function fetchAndVerifyReport(options: FetchReportOptions = {}): Promise<PreflightEvidence> {
  const nonceHex = options.nonceHex ?? randomNonceHex();
  const algo = options.signingAlgo ?? 'ed25519';
  const url = new URL(`${options.baseUrl ?? 'https://cloud-api.near.ai/v1'}/attestation/report`);
  url.searchParams.set('provider', 'near');
  url.searchParams.set('signing_algo', algo);
  url.searchParams.set('nonce', nonceHex);
  if (options.model) url.searchParams.set('model', options.model);
  const headers: Record<string, string> = { Accept: 'application/json', 'x-no-aliasing': 'true' };
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
  const res = await (options.fetch ?? fetch)(url, { headers });
  if (!res.ok) throw new AttestationError(`attestation report returned ${res.status}`);
  const report = (await res.json()) as AttestationReport;

  const gateway = verifyRecord(report.gateway_attestation, nonceHex, algo);
  const models: PreflightEvidence['models'] = [];
  const rejected: string[] = [];
  if (options.model) {
    const candidates = report.model_attestations ?? [];
    if (candidates.length === 0) throw new AttestationError('model_attestations is missing or empty');
    for (const c of candidates) {
      try {
        const v = verifyRecord(c, nonceHex, algo);
        if (!c.signing_public_key) throw new AttestationError('model report has no signing_public_key');
        models.push({ ...v, signingPublicKey: c.signing_public_key });
      } catch (e) {
        rejected.push((e as Error).message);
      }
    }
    if (models.length === 0) throw new AttestationError(`no model report verified: ${rejected.join('; ')}`);
  }
  return { nonceHex, gateway, models, rejected };
}
