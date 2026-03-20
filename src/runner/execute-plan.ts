import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlannerRun, Evidence } from '../types'
import { runNansenCommand } from '../nansen/command-runner'

function splitCommand(command: string): string[] {
  return command.split(' ').filter(Boolean).slice(1) // drop leading `nansen`
}

export function executePlan(run: PlannerRun, outputDir: string): PlannerRun {
  mkdirSync(outputDir, { recursive: true })
  const evidence: Evidence[] = []

  for (const step of run.steps) {
    const result = runNansenCommand(splitCommand(step.command))
    const outPath = join(outputDir, `${step.id}.txt`)
    writeFileSync(outPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))

    const summary = result.success
      ? `${step.label} executed successfully.`
      : `${step.label} failed or needs auth/config before a live result is available.`

    const stance = step.expectedSignal === 'supportive' ? 'bull' : step.expectedSignal === 'contradictory' ? 'bear' : 'neutral'
    evidence.push({
      id: `ev_${step.id}`,
      stepId: step.id,
      summary,
      stance,
      rawOutputPath: outPath,
    })
  }

  return { ...run, evidence, executed: true }
}
