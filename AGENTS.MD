# AGENTS.MD

This repository is the reusable Nansen Query Planner foundation.

## Repository role
This repo owns the shared intelligence engine.
It should remain reusable and package-like.
It is not the Week 1 app shell itself.

Week 1 product shell lives in:
- https://github.com/bitfalt/nansen-thesis-battlefield

## What this repo should contain
- thesis/question parsing
- query planning
- command execution abstraction
- token/entity resolution
- evidence normalization
- verdict logic
- markdown + JSON report generation

## What this repo should NOT contain
- week-specific UI shell logic
- presentation-heavy submission-only code
- ad hoc demo hacks that do not belong in the reusable engine

## Non-negotiable rules
- Commits must always be in English.
- Commits must always be atomic.
- Commits must always follow Conventional Commits.
- Do not commit secrets.
- Do not document personal machine-specific secret file paths in public docs.

## Credit discipline
Current budget is finite and should still be treated carefully.
Use `docs/credit-budget.md` as the source of truth before doing more live runs.

Default rule:
- planning mode first
- bounded live runs second
- only spend extra credits when the run answers a real product question

## If OpenCode or another agent picks this up
Read in this order:
1. `README.md`
2. `docs/credit-budget.md`
3. `docs/architecture.md`
4. `src/types.ts`
5. `src/nansen/parse-output.ts`
6. `src/verdict.ts`
7. `src/report.ts`
