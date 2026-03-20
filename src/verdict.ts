import type { Evidence, Verdict } from './types'

function getMetricNumber(evidence: Evidence, key: string) {
  const value = evidence.metrics?.[key]
  return typeof value === 'number' ? value : 0
}

export function buildVerdict(evidence: Evidence[], executed: boolean): Verdict {
  const bull = evidence.filter((e) => e.stance === 'bull')
  const bear = evidence.filter((e) => e.stance === 'bear')
  const neutral = evidence.filter((e) => e.stance === 'neutral')

  let bullSignal = bull.reduce((sum, e) => sum + e.signalStrength, 0)
  let bearSignal = bear.reduce((sum, e) => sum + e.signalStrength, 0)

  const tokenInfo = evidence.find((e) => e.stepId === 'q2')
  if (tokenInfo) {
    const buyPressure = getMetricNumber(tokenInfo, 'buyPressureUsd')
    const buyerBalance = getMetricNumber(tokenInfo, 'buyerBalance')
    const liquidity = getMetricNumber(tokenInfo, 'liquidityUsd')

    if (buyPressure > 0) bullSignal += 1
    if (buyPressure < 0) bearSignal += 1
    if (buyerBalance > 0) bullSignal += 0.5
    if (buyerBalance < 0) bearSignal += 0.5
    if (liquidity > 1_000_000) bullSignal += 0.5
  }

  for (const entry of evidence) {
    const netFlow = getMetricNumber(entry, 'netFlow')
    const score = getMetricNumber(entry, 'score')
    const inflow = getMetricNumber(entry, 'inflow')
    const outflow = getMetricNumber(entry, 'outflow')

    if (netFlow > 0) bullSignal += 1
    if (netFlow < 0) bearSignal += 1
    if (inflow > outflow && inflow > 0) bullSignal += 0.75
    if (outflow > inflow && outflow > 0) bearSignal += 0.75
    if (score >= 60) bullSignal += 0.75
    if (score > 0 && score <= 40) bearSignal += 0.75
  }

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
      explanation:
        'The query plan exists, but there is not enough executed evidence yet to support a real directional verdict.',
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
      explanation:
        'Supportive evidence currently outweighs contradictory evidence across the executed investigation set, suggesting the thesis is gaining confirmation.',
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
      explanation:
        'Contradictory evidence currently outweighs supportive evidence across the executed investigation set, suggesting the thesis is weakening rather than strengthening.',
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
    explanation:
      'The evidence currently points in multiple directions. The thesis needs more focused follow-up before a strong directional claim can be made.',
  }
}
