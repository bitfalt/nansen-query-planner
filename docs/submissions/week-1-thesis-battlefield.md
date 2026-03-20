# Week 1 Submission Draft — Thesis Battlefield

## One-liner
Paste a thesis or token claim and the agent uses Nansen data to determine whether onchain reality supports or contradicts it.

## Why this fits Week 1
- clear to explain
- agent-native
- naturally supports 10+ API calls
- strong technical-depth story via query planning and evidence trace

## MVP input
- thesis text
- token
- optional chain override
- mode: plan or execute

## MVP output
- planned query sequence
- visible query trace
- evidence summary
- markdown report
- execution mode signal (plan vs execute)

## Demo flow
1. Input thesis + token
2. Planner generates the investigation sequence
3. CLI calls execute or simulate depending on mode
4. Evidence is summarized into bull / bear / neutral buckets
5. Final markdown report is produced

## What still needs to become fully end-to-end
- real authenticated execute-mode run with credit tracking
- richer evidence extraction from live command outputs
- final verdict logic beyond placeholder stance mapping
- polished submission assets and X post packaging
