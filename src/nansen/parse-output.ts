import type { Evidence, QueryStep, CommandResult } from '../types'

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

function parseSearchEvidence(step: QueryStep, stdout: string, rawOutputPath: string): Evidence {
  const parsed = tryParseJson<SearchResponse>(stdout.trim())
  const tokens = parsed?.data?.tokens ?? []

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary:
      tokens.length > 0
        ? `${step.label} returned ${tokens.length} candidate token match(es).`
        : `${step.label} returned no token candidates.`,
    stance: 'neutral',
    signalStrength: tokens.length > 0 ? 0.5 : 0,
    metrics: {
      success: tokens.length > 0,
      candidateCount: tokens.length,
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
