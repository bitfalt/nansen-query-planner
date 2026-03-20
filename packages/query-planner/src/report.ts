import type { PlannerRun } from './types'

export function buildMarkdownReport(run: PlannerRun) {
  const bull = run.evidence.filter((e) => e.stance === 'bull')
  const bear = run.evidence.filter((e) => e.stance === 'bear')
  const neutral = run.evidence.filter((e) => e.stance === 'neutral')

  return `# Thesis Battlefield Report

## Thesis
${run.input.thesis}

## Token
${run.input.token} on ${run.input.chain}

## Mode
${run.input.mode}

## Planned Queries
${run.steps
  .map(
    (s, i) => `${i + 1}. ${s.label}
   - ${s.command}
   - Why: ${s.rationale}`,
  )
  .join('\n')}

## Evidence Summary
- Bull evidence: ${bull.length}
- Bear evidence: ${bear.length}
- Neutral/contextual evidence: ${neutral.length}

## Evidence Items
${run.evidence.map((e) => `- [${e.stance.toUpperCase()}] ${e.summary}`).join('\n') || '- No evidence collected yet'}

## Query Trace
${run.steps.map((s) => `- ${s.id}: ${s.command}`).join('\n')}
`
}
