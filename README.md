# Nansen Query Planner

Last updated: 2026-03-20T06:37:44Z

Nansen Query Planner is the shared intelligence engine for Daniel's 4-week Nansen CLI mini hackathon strategy.

The core idea:
- one reusable agentic query-planning engine
- multiple weekly application shells built on top of it
- Week 1 shell: Thesis Battlefield

## Why this repo exists

Instead of building four disconnected mini-projects, this repo compounds one reusable foundation:
- goal parsing
- cost-aware query planning
- evidence normalization
- verdict/report generation
- visible query trace for demos and X posts

## Weekly app shells

- Week 1: Thesis Battlefield
- Week 2: Divergence Radar
- Week 3: Conviction Detector
- Week 4: Protocol Lead Scorer

## Current status

Implemented foundation:
- reusable query planner package
- capability registry for Nansen command families
- Thesis Battlefield CLI entrypoint
- report generation and run artifact scaffolding
- docs and submission planning structure

## Repository structure

```text
apps/
  thesis-battlefield/
packages/
  query-planner/
docs/
  submissions/
  x-posts.md
outputs/
  runs/
fixtures/
  sample-theses/
```

## Quick start

Requirements:
- Bun
- Node 18+
- Nansen CLI (`npm install -g nansen-cli`) or local `npx nansen-cli` access
- `NANSEN_API_KEY` for live execution

Install:

```bash
bun install
```

Plan a run (no API key needed):

```bash
bun run thesis-battlefield --token HYPE --thesis "Smart money is accumulating HYPE" --mode plan
```

Attempt live execution (requires Nansen CLI + API key):

```bash
bun run thesis-battlefield --token HYPE --thesis "Smart money is accumulating HYPE" --chain solana --mode execute
```

## Week 1 product — Thesis Battlefield

One-liner:
Paste a thesis or token claim and the agent uses Nansen data to determine whether onchain reality supports or contradicts it.

Output includes:
- strongest bull case
- strongest bear case
- contradictions/caveats
- confidence score
- ordered query trace
- call count / budget view
- markdown report artifact

## Current caveat

The codebase supports real live execution if `nansen` CLI and `NANSEN_API_KEY` are configured, but that should still be tested against the current local environment before claiming final hackathon readiness.
