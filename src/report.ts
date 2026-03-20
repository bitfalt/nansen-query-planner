import type { PlannerRun, StructuredReport } from './types'
import { buildVerdict } from './verdict'

export function buildStructuredReport(run: PlannerRun): StructuredReport {
  return {
    reportType: 'thesis-battlefield.v1',
    runId: run.runId,
    generatedAt: new Date().toISOString(),
    thesis: run.input.thesis,
    token: run.input.token,
    chain: run.input.chain,
    mode: run.input.mode,
    executed: run.executed,
    verdict: buildVerdict(run.evidence, run.executed),
    plannedQueries: run.steps,
    evidence: run.evidence,
    queryTrace: run.steps.map((s) => s.command),
    nextQuestions: [
      'Which executed query produced the strongest contradictory signal?',
      'Should we spend more credits on profiler follow-ups or stop here?',
      'What additional evidence would change the verdict materially?'
    ]
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

## Evidence Summary
- Bull evidence: ${report.verdict.bullEvidenceCount}
- Bear evidence: ${report.verdict.bearEvidenceCount}
- Neutral/contextual evidence: ${report.verdict.neutralEvidenceCount}

## Planned Queries
${report.plannedQueries
  .map(
    (s, i) => `${i + 1}. ${s.label}
   - ${s.command}
   - Why: ${s.rationale}`,
  )
  .join('\n')}

## Evidence Items
${report.evidence.map((e) => `- [${e.stance.toUpperCase()}] ${e.summary}`).join('\n') || '- No evidence collected yet'}

## Query Trace
${report.queryTrace.map((q) => `- ${q}`).join('\n')}

## Next Questions
${report.nextQuestions.map((q) => `- ${q}`).join('\n')}
`
}
