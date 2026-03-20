# Nansen Query Planner

Reusable planning and execution layer for Nansen CLI investigations.

Purpose:
- turn a thesis or claim into a cost-aware Nansen investigation plan
- support visible query traces
- produce evidence-backed reports
- power multiple app shells without duplicating the core engine

## What this repo is
This repo is the shared foundation package.
It is not the Week 1 submission repo by itself.

## Current intended consumer
- Week 1 app: Nansen Thesis Battlefield

## Why this split exists
The shared asset is the planner, not the weekly wrappers.
This repo should stay reusable and importable.

## Commands
```bash
bun install
bun run planner:demo
```
