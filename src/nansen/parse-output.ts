import type { CommandResult, Evidence, QueryStep } from '../types'
import { resolveTokenCandidateFromSearch } from './resolve-token'

type SearchToken = {
  name?: string
  symbol?: string
  chain?: string
  address?: string
  price?: number
  volume_24h?: number
  market_cap?: number | null
  rank?: number | null
}

type SearchResponse = {
  success?: boolean
  data?: {
    tokens?: SearchToken[]
    total_results?: number
  }
  error?: string
}

type TokenInfoResponse = {
  success?: boolean
  data?: {
    data?: {
      name?: string
      symbol?: string
      contract_address?: string
      token_details?: {
        market_cap_usd?: number
        fdv_usd?: number
        circulating_supply?: number
        total_supply?: number
      }
      spot_metrics?: {
        volume_total_usd?: number
        buy_volume_usd?: number
        sell_volume_usd?: number
        unique_buyers?: number
        unique_sellers?: number
        total_holders?: number
        liquidity_usd?: number
      }
    }
  }
  error?: string
}

type IndicatorEntry = {
  indicator_type?: string
  score?: string
  signal?: number
  signal_percentile?: number
  last_trigger_on?: string
}

type JsonRecord = Record<string, unknown>

function tryParseJson<T>(text: string): T | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as T
  } catch {
    const firstJsonLine = trimmed.split('\n').find((line) => line.trim().startsWith('{'))
    if (firstJsonLine) {
      try {
        return JSON.parse(firstJsonLine) as T
      } catch {
        // continue
      }
    }

    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T
      } catch {
        return null
      }
    }

    return null
  }
}

function truncate(text: string, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

function formatUsd(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  if (Math.abs(value) < 1 && value !== 0) {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: value < 0.01 ? 4 : 3,
      maximumFractionDigits: value < 0.01 ? 4 : 3,
    })}`
  }
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatSignedUsd(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatUsd(value)}`
}

function formatNumber(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  return Math.round(value).toLocaleString('en-US')
}

function formatCompactNumber(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(value: number | undefined, assumeFraction = false) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  const normalized = assumeFraction ? value * 100 : value
  return `${normalized.toFixed(1)}%`
}

function normalizeMetricKey(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '').toLowerCase()
}

function collectNumbers(value: unknown, out: Record<string, number>, prefix = '') {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectNumbers(item, out, `${prefix}${prefix ? '.' : ''}${idx}`))
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as JsonRecord)) {
      collectNumbers(entry, out, `${prefix}${prefix ? '.' : ''}${key}`)
    }
    return
  }

  if (typeof value === 'number') {
    out[prefix] = value
  }
}

function flattenNumbers(value: unknown) {
  const out: Record<string, number> = {}
  collectNumbers(value, out)
  return out
}

function pickMetricByPatterns(
  numbers: Record<string, number>,
  patterns: RegExp[],
  excludePatterns: RegExp[] = [],
) {
  for (const [key, value] of Object.entries(numbers)) {
    const normalized = normalizeMetricKey(key)
    if (excludePatterns.some((pattern) => pattern.test(normalized))) continue
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return { key, value }
    }
  }

  return null
}

function getArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is JsonRecord => Boolean(entry) && typeof entry === 'object') : []
}

function getObjectStringByKeys(object: JsonRecord, patterns: RegExp[]) {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== 'string') continue
    if (patterns.some((pattern) => pattern.test(normalizeMetricKey(key)))) {
      if (value.trim()) return value.trim()
    }
  }

  return null
}

function getObjectMetricByPatterns(object: JsonRecord, patterns: RegExp[], excludePatterns: RegExp[] = []) {
  return pickMetricByPatterns(flattenNumbers(object), patterns, excludePatterns)
}

function getSignedOutflow(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value > 0 ? -value : value
}

function scoreLabelToWeight(label: string | undefined, kind: 'risk' | 'reward') {
  const normalized = label?.toLowerCase() ?? ''

  if (kind === 'risk') {
    if (normalized === 'high' || normalized === 'bearish') return -1
    if (normalized === 'medium') return -0.5
    if (normalized === 'low') return -0.1
    if (normalized === 'bullish') return 0.2
    return 0
  }

  if (normalized === 'bullish' || normalized === 'high') return 1
  if (normalized === 'medium') return 0.5
  if (normalized === 'neutral') return 0
  if (normalized === 'bearish' || normalized === 'low') return -1
  return 0
}

