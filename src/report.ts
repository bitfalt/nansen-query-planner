import type { PlannerRun, StructuredReport, Evidence } from './types'
import { buildVerdict } from './verdict'

function pickStrongest(evidence: Evidence[], stance: 'bull' | 'bear') {
  return (
    evidence
      .filter((e) => e.stance === stance)
      .sort((a, b) => b.signalStrength - a.signalStrength)[0] ?? null
  )
}

function buildCaveats(run: PlannerRun) {
  const caveats: string[] = []
  if (!run.executed) {
    caveats.push('The report is based on planning mode only; live evidence has not been collected yet.')
  }
  if (run.evidence.some((e) => e.metrics?.success === false)) {
    caveats.push('At least one query failed or returned an unusable response during execution.')
  }
  if (run.evidence.length < 3) {
    caveats.push('Only a small subset of the planned investigation has been executed so far.')
  }
  return caveats
}

function buildAgentSummary(strongestBullEvidence: Evidence | null, strongestBearEvidence: Evidence | null) {
  return {
    strongestBullCase: strongestBullEvidence?.summary ?? 'No strong bull-side evidence yet.',
    strongestBearCase: strongestBearEvidence?.summary ?? 'No strong bear-side evidence yet.',
  }
}

export function buildStructuredReport(
  run: PlannerRun,
): StructuredReport & {
  strongestBullEvidence: Evidence | null
  strongestBearEvidence: Evidence | null
  caveats: string[]
  agentSummary: {
    strongestBullCase: string
    strongestBearCase: string
  }
} {
  const verdict = buildVerdict(run.evidence, run.executed)
  const executedQueries = run.evidence.length
  const categories = [...new Set(run.steps.map((s) => s.category))] as string[]
  const strongestBullEvidence = pickStrongest(run.evidence, 'bull')
  const strongestBearEvidence = pickStrongest(run.evidence, 'bear')
  const caveats = buildCaveats(run)

  return {
    reportType: 'thesis-battlefield.v1',
    runId: run.runId,
    generatedAt: new Date().toISOString(),
    thesis: run.input.thesis,
    token: run.input.token,
    chain: run.input.chain,
    mode: run.input.mode,
    executed: run.executed,
    verdict,
    plannerSummary: {
      totalQueries: run.steps.length,
      executedQueries,
      categories,
    },
    llmSummary: {
      oneSentence: `${verdict.decision} (${verdict.confidence}) on thesis: ${run.input.thesis}`,
      analystTake: verdict.explanation,
      nextAction:
        executedQueries === 0
          ? 'Run a bounded execute-mode validation.'
          : 'Inspect the strongest contradictory and supportive signals before spending more credits.',
    },
    plannedQueries: run.steps,
    evidence: run.evidence,
    queryTrace: run.steps.map((s) => s.command),
    nextQuestions: [
      'Which executed query produced the strongest contradictory signal?',
      'Should we spend more credits on profiler follow-ups or stop here?',
      'What additional evidence would change the verdict materially?',
    ],
    strongestBullEvidence,
    strongestBearEvidence,
    caveats,
    agentSummary: buildAgentSummary(strongestBullEvidence, strongestBearEvidence),
  }
}

export function buildMarkdownReport(run: PlannerRun) {
  const report = buildStructuredReport(run)

  return `# Thesis Battlefield Report

## Thesis
${report.thesis}

## Token
${report.token} on ${report.chain}

## Mode
${report.mode}

## Executed
${report.executed ? 'yes' : 'no'}

## Verdict
- Decision: ${report.verdict.decision}
- Confidence: ${report.verdict.confidence}
- Explanation: ${report.verdict.explanation}
- Bull signal: ${report.verdict.bullSignal}
- Bear signal: ${report.verdict.bearSignal}

## Planner Summary
- Total queries: ${report.plannerSummary.totalQueries}
- Executed queries: ${report.plannerSummary.executedQueries}
- Categories: ${report.plannerSummary.categories.join(', ')}

## LLM/Agent Summary
- One sentence: ${report.llmSummary.oneSentence}
- Analyst take: ${report.llmSummary.analystTake}
- Next action: ${report.llmSummary.nextAction}

## Strongest Bull Evidence
${report.strongestBullEvidence ? `- ${report.strongestBullEvidence.summary}` : '- None yet'}

## Strongest Bear Evidence
${report.strongestBearEvidence ? `- ${report.strongestBearEvidence.summary}` : '- None yet'}

## Agent Summary
- Strongest bull case: ${report.agentSummary.strongestBullCase}
- Strongest bear case: ${report.agentSummary.strongestBearCase}

## Caveats
${report.caveats.map((c) => `- ${c}`).join('\n') || '- None'}

## Planned Queries
${report.plannedQueries
  .map(
    (s, i) => `${i + 1}. ${s.label}
   - ${s.command}
   - Why: ${s.rationale}`,
  )
  .join('\n')}

## Evidence Items
${report.evidence.map((e) => `- [${e.stance.toUpperCase()}|${e.signalStrength}] ${e.summary}`).join('\n') || '- No evidence collected yet'}

## Query Trace
${report.queryTrace.map((q) => `- ${q}`).join('\n')}

## Next Questions
${report.nextQuestions.map((q) => `- ${q}`).join('\n')}
`
}
