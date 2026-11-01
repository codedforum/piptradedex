# Rules for work in this repository

- Only code under `private-intent/` is the NEAR HACKATHON entry. Nothing is copied from the closed PipTradeDex application.
- No secrets in the tree. Keys live in `.env` (ignored) or the environment. The `.env.example` lists names only.
- Code comments describe what the code does. No roadmap, strategy or comparisons in comments.
- Every privacy claim in docs names its source (a doc page, a test, or a measured result). Never write "100% private". Shield and unshield transactions publicly link a wallet.
- No stop-loss claims. The 1Click orders API documents LIMIT GTC only.
- Mainnet actions move real funds. Dry quotes (`dry: true`) are the default in tests and demos.
- Commit small and often. Never rewrite history.
- Plain punctuation in all text: no em dashes, no middots, no plus signs used as connectors.
