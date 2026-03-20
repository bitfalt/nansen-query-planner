#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildWeekOnePlan, buildMarkdownReport, buildStructuredReport, executePlan, type PlannerRun } from '../src/index'

function getArg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return fallback
  return process.argv[idx + 1] ?? fallback
}

const token = getArg('--token', 'TOKEN')!
const thesis = getArg('--thesis', 'Smart money is accumulating this token')!
const chain = getArg('--chain', 'solana')!
const mode = (getArg('--mode', 'plan') as 'plan' | 'execute')
const maxCallsArg = Number(getArg('--max-calls', '10'))
const runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`
const runDir = join(process.cwd(), 'outputs', 'runs', runId)
mkdirSync(runDir, { recursive: true })

let run: PlannerRun = {
  runId,
  input: { token, thesis, chain, mode, maxCalls: maxCallsArg },
  steps: buildWeekOnePlan({ token, thesis, chain, mode }).slice(0, Number.isFinite(maxCallsArg) ? maxCallsArg : 10),
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

console.log(JSON.stringify({
  success: true,
  runId,
  mode,
  steps: run.steps.length,
  executed: run.executed,
  reportPath,
  jsonPath,
}, null, 2))
