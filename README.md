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
The planner now emits:
- `report.md` for humans
- `report.json` for agents / LLMs / downstream automation

## Development
```bash
bun install
bun run planner:demo
bun run typecheck
```
