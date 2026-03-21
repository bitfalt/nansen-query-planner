# Parser Battle-Test Plan

## Goal
Make the planner and parsers reliable before adding any LLM planning layer.

## Budget profiles
- Safe run: `8` calls, `80` credits
- Expanded run: `10` calls, `200` credits

Safe runs should be the default for live validation.
Expanded runs should only be used for a canonical demo thesis or for collecting one missing payload family.

## What to collect next
Highest-value missing live samples:
1. `q7` holders
2. `q9` pnl
3. non-empty `q10` ohlcv
4. more diverse `q3` indicators

For each captured run, save:
- thesis text
- token / chain
- whether the outcome feels bullish, bearish, or mixed
- raw `q*.txt` outputs exactly as returned by the CLI

## Recommended low-spend thesis prompts

### 1. Smart-money accumulation thesis
Prompt:
`Smart money is accumulating HYPE before the market fully reacts.`

Why:
- exercises `q1`, `q2`, `q4`, `q5`, `q6`, `q8`
- good baseline for flows + participant behavior

Recommended profile:
- safe

### 2. Catalyst thesis
Prompt:
`A lot of capital is moving into Starknet since they just revealed private BTC and private ERC20s. I believe smart money is moving into Starknet.`

Why:
- exercises thesis inference
- gives good `q3`, `q4`, `q5`, `q6`, `q8` material

Recommended profile:
- safe first
- expanded only once if you specifically want `q3` and `q7`

### 3. Concentration / holder-risk thesis
Prompt:
`This token is too concentrated in a few wallets and the holder base is unhealthy.`

Why:
- increases the odds that `q7` is selected and worth the spend
- helpful for refining holder concentration parsing

Recommended profile:
- expanded

### 4. Crowded-trade / over-owned thesis
Prompt:
`This token looks crowded and late longs are likely trapped.`

Why:
- increases the value of `q9` pnl
- useful for refining crowding heuristics

Recommended profile:
- expanded

### 5. Momentum confirmation thesis
Prompt:
`Price momentum is finally confirming the capital rotation into this token.`

Why:
- better chance of needing `q3` and `q10`
- useful for non-empty OHLCV and indicator payloads

Recommended profile:
- expanded

## Cheapest practical collection strategy
- Do `2-3` safe runs first to harden `q1`, `q2`, `q4`, `q5`, `q6`, `q8`
- Do `1` expanded run focused on holders / pnl / ohlcv collection
- Stop and convert the raw outputs into fixtures before spending more

## Suggested fixture naming
- `fixtures/live-samples/<slug>/q1.txt`
- `fixtures/live-samples/<slug>/q2.txt`
- `fixtures/live-samples/<slug>/meta.json`

Example slugs:
- `hype-smart-money-safe`
- `starknet-catalyst-safe`
- `holder-risk-expanded`
- `crowded-trade-expanded`
- `momentum-confirmation-expanded`

## Replaying a saved run
Use the replay tool to evaluate new parser behavior against an old run without spending more credits:

```bash
bun run bin/replay-parser-run.ts \
  --run-dir outputs/runs/<run-id> \
  --thesis "A lot of capital is moving into Starknet since they just revealed private BTC and private ERC20s. I believe smart money is moving into Starknet." \
  --max-calls 8 \
  --max-credits 80
```

That lets you iterate on parsing and verdict logic offline.

## Fixture verification
Once curated fixture files exist in `fixtures/live-samples`, verify the current parser and thesis-scoring behavior offline with:

```bash
bun run fixtures:verify
```

This is the safest way to regression-test parser changes before spending more credits.
