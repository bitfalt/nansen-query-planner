#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveBudgetProfile,
  buildWeekOnePlan,
  buildMarkdownReport,
  buildStructuredReport,
  buildThesisProfile,
  executePlan,
  type PlannerRun,
} from '../src/index'

function getArg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return fallback
  return process.argv[idx + 1] ?? fallback
}

const token = getArg('--token')
const thesis = getArg('--thesis', 'Smart money is accumulating this token')!
const chain = getArg('--chain')
const mode = (getArg('--mode', 'plan') as 'plan' | 'execute')
const budgetProfile = resolveBudgetProfile(getArg('--budget-profile', 'safe'))
const maxCallsArg = Number(getArg('--max-calls', String(budgetProfile.maxCalls)))
const maxCreditsArg = Number(getArg('--max-credits', String(budgetProfile.maxCredits)))
const runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`
const runDir = join(process.cwd(), 'outputs', 'runs', runId)
mkdirSync(runDir, { recursive: true })
const maxCredits = Number.isFinite(maxCreditsArg) && maxCreditsArg > 0 ? maxCreditsArg : undefined
const profile = buildThesisProfile({ token, thesis, chain, mode, maxCalls: maxCallsArg, maxCredits })

let run: PlannerRun = {
  runId,
  input: { token, thesis, chain, mode, maxCalls: maxCallsArg, maxCredits },
  steps: buildWeekOnePlan({ token, thesis, chain, mode, maxCalls: maxCallsArg, maxCredits }),
  evidence: [],
  executed: false,
}

if (mode === 'execute') {
  run = executePlan(run, runDir)
}

const report = buildMarkdownReport(run)
const structured = buildStructuredReport(run)
const reportPath = join(runDir, 'report.md')
const jsonPath = join(runDir, 'report.json')
writeFileSync(reportPath, report)
writeFileSync(jsonPath, JSON.stringify(structured, null, 2))

console.log(
  JSON.stringify(
    {
      success: true,
      runId,
      mode,
      budgetProfile: budgetProfile.name,
      thesisProfile: profile,
      maxCredits: maxCredits ?? null,
      maxCalls: maxCallsArg,
      steps: run.steps.length,
      executed: run.executed,
      reportPath,
      jsonPath,
    },
    null,
    2,
  ),
)
