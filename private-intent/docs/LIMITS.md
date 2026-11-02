# Limits

What this software does not do, does not prove, or does not know. Each item names where it comes from.

## Privacy

- The deposit and the payout are ordinary public transactions on their chains. Asset, amount, sender and recipient are visible there. (Receipt legs `deposit` and `payout`.)
- Confidential Intents runs on a permissioned NEAR fork with a small validator set, a private PoA bridge and a private relay. The docs say public observers do not see swaps or FAR balances, and that the relay reads balances and quote traffic. They do not say what the validators or the bridge operator can see. The receipt marks those observers as not named. (docs.near-intents.org, market makers, Confidential Intents.)
- A shield or unshield transaction publicly links a wallet to an Intents account. Those legs are LINKABLE in the receipt.
- The leak tester measures linkability with four public-data heuristics on a sample. A result is evidence for that sample, not a proof, and the sample size is stated with every result. On the live app's first 116 trades, confidential routing did not reduce linkability (`experiments/leak-study/REPORT.md`): the public deposit and payout legs are enough to link nine trades in ten by usd size and timing at this volume.
- The difference between `basic` and `advanced` confidentiality is not described in the 1Click docs. Until measured side by side, the receipt treats both the same.
- Confidential quotes require authentication. A keyless run quotes the public route and says so.

## AI

- End-to-end encryption covers message content and reasoning by default, and tool fields only with `X-Encrypt-All-Fields: true`. The gateway still sees request metadata: model id, timing, size and the public key headers.
- The response signature binds a response to a model signing key. Instances of one model share a key, so a match does not prove which instance answered. A `gateway` signature proves the gateway signed the bytes, not that the model produced them. (docs.near.ai, response signatures.)
- This code checks the attestation report structurally: nonce echo, the quote's report_data binding the signing key and nonce, and the MRTD and RTMR3 fields. It does not yet run an Intel DCAP quote verifier over the quote signature chain, replay the RTMR3 event log, or check MRCONFIGID against the compose hash. Those steps are documented at docs.near.ai, verification reference, and are listed here so nobody reads the attestation check as complete.
- Which models support E2EE and `provider_tee` signatures is not listed by the models endpoint. The demo records what the live run returned.
- The live model (z-ai/glm-5.3-flash) reasons before it answers. A turn takes 8 to 22 seconds and the reasoning spends output tokens, so the completion cap is 3000. The provider flags that are meant to switch reasoning off did not do so reliably in testing, and one of them moved the reasoning into the answer text.
- The model may ask a question instead of returning a plan. The box carries at most six earlier turns of 600 characters each. Longer instructions are refused, not truncated.
- A dollar amount is converted at the app's own price feed when the plan is compiled, not when the trade executes. If the app has no price for the sell asset, the plan is shown without a quantity and the form fills after a quote.
- A destination is accepted only when the exact string appears in something the user typed. Names, ENS and "the same wallet as last time" are not resolved and come back as a question.

## Trading

- Orders are LIMIT, GTC, confidentiality `basic` only, as the 1Click orders API documents. There is no stop-loss or take-profit. A ladder is N independent limit orders, and cancel-all is N cancels that can race a final fill.
- Intents has no testnet. Every executed trade is a mainnet trade with real funds.
- Price and amount math in the ladder compiler uses JavaScript numbers for tranche spacing. Quantities are then converted to integer units. Rounding at the eighth decimal is visible in the tests.

## Scope

- This entry uses the NEAR Intents rail only. The PipTradeDex application has other routing that is out of scope and is not described or measured here.
- The web surface lives in the closed PipTradeDex app and is described, not shipped, in `docs/INTEGRATION_MAP.md`. The CLI demo is the open entry point.
