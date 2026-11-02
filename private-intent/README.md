# Private Intent

Type a trade in plain English. The prompt is parsed by an attested TEE model on NEAR AI Cloud under end-to-end encryption, the trade settles through NEAR Intents confidential routes, and every trade ships with a Privacy Receipt that states, leg by leg, what is hidden, what is public, what links identities, and what is not known.

Built at NEAR HACKATHON, November 1 to November 14, 2026. Tracks: privacy, defi, security.

## Try it (do X, see Y)

Requires Node 22 or newer. No keys are needed for the demo.

1. `cd private-intent && npm ci` prints the install summary.
2. `npm test` runs every unit test, expect `72 passed` and `3 skipped` (the skipped ones are live tests).
3. `npm run demo` prints six numbered sections:
   - section 1 echoes the parsed order spec,
   - section 2 the compiled 1Click request with `confidentiality: 'basic'`,
   - section 3 a live dry quote for 5 USDC on Base to USDC on NEAR (public route when no key is set, with a line that says so),
   - section 4 the gateway attestation signer and the three checks that passed against a fresh nonce,
   - section 5 the receipt legs with the receipt hash: without a key the swap was quoted on the public route, so three legs are PUBLIC and two UNKNOWN; with a partner key the swap leg reads CONFIDENTIAL,
   - section 6 the leak tester reporting `uniquelyLinked: 0` on five identical synthetic trades.
4. `ONECLICK_API_KEY=<partner jwt> LIVE_ONECLICK=1 npm test -- packages/oneclick` runs the live dry quote test.
5. `NEAR_AI_API_KEY=<key> LIVE_NEARAI=1 npm test -- packages/nearai` runs one end-to-end encrypted completion and verifies its signature, printing the headers used and the verdict.

## Live in PipTradeDex

The packages here are bundled (`npm run bundle`, output `dist/private-intent.cjs`) and loaded by the live PipTradeDex app at https://piptradedex.xyz, whose application source is closed. What the live app gained during the hackathon, all built on this library:

- Privacy Receipt on every finished swap (button on the swap card), with a download of the hashed JSON.
- A plain-English order box on the Trade page. The text is encrypted to the attested model key on NEAR AI Cloud, the reply is signature checked, and the compiled plan fills the existing swap or limit form. Nothing moves until the user confirms as before.
- The box holds a short conversation. When an instruction lacks an amount, a chain or a side, the model returns a QUESTION and the box asks it; the answer is sent with the earlier turns (at most six, each capped at 600 characters, validated server side). Dollar amounts (`$20 of usdc`) are converted at the app's price at compile time. A destination typed by the user is relayed into the form's external recipient field, and the compiler refuses any destination the model names that the user never typed (`packages/core/src/conversation.ts`).
- Ladders: one instruction becomes 2 to 5 private limit orders on NEAR Intents.
- https://piptradedex.xyz/privacy-lab: a live attestation check with a fresh nonce, the leak study over the app's own completed trades, and the receipt rules.

The glue in the live app is thin (one server module and one client script) and is described in [docs/INTEGRATION_MAP.md](docs/INTEGRATION_MAP.md). Everything judged is in this folder.

## How NEAR is used

See [docs/INTEGRATION_MAP.md](docs/INTEGRATION_MAP.md). In short: 1Click for quotes, confidential routes and limit orders; NEAR AI Cloud for the encrypted parse with attestation and response signatures.

## Results

Measured numbers only. Updated as the build goes on.

| what | value | source |
| --- | --- | --- |
| public dry quote, 5 USDC Base to USDC NEAR | 4.9996 USDC out, 35 s estimate | `packages/oneclick/src/fixtures/quote-public-dry.json`, 2026-11-01 |
| gateway attestation, fresh nonce | report_data binds signer and nonce | `npm run demo`, 2026-11-01 |
| confidential dry quote without authentication | 401, authentication required | observed 2026-11-01 |
| live E2EE parse, signature verified, prompt leg Confidential | 8 to 22 s per turn on z-ai/glm-5.3-flash | live app evidence panel, 2026-11-02 |
| live E2EE completion on other attested models | Qwen/Qwen3.8-27B and deepseek-ai/DeepSeek-V4.1-Flash-1017 pass, signature verified | `LIVE_NEARAI=1 NEAR_AI_MODEL=<id> npm test -- packages/nearai`, 2026-11-02 |
| models without an attestation report | deepseek/deepseek-v3.2, moonshotai/kimi-k2.6, google/gemini-3.5-flash return 503 on the report, the client refuses to send the prompt | same, 2026-11-02 |
| leak study, confidential basic arm | 101 trades, 90 uniquely linked (0.891) | [experiments/leak-study/REPORT.md](experiments/leak-study/REPORT.md), 2026-11-02 |
| leak study, public arm | 15 trades, 13 uniquely linked (0.867) | same |

## Limits

[docs/LIMITS.md](docs/LIMITS.md). The receipt's limits list is generated from the same text.

## Prior work vs built in this fortnight

The PipTradeDex application existed before the hackathon and is closed source. It is not part of this entry and no code was copied from it. Everything in this folder was written from November 1, 2026. The repository's first commit (2026-10-17, tag `pre-hackathon`) is a README only. Diff: `pre-hackathon...hackathon-submission`.

The same person submits one other independent project, Mandate, in the Rex repository. They share no code.

## Tests

`npm test` runs vitest across `packages/*`. `npm run typecheck` runs the TypeScript compiler in strict mode.

## Security

- The model output is data, never instructions. It is validated by a strict schema, unknown fields are rejected, and the compiler pins the recipient to the destination the user confirmed, so a prompt injection cannot redirect funds (`packages/core/src/compile.test.ts`).
- A destination in the plan must appear verbatim in a text the user typed, in this turn or an earlier one, or the plan is rejected before it reaches the form (`packages/core/src/conversation.test.ts`). The conversation history is validated for shape, length and turn order before it is sent to the model.
- The system prompt lists only the symbols and chains the app trades, so the model cannot name an asset outside the catalog.
- Attestation reports are verified against a client nonce before a prompt is sent. Response signatures are checked over the exact bytes and matched to that preflight evidence.
- No keys are in this repository. `.env.example` lists variable names only.

## Layout

```
packages/oneclick   typed 1Click client, token resolver
packages/core       OrderSpec schema, parser, compiler, Privacy Receipt
packages/nearai     E2EE crypto, attestation, signature verification, private chat
packages/leak       linkability heuristics and study runner
apps/cli            demo entry point
docs                LIMITS, INTEGRATION_MAP, RECEIPT_RULES
experiments         leak study data and report
```

## License

MIT, see the repository root.
