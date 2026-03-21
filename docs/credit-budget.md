# Nansen Credit Budget

## Current budget posture
- current funded balance: 10,000 credits (~$10)
- this should still be treated as finite and worth preserving carefully

## Group quotas from the current calculator
- Basic Endpoints: 10,000 lookups
- Premium Endpoints: 2,000 lookups
- Label Lookups: 20 lookups

## Important practical interpretation
Not every endpoint burns from the same bucket.
From the calculator screenshot, the broad mapping appears to be:

### Basic-style endpoints (high-volume bucket)
Examples include:
- profiler/address/current-balances
- profiler/address/historical-balances
- profiler/address/transactions
- tgm/transfers
- tgm/dcas
- profiler/address/related-wallets
- profiler/pnl-summary
- profiler/pnl
- tgm/flow-intel
- tgm/who-bought-sold
- tgm/dex-trades
- tgm/flows

### Premium-style endpoints (smaller bucket)
Examples include:
- All Smart Money endpoints
- profiler/address/counterparties
- tgm/holders
- tgm/pnl-leaderboard

### Label lookups (very constrained)
- Label endpoints: 20

## Rules
- do not burn credits casually
- prefer planning mode until a live run is actually worth the spend
- use the smallest live validation that answers a real product question
- record meaningful live tests here
- be especially careful with premium endpoints and label lookups

## Suggested operating policy for Thesis Battlefield
### Default low-cost validation path
1. search
2. token info
3. token indicators or flows only if needed
4. stop and inspect before continuing

### Avoid by default unless the run is worth it
- label-heavy workflows
- broad smart-money sweeps
- repeated premium calls without a concrete thesis change

## Live test log
- 2026-03-20T07:22:20Z: SUCCESS search query smoke test (HYPE, limit=1)
- 2026-03-20T15:58:54Z: SUCCESS bounded execute-mode validation (max-calls=2)
- 2026-03-20T21:55:12Z: SUCCESS first two execute-mode queries in a 4-call run, then later calls failed with `CREDITS_EXHAUSTED`

## Current tactical conclusion
- q1 search and q2 token info are the safest real validation path so far
- deeper expansion into q3/q4+ should still be intentional and thesis-driven
- use the 10,000 funded credits as a working budget, not permission to spray queries