function normalizeRatio(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value > 1 ? value / 100 : value
}

function parseSearchEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<SearchResponse>(stdout)
  const tokens = parsed?.data?.tokens ?? []
  const selected = resolveTokenCandidateFromSearch(stdout)
  const preview = tokens
    .slice(0, 3)
    .map((token) => `${token.symbol ?? 'unknown'} on ${token.chain ?? 'unknown'}`)
    .join(', ')

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary:
      tokens.length > 0
        ? `${step.label} returned ${tokens.length} candidate token match(es). Top candidates: ${preview}.${selected ? ` Best current match: ${selected.symbol} on ${selected.chain}.` : ''}`
        : `${step.label} returned no token candidates.`,
    stance: 'neutral',
    signalStrength: tokens.length > 0 ? 0.75 : 0,
    metrics: {
      success: tokens.length > 0,
      candidateCount: tokens.length,
      ...(selected
        ? {
            selectedSymbol: selected.symbol,
            selectedName: selected.name,
            selectedChain: selected.chain,
            selectedAddress: selected.address,
            selectedScore: selected.score,
          }
        : {}),
    },
    rawOutputPath,
  }
}

function parseTokenInfoEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<TokenInfoResponse>(stdout)
  const data = parsed?.data?.data
  const spot = data?.spot_metrics
  const details = data?.token_details

  if (!data || !spot) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no usable token info payload.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: false },
      rawOutputPath,
    }
  }

  const buyVolume = spot.buy_volume_usd ?? 0
  const sellVolume = spot.sell_volume_usd ?? 0
  const buyers = spot.unique_buyers ?? 0
  const sellers = spot.unique_sellers ?? 0
  const holderCount = spot.total_holders ?? 0
  const liquidity = spot.liquidity_usd ?? 0
  const volume = spot.volume_total_usd ?? 0
  const buyPressure = buyVolume - sellVolume
  const buyerBalance = buyers - sellers

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75

  if (buyPressure > 0 && buyerBalance >= 0) {
    stance = 'bull'
    signalStrength = buyerBalance > 0 ? 1.75 : 1.25
  } else if (buyPressure < 0 && buyerBalance <= 0) {
    stance = 'bear'
    signalStrength = buyerBalance < 0 ? 1.75 : 1.25
  } else if (buyPressure < 0 && buyerBalance > 0) {
    stance = 'bear'
    signalStrength = 1.0
  } else if (buyPressure > 0 && buyerBalance < 0) {
    stance = 'bull'
    signalStrength = 1.0
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${data.symbol ?? 'Token'} token info resolved on-chain.`,
      `Buy volume ${formatUsd(buyVolume)} vs sell volume ${formatUsd(sellVolume)}.`,
      `Unique buyers ${formatNumber(buyers)} vs sellers ${formatNumber(sellers)}.`,
      `Liquidity ${formatUsd(liquidity)} across ${formatNumber(holderCount)} holders.`,
    ].join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      contractAddress: data.contract_address ?? 'unknown',
      marketCapUsd: details?.market_cap_usd ?? 0,
      fdvUsd: details?.fdv_usd ?? 0,
      circulatingSupply: details?.circulating_supply ?? 0,
      totalSupply: details?.total_supply ?? 0,
      volumeTotalUsd: volume,
      buyVolumeUsd: buyVolume,
      sellVolumeUsd: sellVolume,
      uniqueBuyers: buyers,
      uniqueSellers: sellers,
      totalHolders: holderCount,
      liquidityUsd: liquidity,
      buyPressureUsd: buyPressure,
      buyerBalance,
    },
    rawOutputPath,
  }
}

function parseIndicatorsEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const riskIndicators = getArray(root?.risk_indicators)
  const rewardIndicators = getArray(root?.reward_indicators)

  if (riskIndicators.length === 0 && rewardIndicators.length === 0) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no indicator rows.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: true, extractedMetricCount: 0 },
      rawOutputPath,
    }
  }

  const topRisk = [...riskIndicators].sort((a, b) => {
    return scoreLabelToWeight(String(a.score ?? ''), 'risk') - scoreLabelToWeight(String(b.score ?? ''), 'risk')
  })[0] as IndicatorEntry | undefined
  const topReward = [...rewardIndicators].sort((a, b) => {
    return scoreLabelToWeight(String(b.score ?? ''), 'reward') - scoreLabelToWeight(String(a.score ?? ''), 'reward')
  })[0] as IndicatorEntry | undefined

  const riskSignal = riskIndicators.reduce((sum, indicator) => {
    const entry = indicator as IndicatorEntry
    return sum + scoreLabelToWeight(entry.score, 'risk') - ((entry.signal_percentile ?? 0) >= 80 ? 0.15 : 0)
  }, 0)
  const rewardSignal = rewardIndicators.reduce((sum, indicator) => {
    const entry = indicator as IndicatorEntry
    return sum + scoreLabelToWeight(entry.score, 'reward') + ((entry.signal_percentile ?? 0) >= 80 ? 0.15 : 0)
  }, 0)
  const netIndicatorSignal = rewardSignal + riskSignal

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (netIndicatorSignal >= 0.75) {
    stance = 'bull'
    signalStrength = 1.25
  } else if (netIndicatorSignal <= -0.75) {
    stance = 'bear'
    signalStrength = 1.25
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} extracted ${riskIndicators.length} risk and ${rewardIndicators.length} reward indicators.`,
      topRisk ? `Top risk flag: ${topRisk.indicator_type ?? 'unknown'} (${topRisk.score ?? 'unknown'}).` : null,
      topReward ? `Top reward flag: ${topReward.indicator_type ?? 'unknown'} (${topReward.score ?? 'unknown'}).` : null,
      `Net indicator bias ${netIndicatorSignal.toFixed(2)}.`,
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: riskIndicators.length + rewardIndicators.length,
      riskIndicatorCount: riskIndicators.length,
      rewardIndicatorCount: rewardIndicators.length,
      netIndicatorSignal,
      rewardIndicatorSignal: rewardSignal,
      riskIndicatorSignal: riskSignal,
      ...(topRisk?.indicator_type ? { topRiskIndicator: topRisk.indicator_type } : {}),
      ...(topReward?.indicator_type ? { topRewardIndicator: topReward.indicator_type } : {}),
    },
    rawOutputPath,
  }
}

function parseFlowEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const rows = getArray(root?.data)
  const days = step.command.match(/--days\s+(\d+)/)?.[1] ?? step.label.match(/(\d+)-day/)?.[1] ?? 'unknown'

  if (rows.length === 0) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no ${days}-day flow rows for the selected token.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: {
        success: true,
        extractedMetricCount: 0,
        flowWindowDays: Number(days) || 0,
        rowCount: 0,
      },
      rawOutputPath,
    }
  }

  const latest = rows[0]
  const inflowValues = rows.map((row) => getObjectMetricByPatterns(row, [/totalinflowscount/, /inflowscount/, /inflows/])?.value ?? 0)
  const outflowValues = rows.map((row) => getSignedOutflow(getObjectMetricByPatterns(row, [/totaloutflowscount/, /outflowscount/, /outflows/])?.value))
  const aggregateNetFlow = inflowValues.reduce((sum, value) => sum + value, 0) + outflowValues.reduce((sum, value) => sum + value, 0)
  const latestInflow = inflowValues[0] ?? 0
  const latestOutflow = outflowValues[0] ?? 0
  const latestNetFlow = latestInflow + latestOutflow
  const latestPriceUsd = getObjectMetricByPatterns(latest, [/priceusd/, /price/])?.value ?? 0
  const latestHolderCount = getObjectMetricByPatterns(latest, [/holderscount/, /holdercount/, /holders/])?.value ?? 0

  const directionalFlow = rows.length > 1 ? aggregateNetFlow : latestNetFlow
  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (directionalFlow > 0) {
    stance = 'bull'
    signalStrength = 1.5
  } else if (directionalFlow < 0) {
    stance = 'bear'
    signalStrength = 1.5
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} extracted ${rows.length} row(s) of ${days}-day flow data.`,
      `Latest net flow ${formatSignedUsd(latestNetFlow)}.`,
      rows.length > 1 ? `Aggregate net flow ${formatSignedUsd(aggregateNetFlow)} across the returned window.` : null,
      latestPriceUsd ? `Latest price ${formatUsd(latestPriceUsd)}.` : null,
      latestHolderCount ? `Tracked holders ${formatNumber(latestHolderCount)}.` : null,
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: rows.length * 4,
      latestNetFlow,
      aggregateNetFlow,
      latestInflow,
      latestOutflow,
      latestPriceUsd,
      latestHolderCount,
      flowWindowDays: Number(days) || 0,
      rowCount: rows.length,
    },
    rawOutputPath,
  }
}

function parseFlowIntelligenceEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const row = getArray(root?.data)[0]

  if (!row) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no cohort flow-intelligence rows.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: true, extractedMetricCount: 0 },
      rawOutputPath,
    }
  }

  const netFlowEntries = Object.entries(row)
    .filter(([key, value]) => key.endsWith('_net_flow_usd') && typeof value === 'number')
    .map(([key, value]) => ({
      cohort: key.replace(/_net_flow_usd$/, ''),
      netFlow: value as number,
      walletCount: (row[`${key.replace(/_net_flow_usd$/, '')}_wallet_count`] as number | undefined) ?? 0,
    }))

  const smartCohorts = netFlowEntries.filter((entry) =>
    ['public_figure', 'top_pnl', 'whale', 'smart_trader'].includes(entry.cohort),
  )
  const smartMoneyNetFlow = smartCohorts.reduce((sum, entry) => sum + entry.netFlow, 0)
  const strongestPositive = [...netFlowEntries].sort((a, b) => b.netFlow - a.netFlow)[0]
  const strongestNegative = [...netFlowEntries].sort((a, b) => a.netFlow - b.netFlow)[0]
  const exchangeNetFlow = netFlowEntries.find((entry) => entry.cohort === 'exchange')?.netFlow ?? 0
  const freshWalletNetFlow = netFlowEntries.find((entry) => entry.cohort === 'fresh_wallets')?.netFlow ?? 0

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (smartMoneyNetFlow > 0) {
    stance = 'bull'
    signalStrength = 1.25
  } else if (smartMoneyNetFlow < 0) {
    stance = 'bear'
    signalStrength = 1.25
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} examined ${netFlowEntries.length} participant cohorts.`,
      `Smart-money cohort net flow ${formatSignedUsd(smartMoneyNetFlow)}.`,
      strongestPositive ? `Strongest positive cohort: ${strongestPositive.cohort} ${formatSignedUsd(strongestPositive.netFlow)}.` : null,
      strongestNegative ? `Strongest negative cohort: ${strongestNegative.cohort} ${formatSignedUsd(strongestNegative.netFlow)}.` : null,
      `Exchange net flow ${formatSignedUsd(exchangeNetFlow)}; fresh wallets ${formatSignedUsd(freshWalletNetFlow)}.`,
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: netFlowEntries.length,
      smartMoneyNetFlow,
      exchangeNetFlow,
      freshWalletNetFlow,
      ...(strongestPositive ? { strongestPositiveCohortFlow: strongestPositive.netFlow } : {}),
      ...(strongestNegative ? { strongestNegativeCohortFlow: strongestNegative.netFlow } : {}),
    },
    rawOutputPath,
  }
}

function parseHolderDistributionEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const rows = getArray((root?.data as unknown) ?? root?.holders)

  if (rows.length === 0) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no holder rows or an unsupported holder shape.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: true, extractedMetricCount: 0, holderRows: 0 },
      rawOutputPath,
    }
  }

  const shares = rows
    .map((row) => getObjectMetricByPatterns(row, [/ownershippct/, /holdingpct/, /sharepct/, /percentage/, /percent/, /share/])?.value ?? 0)
    .filter((value) => value > 0)
    .sort((a, b) => b - a)
  const topHolderSharePct = shares[0] ?? 0
  const topFiveHolderSharePct = shares.slice(0, 5).reduce((sum, value) => sum + value, 0)
  const labeledRows = rows.filter((row) =>
    Boolean(getObjectStringByKeys(row, [/addresslabel/, /label/, /entitylabel/]))
  ).length

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (topFiveHolderSharePct >= 50 || topHolderSharePct >= 20) {
    stance = 'bear'
    signalStrength = 1.25
  } else if (topFiveHolderSharePct > 0 && topFiveHolderSharePct <= 25) {
    stance = 'bull'
    signalStrength = 1.0
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} analyzed ${rows.length} holder row(s).`,
      topHolderSharePct ? `Largest holder share ${formatPercent(topHolderSharePct)}.` : null,
      topFiveHolderSharePct ? `Top 5 holder share ${formatPercent(topFiveHolderSharePct)}.` : null,
      `Labeled holders in view ${formatNumber(labeledRows)}.`,
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: rows.length,
      holderRows: rows.length,
      labeledHolderRows: labeledRows,
      topHolderSharePct,
      topFiveHolderSharePct,
    },
    rawOutputPath,
  }
}

function parseWhoBoughtSoldEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const rows = getArray(root?.data)

  if (rows.length === 0) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no participant rows.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: true, extractedMetricCount: 0, participantRows: 0 },
      rawOutputPath,
    }
  }

  const participantFlows = rows.map((row) => {
    const boughtUsd = getObjectMetricByPatterns(row, [/boughtvolumeusd/, /buyvolumeusd/, /tradevolumeusd/])?.value ?? 0
    const soldUsd = getObjectMetricByPatterns(row, [/soldvolumeusd/, /sellvolumeusd/])?.value ?? 0
    const boughtToken = getObjectMetricByPatterns(row, [/boughttokenvolume/, /buytokenvolume/])?.value ?? 0
    const soldToken = getObjectMetricByPatterns(row, [/soldtokenvolume/, /selltokenvolume/])?.value ?? 0
    const useUsd = boughtUsd !== 0 || soldUsd !== 0
    const bought = useUsd ? boughtUsd : boughtToken
    const sold = useUsd ? soldUsd : soldToken
    const net = bought - sold
    const label =
      getObjectStringByKeys(row, [/addresslabel/, /label/, /entitylabel/]) ??
      getObjectStringByKeys(row, [/address/]) ??
      'unlabeled'

    return { net, label, useUsd }
  })

  const participantNetFlow = participantFlows.reduce((sum, entry) => sum + entry.net, 0)
  const netBuyers = participantFlows.filter((entry) => entry.net > 0).length
  const netSellers = participantFlows.filter((entry) => entry.net < 0).length
  const topBuyer = [...participantFlows].sort((a, b) => b.net - a.net)[0]
  const topSeller = [...participantFlows].filter((entry) => entry.net < 0).sort((a, b) => a.net - b.net)[0] ?? null
  const useUsd = participantFlows.some((entry) => entry.useUsd)

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (participantNetFlow > 0 && netBuyers >= netSellers) {
    stance = 'bull'
    signalStrength = 1.25
  } else if (participantNetFlow < 0 && netSellers >= netBuyers) {
    stance = 'bear'
    signalStrength = 1.25
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} analyzed ${rows.length} directional participant row(s).`,
      useUsd
        ? `Net participant flow ${formatSignedUsd(participantNetFlow)}.`
        : `Net participant token flow ${participantNetFlow > 0 ? '+' : ''}${formatCompactNumber(participantNetFlow)}.`,
      `Net buyers ${formatNumber(netBuyers)} vs net sellers ${formatNumber(netSellers)}.`,
      topBuyer ? `Top buyer: ${topBuyer.label}.` : null,
      topSeller ? `Top seller: ${topSeller.label}.` : 'No net sellers appeared in the sampled participant rows.',
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: rows.length,
      participantRows: rows.length,
      participantNetFlow,
      netBuyers,
      netSellers,
    },
    rawOutputPath,
  }
}

function parsePnlEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const rows = getArray(root?.data)

  if (rows.length === 0) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no PnL rows or an unsupported payload shape.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: true, extractedMetricCount: 0, pnlRows: 0 },
      rawOutputPath,
    }
  }

  const pnlValues = rows.map((row) => getObjectMetricByPatterns(row, [/totalpnl/, /pnlusd/, /profitusd/, /realizedpnlusd/, /unrealizedpnlusd/])?.value ?? 0)
  const winRates = rows
    .map((row) => normalizeRatio(getObjectMetricByPatterns(row, [/winrate/, /winningrate/, /successrate/])?.value))
    .filter((value) => value > 0)
  const positiveRows = pnlValues.filter((value) => value > 0).length
  const negativeRows = pnlValues.filter((value) => value < 0).length
  const avgPnlUsd = pnlValues.length ? pnlValues.reduce((sum, value) => sum + value, 0) / pnlValues.length : 0
  const avgWinRate = winRates.length ? winRates.reduce((sum, value) => sum + value, 0) / winRates.length : 0
  const profitableRatio = pnlValues.length ? positiveRows / pnlValues.length : 0

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (profitableRatio >= 0.7 && avgWinRate >= 0.55) {
    stance = 'bear'
    signalStrength = 1.0
  } else if (profitableRatio <= 0.3 && avgWinRate > 0 && avgWinRate <= 0.45) {
    stance = 'bull'
    signalStrength = 1.0
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} analyzed ${rows.length} PnL row(s).`,
      `Average PnL ${formatSignedUsd(avgPnlUsd)}.`,
      `Profitable rows ${formatNumber(positiveRows)} vs losing rows ${formatNumber(negativeRows)}.`,
      avgWinRate > 0 ? `Average win rate ${formatPercent(avgWinRate, true)}.` : null,
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: rows.length,
      pnlRows: rows.length,
      avgPnlUsd,
      avgWinRate,
      profitableRatio,
    },
    rawOutputPath,
  }
}

function parseOhlcvEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const root = parsed?.data as JsonRecord | undefined
  const rows = getArray(root?.data)

  if (rows.length === 0) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned no OHLCV candles for the selected token and timeframe.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { success: true, extractedMetricCount: 0, candleCount: 0 },
      rawOutputPath,
    }
  }

  const candles = rows.map((row) => {
    const open = getObjectMetricByPatterns(row, [/^open$/, /openprice/])?.value ?? 0
    const high = getObjectMetricByPatterns(row, [/^high$/, /highprice/])?.value ?? 0
    const low = getObjectMetricByPatterns(row, [/^low$/, /lowprice/])?.value ?? 0
    const close = getObjectMetricByPatterns(row, [/^close$/, /closeprice/])?.value ?? 0
    const volume = getObjectMetricByPatterns(row, [/volume/, /volumeusd/])?.value ?? 0
    const timestamp = getObjectMetricByPatterns(row, [/timestamp/, /time/, /openat/])?.value ?? 0
    return { open, high, low, close, volume, timestamp }
  })

  const orderedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp)
  const first = orderedCandles[0]
  const last = orderedCandles[orderedCandles.length - 1]
  const startPrice = first.close || first.open
  const endPrice = last.close || last.open
  const priceChangePct = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0
  const totalVolume = orderedCandles.reduce((sum, candle) => sum + candle.volume, 0)
  const highPrice = Math.max(...orderedCandles.map((candle) => candle.high || candle.close || candle.open || 0))
  const lowPrice = Math.min(...orderedCandles.map((candle) => candle.low || candle.close || candle.open || Number.POSITIVE_INFINITY))

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75
  if (priceChangePct >= 3) {
    stance = 'bull'
    signalStrength = 1.0
  } else if (priceChangePct <= -3) {
    stance = 'bear'
    signalStrength = 1.0
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: [
      `${step.label} analyzed ${orderedCandles.length} candle(s).`,
      `Price change ${formatPercent(priceChangePct)} across the returned window.`,
      `Range ${formatUsd(lowPrice)} to ${formatUsd(highPrice)}.`,
      totalVolume > 0 ? `Total volume ${formatCompactNumber(totalVolume)}.` : null,
    ].filter(Boolean).join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: orderedCandles.length,
      candleCount: orderedCandles.length,
      priceChangePct,
      totalVolume,
      highPrice,
      lowPrice,
    },
    rawOutputPath,
  }
}

function parseGenericMetricEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<JsonRecord>(stdout)
  const data = parsed && typeof parsed === 'object' ? (parsed as JsonRecord).data : null
  const numbers = flattenNumbers(data)
  const entries = Object.entries(numbers)
  const lowerKeys = entries.map(([key]) => key.toLowerCase())
  const netflowEntry = entries.find(([key]) => key.toLowerCase().includes('net_flow'))
  const inflowEntry = entries.find(([key]) => key.toLowerCase().includes('inflow'))
  const outflowEntry = entries.find(([key]) => key.toLowerCase().includes('outflow'))
  const scoreEntry = entries.find(([key]) => key.toLowerCase().includes('score'))

  let stance: Evidence['stance'] =
    step.expectedSignal === 'supportive'
      ? 'bull'
      : step.expectedSignal === 'contradictory'
        ? 'bear'
        : 'neutral'
  let signalStrength = step.expectedSignal === 'contextual' ? 0.75 : 1

  if (netflowEntry) {
    if (netflowEntry[1] > 0) {
      stance = 'bull'
      signalStrength = 1.25
    } else if (netflowEntry[1] < 0) {
      stance = 'bear'
      signalStrength = 1.25
    }
  } else if (inflowEntry && outflowEntry) {
    if (inflowEntry[1] > outflowEntry[1]) {
      stance = 'bull'
      signalStrength = 1.25
    } else if (inflowEntry[1] < outflowEntry[1]) {
      stance = 'bear'
      signalStrength = 1.25
    }
  } else if (scoreEntry) {
    if (scoreEntry[1] >= 60) {
      stance = 'bull'
      signalStrength = 1.0
    } else if (scoreEntry[1] <= 40) {
      stance = 'bear'
      signalStrength = 1.0
    }
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: entries.length
      ? `${step.label} returned structured metrics. Key metric hints: ${lowerKeys.slice(0, 5).join(', ')}.`
      : `${step.label} returned structured data but no obvious numeric metrics were extracted.`,
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: entries.length,
      ...(netflowEntry ? { netFlow: netflowEntry[1] } : {}),
      ...(inflowEntry ? { inflow: inflowEntry[1] } : {}),
      ...(outflowEntry ? { outflow: outflowEntry[1] } : {}),
      ...(scoreEntry ? { score: scoreEntry[1] } : {}),
    },
    rawOutputPath,
  }
}

export function buildEvidenceFromCommand(
  step: QueryStep,
  result: CommandResult,
  rawOutputPath: string,
): Evidence {
  const defaultStance =
    step.expectedSignal === 'supportive'
      ? 'bull'
      : step.expectedSignal === 'contradictory'
        ? 'bear'
        : 'neutral'

  if (!result.success) {
    const parsedError = tryParseJson<{ error?: string }>(result.stdout)
    const errorMessage =
      parsedError?.error ??
      truncate(result.stderr.trim() || result.stdout.trim() || 'unknown error')

    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} failed: ${errorMessage}`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: {
        exitCode: result.exitCode ?? -1,
        success: false,
      },
      rawOutputPath,
    }
  }

  if (step.id === 'q1') return parseSearchEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q2') return parseTokenInfoEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q3') return parseIndicatorsEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q4' || step.id === 'q5') return parseFlowEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q6') return parseFlowIntelligenceEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q7') return parseHolderDistributionEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q8') return parseWhoBoughtSoldEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q9') return parsePnlEvidence(step, result.stdout, rawOutputPath)
  if (step.id === 'q10') return parseOhlcvEvidence(step, result.stdout, rawOutputPath)

  const parsed = tryParseJson<JsonRecord>(result.stdout)
  if (parsed && typeof parsed === 'object') {
    const data = parsed.data
    const size = Array.isArray(data)
      ? data.length
      : data && typeof data === 'object'
        ? Object.keys(data as JsonRecord).length
        : 0

    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned live structured data${size ? ` with ${size} top-level item(s)` : ''}.`,
      stance: defaultStance,
      signalStrength: defaultStance === 'neutral' ? 0.5 : 1,
      metrics: {
        success: true,
        hasData: Boolean(data),
        topLevelSize: size,
      },
      rawOutputPath,
    }
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: `${step.label} returned non-JSON output: ${truncate(result.stdout.trim() || result.stderr.trim() || 'no output')}`,
    stance: defaultStance,
    signalStrength: defaultStance === 'neutral' ? 0.5 : 1,
    metrics: {
      success: true,
      outputKind: 'text',
    },
    rawOutputPath,
  }
}
