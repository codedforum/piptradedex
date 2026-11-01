# Privacy Receipt rules

Version 1. A receipt is a JSON object with a version, a timestamp, the order id, the sha256 of the prompt (never the prompt), a list of legs, a summary, a limits list and a hash. The hash is sha256 of the canonical JSON (keys sorted at every depth, no whitespace) of every field except the hash. `verifyReceipt` recomputes it.

## Visibility values

| value | meaning |
| --- | --- |
| PUBLIC | anyone reading the named chain sees this leg |
| CONFIDENTIAL | the documentation says public observers cannot see it, and the listed observers can |
| LINKABLE | public, and it ties two identities together |
| UNKNOWN | the software could not verify it, or the documentation is silent |

## Classification table

| leg | visibility | observers | evidence |
| --- | --- | --- | --- |
| prompt to model | CONFIDENTIAL when E2EE and the response signature both verified, otherwise UNKNOWN | gateway metadata | model id, verification flags, signer fingerprint, request and response hashes |
| shield into Confidential Intents | LINKABLE | anyone on the origin chain and NEAR | tx hash |
| deposit | PUBLIC | anyone on the origin chain | deposit tx hash |
| swap | CONFIDENTIAL for basic or advanced, PUBLIC for public | FAR validator set, bridge operator, relay, solvers (confidential); anyone on NEAR (public) | confidentiality value, status, intent and NEAR tx hashes, platform fee in bps |
| payout | PUBLIC | anyone on the destination chain | payout tx hash |
| unshield from Confidential Intents | LINKABLE | anyone on NEAR and the destination chain | tx hash |
| deposit to payout linkage | UNKNOWN until measured; PUBLIC when the leak tester linked it uniquely; CONFIDENTIAL when it could not | an adversary with public data | anonymity set size, heuristics used |

## Rules

1. A receipt never contains the prompt text, a private key, or a user session token.
2. There is no numeric privacy score. Categories and measured anonymity sets only.
3. The limits list is always present and starts with the fixed base limits.
4. The observers for a confidential swap are copied from the Confidential Intents documentation and name the parties the docs do not name as "not named in the docs".
5. "100% private" does not appear in a receipt.
