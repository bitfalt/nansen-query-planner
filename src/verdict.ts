import type { Evidence, Verdict } from './types'
import type { ThesisProfile } from './thesis/profile'

function getMetricNumber(evidence: Evidence, key: string) {
  const value = evidence.metrics?.[key]
  return typeof value === 'number' ? value : 0
}

function getStepWeight(stepId: string, profile: ThesisProfile) {
  let weight = 1

  if (profile.claimFocus === 'concentration-risk') {
    if (stepId === 'q7') weight *= 4
    if (stepId === 'q9') weight *= 2
    if (stepId === 'q4' || stepId === 'q5' || stepId === 'q6' || stepId === 'q8' || stepId === 'q10') {
      weight *= 0.35
    }
  }

  if (profile.claimFocus === 'crowding-risk') {
    if (stepId === 'q9') weight *= 3
    if (stepId === 'q10' || stepId === 'q4' || stepId === 'q5' || stepId === 'q6' || stepId === 'q8') {
      weight *= 1.5
    }
    if (stepId === 'q7') weight *= 0.5
  }

  if (profile.claimFocus === 'momentum-confirmation') {
    if (stepId === 'q10') weight *= 2.5
    if (stepId === 'q3' || stepId === 'q4' || stepId === 'q5') weight *= 1.5
    if (stepId === 'q7') weight *= 0.5
  }

  if (profile.claimFocus === 'accumulation') {
    if (stepId === 'q4' || stepId === 'q5' || stepId === 'q6' || stepId === 'q8') weight *= 1.5
    if (stepId === 'q7' || stepId === 'q9') weight *= 0.75
  }

  if (profile.lenses.includes('holders')) {
    if (stepId === 'q7') weight *= 2.5
    if (stepId === 'q8' || stepId === 'q9') weight *= 1.5
    if (stepId === 'q4' || stepId === 'q5' || stepId === 'q10') weight *= 0.6
  }

  if (profile.lenses.includes('momentum')) {
    if (stepId === 'q10') weight *= 2
    if (stepId === 'q3') weight *= 1.5
    if (stepId === 'q4' || stepId === 'q5') weight *= 1.25
  }

  if (profile.lenses.includes('smart-money') || profile.lenses.includes('flows')) {
    if (stepId === 'q4' || stepId === 'q5' || stepId === 'q6' || stepId === 'q8') weight *= 1.35
    if (stepId === 'q7') weight *= 0.75
  }

  if (profile.lenses.includes('catalyst')) {
    if (stepId === 'q3' || stepId === 'q10') weight *= 1.2
  }

  return weight
}

export function buildVerdict(evidence: Evidence[], executed: boolean, profile?: ThesisProfile): Verdict {
  const bull = evidence.filter((e) => e.stance === 'bull')
  const bear = evidence.filter((e) => e.stance === 'bear')
  const neutral = evidence.filter((e) => e.stance === 'neutral')

  let bullSignal = bull.reduce(
    (sum, e) => sum + e.signalStrength * (profile ? getStepWeight(e.stepId, profile) : 1),
    0,
  )
  let bearSignal = bear.reduce(
    (sum, e) => sum + e.signalStrength * (profile ? getStepWeight(e.stepId, profile) : 1),
    0,
  )

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
    const weight = profile ? getStepWeight(entry.stepId, profile) : 1
    const netFlow = getMetricNumber(entry, 'netFlow')
    const score = getMetricNumber(entry, 'score')
    const inflow = getMetricNumber(entry, 'inflow')
    const outflow = getMetricNumber(entry, 'outflow')
    const aggregateNetFlow = getMetricNumber(entry, 'aggregateNetFlow')
    const latestNetFlow = getMetricNumber(entry, 'latestNetFlow')
    const smartMoneyNetFlow = getMetricNumber(entry, 'smartMoneyNetFlow')
    const participantNetFlow = getMetricNumber(entry, 'participantNetFlow')
    const indicatorNetSignal = getMetricNumber(entry, 'netIndicatorSignal')
    const topHolderSharePct = getMetricNumber(entry, 'topHolderSharePct')
    const topFiveHolderSharePct = getMetricNumber(entry, 'topFiveHolderSharePct')
    const profitableRatio = getMetricNumber(entry, 'profitableRatio')
    const avgWinRate = getMetricNumber(entry, 'avgWinRate')
    const avgRoiPct = getMetricNumber(entry, 'avgRoiPct')
    const avgStillHoldingRatio = getMetricNumber(entry, 'avgStillHoldingRatio')
    const priceChangePct = getMetricNumber(entry, 'priceChangePct')

    if (entry.stance === 'neutral') {
      continue
    }

    const addDirectionalSignal = (amount: number) => {
      if (entry.stance === 'bull') bullSignal += amount * weight
      if (entry.stance === 'bear') bearSignal += amount * weight
    }

    if (netFlow !== 0) addDirectionalSignal(1)
    if (latestNetFlow !== 0) addDirectionalSignal(0.75)
    if (aggregateNetFlow !== 0) addDirectionalSignal(1)
    if ((inflow > outflow && inflow > 0) || (outflow > inflow && outflow > 0)) addDirectionalSignal(0.75)
    if (score >= 60 || (score > 0 && score <= 40)) addDirectionalSignal(0.75)
    if (smartMoneyNetFlow !== 0) addDirectionalSignal(1)
    if (participantNetFlow !== 0) addDirectionalSignal(0.75)
    if (Math.abs(indicatorNetSignal) > 0.75) addDirectionalSignal(0.75)
    if (topHolderSharePct >= 20) addDirectionalSignal(0.5)
    if (topFiveHolderSharePct >= 50) addDirectionalSignal(1)
    if (profitableRatio >= 0.7 && avgWinRate >= 0.55) addDirectionalSignal(0.5)
    if (profitableRatio >= 0.7 && avgRoiPct >= 5) addDirectionalSignal(0.5)
    if (profitableRatio >= 0.7 && avgStillHoldingRatio >= 0.25) addDirectionalSignal(0.5)
    if (profitableRatio > 0 && profitableRatio <= 0.3 && avgWinRate > 0 && avgWinRate <= 0.45) {
      addDirectionalSignal(0.5)
    }
    if (Math.abs(priceChangePct) >= 3) addDirectionalSignal(0.5)
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
      decision: 'SUPPORTED',
      confidence,
      bullEvidenceCount: bull.length,
      bearEvidenceCount: bear.length,
      neutralEvidenceCount: neutral.length,
      bullSignal,
      bearSignal,
      explanation:
        'Supporting evidence currently outweighs contradictory evidence across the executed investigation set, suggesting the thesis is gaining confirmation.',
    }
  }

  if (delta <= -2) {
    return {
      decision: 'CONTRADICTED',
      confidence,
      bullEvidenceCount: bull.length,
      bearEvidenceCount: bear.length,
      neutralEvidenceCount: neutral.length,
      bullSignal,
      bearSignal,
      explanation:
        'Contradictory evidence currently outweighs supporting evidence across the executed investigation set, suggesting the thesis is weakening rather than strengthening.',
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
