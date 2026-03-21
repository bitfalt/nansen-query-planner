import type { Evidence, QueryStep, CommandResult } from '../types'
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

function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function truncate(text: string, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

function formatUsd(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatSignedUsd(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatUsd(value)}`
}

function formatNumber(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown'
  return value.toLocaleString('en-US')
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
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      collectNumbers(v, out, `${prefix}${prefix ? '.' : ''}${key}`)
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

function parseSearchEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<SearchResponse>(stdout.trim())
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
  const parsed = tryParseJson<TokenInfoResponse>(stdout.trim())
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

  const summary = [
    `${data.symbol ?? 'Token'} token info resolved on-chain.`,
    `Buy volume ${formatUsd(buyVolume)} vs sell volume ${formatUsd(sellVolume)}.`,
    `Unique buyers ${buyers} vs sellers ${sellers}.`,
    `Liquidity ${formatUsd(liquidity)} across ${holderCount.toLocaleString('en-US')} holders.`,
  ].join(' ')

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary,
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
  const parsed = tryParseJson<Record<string, unknown>>(stdout.trim())
  const data = parsed && typeof parsed === 'object' ? (parsed as { data?: unknown }).data : null
  const numbers = flattenNumbers(data)
  const score = pickMetricByPatterns(numbers, [/score/, /strength/, /rating/])
  const priceChange = pickMetricByPatterns(numbers, [/pricechange/, /return/, /performance/, /change/, /pct/])
  const volume = pickMetricByPatterns(numbers, [/volume/, /turnover/])
  const liquidity = pickMetricByPatterns(numbers, [/liquidity/])
  const holders = pickMetricByPatterns(numbers, [/holders?/, /holdercount/])

  let stance: Evidence['stance'] = 'neutral'
  let signalStrength = 0.75

  if (score) {
    if (score.value >= 60) {
      stance = 'bull'
      signalStrength = 1.25
    } else if (score.value > 0 && score.value <= 40) {
      stance = 'bear'
      signalStrength = 1.25
    }
  }

  if (priceChange && stance === 'neutral') {
    if (priceChange.value > 0) {
      stance = 'bull'
      signalStrength = 1.0
    } else if (priceChange.value < 0) {
      stance = 'bear'
      signalStrength = 1.0
    }
  }

  const summaryParts = [
    `${step.label} extracted indicator-level metrics.`,
    score ? `Score signal ${formatNumber(score.value)}.` : null,
    priceChange ? `Price/performance metric ${formatNumber(priceChange.value)}.` : null,
    volume ? `Volume metric ${formatUsd(volume.value)}.` : null,
    liquidity ? `Liquidity metric ${formatUsd(liquidity.value)}.` : null,
    holders ? `Holder metric ${formatNumber(holders.value)}.` : null,
  ].filter(Boolean)

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: summaryParts.join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: Object.keys(numbers).length,
      ...(score ? { score: score.value } : {}),
      ...(priceChange ? { priceChange: priceChange.value } : {}),
      ...(volume ? { volume: volume.value } : {}),
      ...(liquidity ? { liquidityUsd: liquidity.value } : {}),
      ...(holders ? { holders: holders.value } : {}),
    },
    rawOutputPath,
  }
}

function parseFlowEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<Record<string, unknown>>(stdout.trim())
  const data = parsed && typeof parsed === 'object' ? (parsed as { data?: unknown }).data : null
  const numbers = flattenNumbers(data)
  const netFlow = pickMetricByPatterns(numbers, [/netflow/, /netinflow/, /net$/, /flowbalance/])
  const inflow = pickMetricByPatterns(numbers, [/inflow/, /flowin/], [/net/])
  const outflow = pickMetricByPatterns(numbers, [/outflow/, /flowout/], [/net/])
  const buyers = pickMetricByPatterns(numbers, [/buyers?/, /walletsbuying/, /uniquebuyers/])
  const sellers = pickMetricByPatterns(numbers, [/sellers?/, /walletsselling/, /uniquesellers/])
  const days = step.command.match(/--days\s+(\d+)/)?.[1] ?? step.label.match(/(\d+)-day/)?.[1] ?? 'unknown'

  const derivedNetFlow =
    netFlow?.value ??
    (inflow && outflow ? inflow.value - outflow.value : null)

  let stance: Evidence['stance'] = step.expectedSignal === 'supportive' ? 'bull' : 'neutral'
  let signalStrength = step.expectedSignal === 'supportive' ? 1.0 : 0.75

  if (typeof derivedNetFlow === 'number') {
    if (derivedNetFlow > 0) {
      stance = 'bull'
      signalStrength = 1.5
    } else if (derivedNetFlow < 0) {
      stance = 'bear'
      signalStrength = 1.5
    }
  }

  if (buyers && sellers && buyers.value !== sellers.value) {
    signalStrength += 0.25
  }

  const summaryParts = [
    `${step.label} extracted ${days}-day flow metrics.`,
    typeof derivedNetFlow === 'number' ? `Net flow ${formatSignedUsd(derivedNetFlow)}.` : null,
    inflow ? `Inflow ${formatUsd(inflow.value)}.` : null,
    outflow ? `Outflow ${formatUsd(outflow.value)}.` : null,
    buyers ? `Buy-side wallets ${formatNumber(buyers.value)}.` : null,
    sellers ? `Sell-side wallets ${formatNumber(sellers.value)}.` : null,
  ].filter(Boolean)

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: summaryParts.join(' '),
    stance,
    signalStrength,
    metrics: {
      success: true,
      extractedMetricCount: Object.keys(numbers).length,
      ...(typeof derivedNetFlow === 'number' ? { netFlow: derivedNetFlow } : {}),
      ...(inflow ? { inflow: inflow.value } : {}),
      ...(outflow ? { outflow: outflow.value } : {}),
      ...(buyers ? { uniqueBuyers: buyers.value } : {}),
      ...(sellers ? { uniqueSellers: sellers.value } : {}),
      flowWindowDays: Number(days) || 0,
    },
    rawOutputPath,
  }
}

function parseGenericMetricEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<Record<string, unknown>>(stdout.trim())
  const data = parsed && typeof parsed === 'object' ? (parsed as any).data : null
  const numbers = flattenNumbers(data)

  const entries = Object.entries(numbers)
  const lowerKeys = entries.map(([k]) => k.toLowerCase())
  const netflowEntry = entries.find(([k]) => k.toLowerCase().includes('net_flow'))
  const inflowEntry = entries.find(([k]) => k.toLowerCase().includes('inflow'))
  const outflowEntry = entries.find(([k]) => k.toLowerCase().includes('outflow'))
  const scoreEntry = entries.find(([k]) => k.toLowerCase().includes('score'))

  let stance: Evidence['stance'] = step.expectedSignal === 'supportive' ? 'bull' : step.expectedSignal === 'contradictory' ? 'bear' : 'neutral'
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

  const topKeys = lowerKeys.slice(0, 5).join(', ')
  const summary = entries.length
    ? `${step.label} returned structured metrics. Key metric hints: ${topKeys || 'available metrics detected'}.`
    : `${step.label} returned structured data but no obvious numeric metrics were extracted.`

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary,
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
    const parsedError = tryParseJson<{ error?: string }>(result.stdout.trim())
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

  if (step.id === 'q1') {
    return parseSearchEvidence(step, result.stdout, rawOutputPath)
  }

  if (step.id === 'q2') {
    return parseTokenInfoEvidence(step, result.stdout, rawOutputPath)
  }

  if (step.id === 'q3') {
    return parseIndicatorsEvidence(step, result.stdout, rawOutputPath)
  }

  if (step.id === 'q4' || step.id === 'q5') {
    return parseFlowEvidence(step, result.stdout, rawOutputPath)
  }

  if (['q6', 'q7', 'q8', 'q9', 'q10'].includes(step.id)) {
    return parseGenericMetricEvidence(step, result.stdout, rawOutputPath)
  }

  const parsed = tryParseJson<Record<string, unknown>>(result.stdout.trim())
  if (parsed && typeof parsed === 'object') {
    const data = (parsed as any).data
    const size = Array.isArray(data)
      ? data.length
      : data && typeof data === 'object'
        ? Object.keys(data).length
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
