# Nansen Credit Budget

Current budget posture:
- starting known balance: 100 credits
- soft upper bound if funded later: 10,000 credits (~$10)

Rules:
- do not burn credits casually
- prefer plan mode unless validating a real flow
- use the smallest live smoke test possible first
- record every live authenticated test in this file

## Live test log
- Pending first authenticated smoke test
- 2026-03-20T07:22:20Z: SUCCESS search query smoke test (HYPE, limit=1)
- 2026-03-20T15:58:54Z: SUCCESS bounded execute-mode validation (max-calls=2)
- 2026-03-20T21:55:12Z: SUCCESS first two execute-mode queries in a 4-call run, then later calls failed with `CREDITS_EXHAUSTED`

## Current tactical conclusion
- q1 search and q2 token info are currently the safest real live validation path.
- Additional execute-mode expansion must wait until credits are replenished or a stronger budget policy is defined.
