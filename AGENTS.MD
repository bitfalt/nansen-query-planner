# AGENTS.MD

This repository is the reusable Nansen Query Planner foundation.

## Non-negotiable rules
- Commits must always be in English.
- Commits must always be atomic.
- Commits must always follow Conventional Commits.

## Repository role
Keep this repo focused on the reusable engine.
Do not let weekly app-shell concerns overwhelm the package design.

## Good practice rule
- planner logic should stay separate from command execution
- command execution should stay separate from report generation
- app shells should consume the planner rather than duplicating it
