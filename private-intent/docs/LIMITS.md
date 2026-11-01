# Limits

What this software does not do, does not prove, or does not know. Each item names where it comes from.

## Privacy

- The deposit and the payout are ordinary public transactions on their chains. Asset, amount, sender and recipient are visible there. (Receipt legs `deposit` and `payout`.)
- Confidential Intents runs on a permissioned NEAR fork with a small validator set, a private PoA bridge and a private relay. The docs say public observers do not see swaps or FAR balances, and that the relay reads balances and quote traffic. They do not say what the validators or the bridge operator can see. The receipt marks those observers as not named. (docs.near-intents.org, market makers, Confidential Intents.)
- A shield or unshield transaction publicly links a wallet to an Intents account. Those legs are LINKABLE in the receipt.
- The leak tester measures linkability with four public-data heuristics on a sample. A result is evidence for that sample, not a proof, and the sample size is stated with every result.
- The difference between `basic` and `advanced` confidentiality is not described in the 1Click docs. Until measured side by side, the receipt treats both the same.
- Confidential quotes require authentication. A keyless run quotes the public route and says so.

## AI

- End-to-end encryption covers message content and reasoning by default, and tool fields only with `X-Encrypt-All-Fields: true`. The gateway still sees request metadata: model id, timing, size and the public key headers.
- The response signature binds a response to a model signing key. Instances of one model share a key, so a match does not prove which instance answered. A `gateway` signature proves the gateway signed the bytes, not that the model produced them. (docs.near.ai, response signatures.)
- This code checks the attestation report structurally: nonce echo, the quote's report_data binding the signing key and nonce, and the MRTD and RTMR3 fields. It does not yet run an Intel DCAP quote verifier over the quote signature chain, replay the RTMR3 event log, or check MRCONFIGID against the compose hash. Those steps are documented at docs.near.ai, verification reference, and are listed here so nobody reads the attestation check as complete.
- Which models support E2EE and `provider_tee` signatures is not listed by the models endpoint. The demo records what the live run returned.

## Trading

- Orders are LIMIT, GTC, confidentiality `basic` only, as the 1Click orders API documents. There is no stop-loss or take-profit. A ladder is N independent limit orders, and cancel-all is N cancels that can race a final fill.
- Intents has no testnet. Every executed trade is a mainnet trade with real funds.
- Price and amount math in the ladder compiler uses JavaScript numbers for tranche spacing. Quantities are then converted to integer units. Rounding at the eighth decimal is visible in the tests.

## Scope

- This entry uses the NEAR Intents rail only. The PipTradeDex application has other routing that is out of scope and is not described or measured here.
- The web interface and server are not built yet. The CLI demo is the current entry point.
