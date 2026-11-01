# PipTradeDex

PipTradeDex is a trading app that is private by default. It settles through NEAR Intents and tells the user, per route, what is hidden and what is not.

- App: https://piptradedex.xyz
- X: https://x.com/PipTradeDex

## NEAR HACKATHON entry: Private Intent

Type a trade in plain English. The prompt is parsed inside an attested TEE model on NEAR AI Cloud, the trade settles through NEAR Intents confidential routes, and every trade ships with a Privacy Receipt that states, leg by leg, what is hidden, what is public and what is not known. Built at NEAR HACKATHON, November 1 to November 14, 2026.

Code: [private-intent/](./private-intent/). Run it: see the README in that folder.

Tracks: privacy, defi.

## Prior work vs built in this fortnight

This repository has existed since 2026-10-17 as a README only (tag `pre-hackathon`, commit a8cec76). The product itself, PipTradeDex at https://piptradedex.xyz, existed before the hackathon and its application source is closed. It is not part of the entry.

Everything under `private-intent/` was written from November 1, 2026 and does not copy production code. The hackathon diff is the range `pre-hackathon...hackathon-submission`: https://github.com/codedforum/piptradedex/compare/pre-hackathon...hackathon-submission

The same person also submits a second, independent project, Mandate, an agent spending vault for the Rex trading bot: https://github.com/codedforum/rex. The two entries share no code.

## License

MIT, see [LICENSE](./LICENSE). The license covers this repository only.
