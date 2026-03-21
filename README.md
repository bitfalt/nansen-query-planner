# Nansen Query Planner

Reusable planning and execution layer for Nansen CLI investigations.

This repository is the shared foundation package.
It is not the Week 1 product shell itself.

Current intended consumer:
- `nansen-thesis-battlefield` (Week 1 app shell)

## Core responsibilities
- parse a thesis or question into an investigation plan
- choose an ordered query path under a bounded budget
- execute bounded Nansen CLI calls
- normalize evidence
- generate both human-readable and agent-consumable reports

## Report surfaces
The planner emits:
- `report.md` for humans
- `report.json` for agents / LLMs / downstream automation

## Current limitation
The planner is now command-family-aware and budget-aware, but it still needs more saved live payload fixtures to fully harden every parser and verdict rule.

## Development
```bash
bun install
bun run planner:demo
bun run planner:demo:safe
bun run planner:demo:expanded
bun run fixtures:verify
bun run typecheck
```

## Budget profiles
- `safe`: `8` calls / `80` credits
- `expanded`: `10` calls / `200` credits

Use `docs/parser-battle-test-plan.md` to decide which live runs are worth spending credits on.
