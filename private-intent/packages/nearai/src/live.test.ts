import { describe, expect, it } from 'vitest';
import { fetchAndVerifyReport } from './attestation.js';
import { privateChat } from './client.js';

// Gateway attestation is public. The chat test needs NEAR_AI_API_KEY and runs only with LIVE_NEARAI=1.
const live = process.env.LIVE_NEARAI === '1';
const key = process.env.NEAR_AI_API_KEY;
const model = process.env.NEAR_AI_MODEL ?? 'z-ai/glm-5.3-flash';

describe.skipIf(!live)('NEAR AI Cloud live', () => {
  it('verifies a fresh gateway attestation without a key', async () => {
    const ev = await fetchAndVerifyReport({ signingAlgo: 'ed25519' });
    expect(ev.gateway.checks).toContain('quote report_data binds signing_address and nonce');
  }, 30_000);

  it.skipIf(!key)('runs one E2EE completion and verifies its signature', async () => {
    const r = await privateChat({
      apiKey: key as string,
      model,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      maxTokens: 20,
      encryptAllFields: true,
    });
    console.log(JSON.stringify({ model: r.model, content: r.content, signature: r.signature, headers: Object.keys(r.headersSent) }, null, 2));
    expect(r.content.toLowerCase()).toContain('ready');
    expect(r.signature.verified).toBe(true);
  }, 120_000);
});
