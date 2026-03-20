import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlannerRun, Evidence } from '../types'
import { runNansenCommand } from '../nansen/command-runner'
import { buildEvidenceFromCommand } from '../nansen/parse-output'

function splitCommand(command: string): string[] {
  return command.split(' ').filter(Boolean).slice(1)
}

export function executePlan(run: PlannerRun, outputDir: string): PlannerRun {
  mkdirSync(outputDir, { recursive: true })
  const evidence: Evidence[] = []

  for (const step of run.steps) {
    const result = runNansenCommand(splitCommand(step.command))
    const outPath = join(outputDir, `${step.id}.txt`)
    writeFileSync(outPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))
    evidence.push(buildEvidenceFromCommand(step, result, outPath))
  }

  return { ...run, evidence, executed: true }
}
