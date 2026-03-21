#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildEvidenceFromCommand, buildWeekOnePlan } from '../src/index'

function getArg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return fallback
  return process.argv[idx + 1] ?? fallback
}

const thesis = getArg('--thesis')
const runDir = getArg('--run-dir')
const token = getArg('--token')
const chain = getArg('--chain')
const maxCalls = Number(getArg('--max-calls', '10'))
const maxCredits = Number(getArg('--max-credits', '200'))

if (!thesis || !runDir) {
  console.error('Usage: bun run bin/replay-parser-run.ts --run-dir <dir> --thesis <text> [--token T] [--chain C]')
  process.exit(1)
}

if (!existsSync(runDir)) {
  console.error(`Run directory not found: ${runDir}`)
  process.exit(1)
}

const availableSteps = new Set(
  readdirSync(runDir)
    .filter((entry) => /^q\d+\.txt$/.test(entry))
    .map((entry) => entry.replace(/\.txt$/, '')),
)

const steps = buildWeekOnePlan({
  thesis,
  token,
  chain,
  mode: 'plan',
  maxCalls,
  maxCredits,
}).filter((step) => availableSteps.has(step.id))

const replay = steps.map((step) => {
  const rawOutputPath = join(runDir, `${step.id}.txt`)
  const stdout = readFileSync(rawOutputPath, 'utf8')
  const evidence = buildEvidenceFromCommand(
    step,
    { success: true, stdout, stderr: '', exitCode: 0 },
    rawOutputPath,
  )

  return {
    stepId: step.id,
    queryFamily: step.queryFamily,
    stance: evidence.stance,
    signalStrength: evidence.signalStrength,
    summary: evidence.summary,
    metrics: evidence.metrics,
  }
})

console.log(JSON.stringify({ runDir, replayedSteps: replay.length, replay }, null, 2))
