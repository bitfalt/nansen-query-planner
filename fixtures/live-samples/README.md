# Live Sample Fixtures

Store raw successful CLI payloads here to improve parser quality without re-spending credits.

Recommended structure:

```text
fixtures/live-samples/<sample-slug>/
  meta.json
  q1.txt
  q2.txt
  q3.txt
  ...
```

Suggested `meta.json` shape:

```json
{
  "thesis": "A lot of capital is moving into Starknet since they just revealed private BTC and private ERC20s. I believe smart money is moving into Starknet.",
  "token": "STRK",
  "chain": "starknet",
  "budgetProfile": "safe",
  "notes": "Mixed result; useful for q3/q5/q6/q8",
  "expectedFeel": "mixed"
}
```

Keep the raw outputs exactly as returned by the Nansen CLI.
