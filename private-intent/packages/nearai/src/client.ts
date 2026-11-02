import { utf8ToBytes } from '@noble/hashes/utils.js';
import { fetchAndVerifyReport, type PreflightEvidence } from './attestation.js';
import {
  decryptHexString,
  ed25519PublicToX25519,
  encryptStringHex,
  generateClientKeyPair,
  sha256Hex,
} from './crypto.js';
import { verifySignature, type SignatureResponse, type SignatureVerdict } from './signature.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PrivateChatOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  baseUrl?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  /** Also encrypt tool fields. Sent as X-Encrypt-All-Fields. */
  encryptAllFields?: boolean | undefined;
  fetch?: typeof fetch | undefined;
  signatureRetries?: number | undefined;
}

export interface PrivateChatResult {
  content: string;
  reasoning?: string | undefined;
  chatId: string;
  model: string;
  e2ee: { used: true; modelPublicKey: string; clientPublicKey: string };
  preflight: PreflightEvidence;
  signature: SignatureVerdict;
  requestHash: string;
  responseHash: string;
  headersSent: Record<string, string>;
}

/**
 * One end-to-end encrypted chat completion: preflight attestation with a fresh nonce,
 * content encrypted to the verified model key, exact bytes retained, reply decrypted,
 * response signature fetched and matched to the preflight evidence.
 */
export async function privateChat(options: PrivateChatOptions): Promise<PrivateChatResult> {
  const f = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? 'https://cloud-api.near.ai/v1';
  const preflight = await fetchAndVerifyReport({
    baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    signingAlgo: 'ed25519',
    fetch: f,
  });
  const modelReport = preflight.models[0];
  if (!modelReport || preflight.models.length !== 1) {
    throw new Error(`need exactly one verified model report, got ${preflight.models.length}`);
  }
  const modelX25519 = ed25519PublicToX25519(modelReport.signingPublicKey);
  const client = generateClientKeyPair();

  const body = JSON.stringify({
    model: options.model,
    stream: false,
    messages: options.messages.map((m) => ({ role: m.role, content: encryptStringHex(m.content, modelX25519) })),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  });
  const requestBytes = utf8ToBytes(body);
  const headersSent: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'identity',
    'X-Signing-Algo': 'ed25519',
    'X-Client-Pub-Key': client.publicKeyHex,
    'X-Model-Pub-Key': modelReport.signingPublicKey,
    'X-Encryption-Version': '2',
    'x-no-aliasing': 'true',
    ...(options.encryptAllFields ? { 'X-Encrypt-All-Fields': 'true' } : {}),
  };
  const res = await f(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { ...headersSent, Authorization: `Bearer ${options.apiKey}` },
    body,
  });
  const responseBytes = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) {
    throw new Error(`chat completion returned ${res.status}: ${new TextDecoder().decode(responseBytes).slice(0, 300)}`);
  }
  const parsed = JSON.parse(new TextDecoder().decode(responseBytes)) as {
    id: string;
    model: string;
    choices: { finish_reason?: string; message: { content: string | null; reasoning_content?: string; reasoning?: string } }[];
  };
  const choice = parsed.choices[0];
  const msg = choice?.message;
  if (!msg) throw new Error('completion has no choices');
  if (typeof msg.content !== 'string') {
    throw new Error(`completion has no content (finish_reason ${choice?.finish_reason ?? 'unknown'}); raise maxTokens, reasoning models spend tokens before answering`);
  }
  const content = decryptHexString(msg.content, client.x25519Secret);
  const reasoningHex = msg.reasoning_content ?? msg.reasoning;
  const reasoning = reasoningHex ? decryptHexString(reasoningHex, client.x25519Secret) : undefined;

  let sig: SignatureResponse | undefined;
  const retries = options.signatureRetries ?? 5;
  for (let i = 0; i < retries; i++) {
    const r = await f(`${baseUrl}/signature/${encodeURIComponent(parsed.id)}?signing_algo=ed25519`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${options.apiKey}` },
    });
    if (r.status === 404) {
      await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
      continue;
    }
    sig = (await r.json()) as SignatureResponse;
    break;
  }
  const signature = sig
    ? verifySignature({
        sig,
        requestBytes,
        responseBytes,
        modelId: options.model,
        modelSigners: preflight.models.map((m) => m.signingAddress),
        gatewaySigner: preflight.gateway.signingAddress,
      })
    : { verified: false, kind: 'unknown' as const, expectedText: '', reason: 'no signature after retries', signer: '' };

  return {
    content,
    reasoning,
    chatId: parsed.id,
    model: parsed.model,
    e2ee: { used: true, modelPublicKey: modelReport.signingPublicKey, clientPublicKey: client.publicKeyHex },
    preflight,
    signature,
    requestHash: sha256Hex(requestBytes),
    responseHash: sha256Hex(responseBytes),
    headersSent,
  };
}
