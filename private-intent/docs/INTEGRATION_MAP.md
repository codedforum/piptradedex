# Integration map

| piece | NEAR tool | where in the code | evidence |
| --- | --- | --- | --- |
| Typed REST client for quotes, status, deposits and orders | NEAR Intents, 1Click API | `packages/oneclick/src/client.ts`, types generated from `https://1click.chaindefuser.com/docs/v0/openapi.yaml` | `packages/oneclick/src/fixtures/quote-public-dry.json` recorded 2026-11-01, `npm run demo` step 3 |
| Asset resolution against the live token list | NEAR Intents, 1Click `/v0/tokens` | `packages/oneclick/src/tokens.ts` | `tokens.test.ts` |
| Confidential route request (`confidentiality` basic or advanced) | NEAR Confidential Intents | `packages/core/src/compile.ts` sets it from the OrderSpec | `compile.test.ts`, live run pending partner key |
| Limit and ladder orders | NEAR Intents, 1Click `/v0/orders` | `packages/core/src/compile.ts` | `compile.test.ts` |
| Encrypted prompt to an attested model | NEAR AI Cloud, E2EE chat completions | `packages/nearai/src/crypto.ts`, `client.ts` | `crypto.test.ts`, live run 2026-11-02 on z-ai/glm-5.3-flash with the signature verified |
| Question turns, dollar amounts, typed destination relay | prompt built from the app catalog for NEAR AI Cloud | `packages/core/src/prompt.ts`, `conversation.ts`, `spec.ts` (QUESTION kind, `amountUnit`) | `prompt.test.ts`, `conversation.test.ts`, `parse.test.ts` |
| Attestation report with fresh nonce and quote binding | NEAR AI Cloud, TEE attestation | `packages/nearai/src/attestation.ts` | `attestation.test.ts` on a recorded report, `npm run demo` step 4 on a live one |
| Response signature over exact bytes | NEAR AI Cloud, response signatures | `packages/nearai/src/signature.ts` | `signature.test.ts` |
| Privacy Receipt | describes the legs above | `packages/core/src/receipt.ts`, rules in `docs/RECEIPT_RULES.md` | `receipt.test.ts` |
| Leak tester | public chain data only | `packages/leak/src` | `link.test.ts`, `experiments/leak-study/REPORT.md` over 116 live trades |

## In the live app (closed source, described here)

| piece | built on | surface |
| --- | --- | --- |
| Privacy Receipt per trade | `core.buildReceipt` fed with the trade's chains, route and transaction hashes | `GET /api/trades/:id/privacy-receipt`, button on the finished swap card |
| Encrypted order box | `nearai.privateChat`, `core.buildParserPrompt`, `core.validateHistory`, `core.buildMessages`, `core.parseOrderSpec`, `core.destinationFromText`, `core.compile` | `POST /api/ai/parse` with `{ text, history }`, answers a QUESTION in the box or fills the swap or limit form through an event, external recipient included |
| AI evidence on the receipt | parse evidence attached to the trade after the deposit card opens | `POST /api/ai/attach` |
| Ladder | `core.ladderPrices` over the app's existing private limit order path | `POST /api/orders/ladder`, control in the limit panel |
| Leak study | `leak.runStudy` over completed trades, usd amounts and times only | `GET /api/public/leak-study`, shown on `/privacy-lab` |
| Attestation check | `nearai.fetchAndVerifyReport` with a fresh nonce | `GET /api/ai/attestation`, button on `/privacy-lab` |
