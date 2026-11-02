# Leak study

Run 2026-11-02 over the completed trades of the live PipTradeDex app, through `GET /api/public/leak-study`, which calls `leak.runStudy` from `packages/leak`. The raw response is in `data/live-2026-11-02.json`. The same endpoint is public and re-runs on every request, so the numbers on https://piptradedex.xyz/privacy-lab move as trades complete.

## Adversary

Public chain data only: for every trade the adversary sees the origin chain, the destination chain, the usd size of the deposit and of the payout, and their timestamps. It never sees the 1Click deposit address mapping, the quote, or the Intents account. Four heuristics run and their candidate sets are intersected:

| heuristic | setting |
| --- | --- |
| H1 amount match | payout usd within 2% of deposit usd |
| H2 timing | payout inside 1 hour after the deposit |
| H3 address reuse | same sender or recipient seen before |
| H4 pair rarity | threshold 0, every pair counts |

A deposit is uniquely linked when exactly one payout survives the intersection. Ground truth scores the result and never guides it.

## Arms

`private` is every trade that settled through NEAR Intents with `confidentiality: basic`. `public` is every trade that settled through the public 1Click route. There is no `advanced` arm, the app has not sent an advanced-confidentiality order yet.

## Result

| arm | trades | uniquely linked | correctly linked | mean anonymity set | linked fraction |
| --- | --- | --- | --- | --- | --- |
| private (confidential basic) | 101 | 90 | 90 | 1.02 | 0.891 |
| public | 15 | 13 | 13 | 0.87 | 0.867 |

## Reading

- Confidential routing did not reduce linkability in this sample. Nine in ten trades on either arm are linked by usd size and timing alone.
- The reason is structural and is what the Privacy Receipt already says: the deposit and the payout are ordinary public transactions on their chains, whatever happens in between. The confidential route hides the swap from NEAR observers, it does not hide the two public legs from a chain observer who can read amounts and clocks.
- Every uniquely linked trade was linked correctly, so the heuristics are not noisy, they are simply sufficient at this volume.
- The anonymity set is close to one because the app's volume is low. Linkability through amount and timing falls as concurrent volume rises, so the study should be re-run as the sample grows, and the sample sizes are printed with every result for that reason.

## What would move the number

Measured here only as a direction, not as a result: randomised payout delay, splitting a payout into tranches of round sizes, and a shielded Intents balance that is spent later instead of paid out at once. None of these is implemented in this entry.
