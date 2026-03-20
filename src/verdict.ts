import type { Evidence, Verdict } from './types'

export function buildVerdict(evidence: Evidence[], executed: boolean): Verdict {
  const bull = evidence.filter((e) => e.stance === 'bull')
  const bear = evidence.filter((e) => e.stance === 'bear')
  const neutral = evidence.filter((e) => e.stance === 'neutral')

  const bullSignal = bull.reduce((sum, e) => sum + e.signalStrength, 0)
  const bearSignal = bear.reduce((sum, e) => sum + e.signalStrength, 0)
  const delta = bullSignal - bearSignal
  const absDelta = Math.abs(delta)
  const confidence: Verdict['confidence'] = absDelta >= 3 ? 'high' : absDelta >= 1 ? 'medium' : 'low'

  if (!executed || evidence.length === 0) {
    return {
      decision: 'INCONCLUSIVE',
      confidence: 'low',
      bullEvidenceCount: bull.length,
      bearEvidenceCount: bear.length,
      neutralEvidenceCount: neutral.length,
      bullSignal,
      bearSignal,
      explanation: 'The query plan exists, but there is not enough executed evidence yet to support a real directional verdict.',
    }
  }

  if (delta >= 2) {
    return {
      decision: 'BULLISH',
      confidence,
      bullEvidenceCount: bull.length,
      bearEvidenceCount: bear.length,
      neutralEvidenceCount: neutral.length,
      bullSignal,
      bearSignal,
      explanation: 'Supportive evidence currently outweighs contradictory evidence across the executed investigation set.',
    }
  }

  if (delta <= -2) {
    return {
      decision: 'BEARISH',
      confidence,
      bullEvidenceCount: bull.length,
      bearEvidenceCount: bear.length,
      neutralEvidenceCount: neutral.length,
      bullSignal,
      bearSignal,
      explanation: 'Contradictory evidence currently outweighs supportive evidence across the executed investigation set.',
    }
  }

  return {
    decision: 'MIXED',
    confidence,
    bullEvidenceCount: bull.length,
    bearEvidenceCount: bear.length,
    neutralEvidenceCount: neutral.length,
    bullSignal,
    bearSignal,
    explanation: 'The evidence currently points in multiple directions. The thesis needs more focused follow-up before a strong directional claim can be made.',
  }
}
