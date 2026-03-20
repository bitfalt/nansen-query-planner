# AGENTS.MD

This repository is the build surface for the Nansen Query Planner and its weekly NansenCLI application shells.

## Non-negotiable rules
- Commits must always be in English.
- Commits must always be atomic.
- Commits must always follow Conventional Commits.
- Do not bundle unrelated weekly experiments into one commit.

## Strategic rule
The shared asset is the query planner, not the weekly wrappers.
Always protect the compounding engine first.

## Repo structure rule
- `packages/query-planner/` is the reusable foundation.
- `apps/` contains week-specific shells.
- `docs/submissions/` contains packaging for public submission clarity.

## Week 1 priority
Week 1 is Thesis Battlefield.
Do not overbuild a dashboard first. The key value is:
- thesis input
- planned queries
- evidence collection
- verdict
- query trace

## Implementation honesty
Do not claim live Nansen output unless the CLI was actually run with valid auth.
If operating in planning mode, say so clearly.
