import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlannerRun, Evidence } from '../types'
import { runNansenCommand } from '../nansen/command-runner'
import { buildEvidenceFromCommand } from '../nansen/parse-output'
import { resolveTokenAddressFromSearch } from '../nansen/resolve-token'

function splitCommand(command: string): string[] {
  return command.split(' ').filter(Boolean).slice(1)
}

function applyResolvedToken(command: string, inputToken: string, resolvedToken: string) {
  return command.replace(`--token ${inputToken}`, `--token ${resolvedToken}`)
}

export function executePlan(run: PlannerRun, outputDir: string): PlannerRun {
  mkdirSync(outputDir, { recursive: true })
  const evidence: Evidence[] = []
  let resolvedTokenRef: string | null = null

  for (const step of run.steps) {
    const command =
      resolvedTokenRef && step.id !== 'q1'
        ? applyResolvedToken(step.command, run.input.token, resolvedTokenRef)
        : step.command

    const result = runNansenCommand(splitCommand(command))
    const outPath = join(outputDir, `${step.id}.txt`)
    writeFileSync(outPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))

    if (step.id === 'q1' && result.success) {
      resolvedTokenRef = resolveTokenAddressFromSearch(
        result.stdout,
        run.input.chain,
        run.input.token,
      )
    }

    const ev = buildEvidenceFromCommand(step, result, outPath)
    if (resolvedTokenRef && step.id === 'q1') {
      ev.summary += ` Selected ${run.input.chain} token reference: ${resolvedTokenRef}.`
      ev.metrics = {
        ...(ev.metrics || {}),
        resolvedTokenRef,
        selectedChain: run.input.chain,
      }
    }
    evidence.push(ev)
  }

  return { ...run, evidence, executed: true }
}
