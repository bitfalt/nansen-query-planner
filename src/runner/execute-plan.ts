import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlannerRun, Evidence } from '../types'
import { runNansenCommand } from '../nansen/command-runner'
import { buildEvidenceFromCommand } from '../nansen/parse-output'
import { resolveTokenCandidateFromSearch } from '../nansen/resolve-token'
import { buildThesisProfile } from '../thesis/profile'
import { alignEvidenceToThesis } from '../thesis/interpret-evidence'

function splitCommand(command: string): string[] {
  return command.split(' ').filter(Boolean).slice(1)
}

function applyResolvedSelection(command: string, inputToken: string, inputChain: string, resolvedToken: string, resolvedChain: string) {
  return command
    .replace(`--token ${inputToken}`, `--token ${resolvedToken}`)
    .replace(`--chain ${inputChain}`, `--chain ${resolvedChain}`)
}

export function executePlan(run: PlannerRun, outputDir: string): PlannerRun {
  mkdirSync(outputDir, { recursive: true })
  const evidence: Evidence[] = []
  const profile = buildThesisProfile(run.input)
  const inputToken = run.input.token ?? profile.tokenHint
  const inputChain = run.input.chain ?? profile.chainHint
  let resolvedTokenRef: string | null = null
  let resolvedChainRef: string | null = null

  for (const step of run.steps) {
    const command =
      resolvedTokenRef && step.id !== 'q1'
        ? applyResolvedSelection(
            step.command,
            inputToken,
            inputChain,
            resolvedTokenRef,
            resolvedChainRef ?? inputChain,
          )
        : step.command

    const result = runNansenCommand(splitCommand(command))
    const outPath = join(outputDir, `${step.id}.txt`)
    writeFileSync(outPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))

    if (step.id === 'q1' && result.success) {
      const selected = resolveTokenCandidateFromSearch(
        result.stdout,
        run.input.chain ?? profile.chainHint,
        run.input.token ?? profile.tokenHint,
      )

      resolvedTokenRef = selected?.address ?? null
      resolvedChainRef = selected?.chain ?? null
    }

    const ev = alignEvidenceToThesis(step, buildEvidenceFromCommand(step, result, outPath), profile)
    if (resolvedTokenRef && step.id === 'q1') {
      ev.summary += ` Selected ${resolvedChainRef ?? inputChain} token reference: ${resolvedTokenRef}.`
      ev.metrics = {
        ...(ev.metrics || {}),
        resolvedTokenRef,
        selectedChain: resolvedChainRef ?? inputChain,
      }
    }
    evidence.push(ev)
  }

  return { ...run, evidence, executed: true }
}
