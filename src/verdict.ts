import type { Evidence, Verdict } from './types'

export function buildVerdict(evidence: Evidence[], executed: boolean): Verdict {
  const bull = evidence.filter((e) => e.stance === 'bull').length
  const bear = evidence.filter((e) => e.stance === 'bear').length
  const neutral = evidence.filter((e) => e.stance === 'neutral').length

  if (!executed || evidence.length === 0) {
    return {
      decision: 'INCONCLUSIVE',
      confidence: 'low',
      bullEvidenceCount: bull,
      bearEvidenceCount: bear,
      neutralEvidenceCount: neutral,
      explanation: 'The run did not collect enough live evidence yet. The query plan is ready, but the thesis still needs executed evidence to support a stronger verdict.',
    }
  }

  const delta = bull - bear
  const absDelta = Math.abs(delta)
  const confidence: Verdict['confidence'] = absDelta >= 3 ? 'high' : absDelta >= 1 ? 'medium' : 'low'

  if (delta >= 2) {
    return {
      decision: 'BULLISH',
      confidence,
      bullEvidenceCount: bull,
      bearEvidenceCount: bear,
      neutralEvidenceCount: neutral,
      explanation: 'Supportive evidence currently outweighs contradictory evidence across the executed query set.',
    }
  }

  if (delta <= -2) {
    return {
      decision: 'BEARISH',
      confidence,
      bullEvidenceCount: bull,
      bearEvidenceCount: bear,
      neutralEvidenceCount: neutral,
      explanation: 'Contradictory evidence currently outweighs supportive evidence across the executed query set.',
    }
  }

  return {
    decision: 'MIXED',
    confidence,
    bullEvidenceCount: bull,
    bearEvidenceCount: bear,
    neutralEvidenceCount: neutral,
    explanation: 'The evidence currently points in multiple directions. More focused investigation is needed before making a strong directional claim.',
  }
}
