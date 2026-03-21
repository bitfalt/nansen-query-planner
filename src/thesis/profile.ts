import type { QueryStep, ThesisInput } from '../types'

const CHAIN_ALIASES: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  eth: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  op: 'optimism',
  starknet: 'starknet',
  avalanche: 'avalanche',
  avax: 'avalanche',
  polygon: 'polygon',
  matic: 'polygon',
  bitcoin: 'bitcoin',
  btc: 'bitcoin',
  bsc: 'bsc',
  tron: 'tron',
}

const ENTITY_ALIASES: Array<{
  pattern: RegExp
  subject: string
  token: string
  chain?: string
}> = [
  { pattern: /\bhyperliquid\b/i, subject: 'Hyperliquid', token: 'HYPE', chain: 'solana' },
  { pattern: /\bhype\b/i, subject: 'HYPE', token: 'HYPE', chain: 'solana' },
  { pattern: /\bstarknet\b/i, subject: 'Starknet', token: 'STRK', chain: 'starknet' },
  { pattern: /\bbitcoin\b/i, subject: 'Bitcoin', token: 'BTC', chain: 'bitcoin' },
  { pattern: /\bethereum\b/i, subject: 'Ethereum', token: 'ETH', chain: 'ethereum' },
  { pattern: /\bsolana\b/i, subject: 'Solana', token: 'SOL', chain: 'solana' },
]

const STOP_TICKERS = new Set(['I', 'A', 'THE', 'AND', 'OR', 'USD', 'TVL', 'BTC', 'ETH'])

export type ThesisLens =
  | 'smart-money'
  | 'flows'
  | 'holders'
  | 'momentum'
  | 'valuation'
  | 'catalyst'

export type ThesisProfile = {
  searchQuery: string
  tokenHint: string
  chainHint: string
  lenses: ThesisLens[]
  claimPolarity: 'positive' | 'negative'
  confidence: 'low' | 'medium' | 'high'
  reasoning: string[]
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function firstUppercaseTicker(thesis: string) {
  const matches = thesis.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) ?? []
  return matches.find((match) => !STOP_TICKERS.has(match)) ?? null
}

function inferAlias(thesis: string) {
  return ENTITY_ALIASES.find((entry) => entry.pattern.test(thesis)) ?? null
}

function inferChain(thesis: string) {
  const lower = thesis.toLowerCase()

  for (const [alias, canonical] of Object.entries(CHAIN_ALIASES)) {
    if (lower.includes(alias)) {
      return canonical
    }
  }

  return null
}

function inferSearchQuery(thesis: string) {
  const movementMatch = thesis.match(
    /(?:into|accumulating|buying|rotating into|moving into|bullish on)\s+([A-Za-z0-9][A-Za-z0-9\s-]{1,40})/i,
  )

  if (movementMatch?.[1]) {
    return titleCase(movementMatch[1].split(/[.,!?:;]/)[0].trim())
  }

  return null
}

function detectLenses(thesis: string): ThesisLens[] {
  const lower = thesis.toLowerCase()
  const lenses = new Set<ThesisLens>()

  if (/smart money|smart-money|funds|whales?|institutions?/.test(lower)) {
    lenses.add('smart-money')
  }

  if (/capital|flow|flows|moving into|inflow|outflow|accumulat/.test(lower)) {
    lenses.add('flows')
  }

  if (/holders?|distribution|concentration/.test(lower)) {
    lenses.add('holders')
  }

  if (/price|breakout|momentum|trend|volume|priced in/.test(lower)) {
    lenses.add('momentum')
  }

  if (/market cap|fdv|valuation|undervalued|overvalued/.test(lower)) {
    lenses.add('valuation')
  }

  if (/since|because|after|launch|revealed|announced|upgrade|catalyst/.test(lower)) {
    lenses.add('catalyst')
  }

  if (lenses.size === 0) {
    lenses.add('flows')
  }

  return [...lenses]
}

function detectClaimPolarity(thesis: string): ThesisProfile['claimPolarity'] {
  const lower = thesis.toLowerCase()
  const negativePatterns = [
    /too concentrated/,
    /unhealthy/,
    /crowded/,
    /trapped/,
    /distribution/,
    /selling pressure/,
    /weakening/,
    /exhausted/,
    /late longs/,
    /overvalued/,
  ]
  const positivePatterns = [
    /accumulat/,
    /moving into/,
    /rotation into/,
    /bullish/,
    /confirming/,
    /healthy/,
    /undervalued/,
    /support/,
    /smart money is moving into/,
  ]

  if (negativePatterns.some((pattern) => pattern.test(lower))) {
    return 'negative'
  }

  if (positivePatterns.some((pattern) => pattern.test(lower))) {
    return 'positive'
  }

  return 'positive'
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

export function buildThesisProfile(input: ThesisInput): ThesisProfile {
  const alias = inferAlias(input.thesis)
  const ticker = firstUppercaseTicker(input.thesis)
  const inferredChain = inferChain(input.thesis)
  const queryFromText = inferSearchQuery(input.thesis)
  const tokenHint = input.token ?? alias?.token ?? ticker ?? queryFromText ?? 'TOKEN'
  const searchQuery =
    input.token ?? alias?.subject ?? queryFromText ?? ticker ?? input.thesis.slice(0, 60).trim()
  const chainHint = input.chain ?? alias?.chain ?? inferredChain ?? 'solana'

  const reasoning = unique(
    [
      input.token ? `Using explicit token hint: ${input.token}.` : null,
      input.chain ? `Using explicit chain hint: ${input.chain}.` : null,
      alias ? `Matched entity alias from thesis: ${alias.subject} -> ${alias.token}.` : null,
      ticker && !input.token ? `Found uppercase ticker candidate in thesis: ${ticker}.` : null,
      queryFromText && !alias ? `Extracted subject phrase from thesis: ${queryFromText}.` : null,
      inferredChain && !input.chain ? `Detected chain mention in thesis: ${inferredChain}.` : null,
    ].filter(Boolean) as string[],
  )

  const confidence: ThesisProfile['confidence'] =
    input.token || alias
      ? 'high'
      : ticker || inferredChain || queryFromText
        ? 'medium'
        : 'low'

  return {
    searchQuery,
    tokenHint,
    chainHint,
    lenses: detectLenses(input.thesis),
    claimPolarity: detectClaimPolarity(input.thesis),
    confidence,
    reasoning,
  }
}

function scoreStep(step: QueryStep, profile: ThesisProfile) {
  let score = 0

  if (step.id === 'q1') score += 100
  if (step.id === 'q2') score += 90

  if (profile.lenses.includes('smart-money')) {
    if (step.id === 'q6') score += 40
    if (step.id === 'q8') score += 35
    if (step.id === 'q4') score += 25
    if (step.id === 'q5') score += 20
  }

  if (profile.lenses.includes('flows')) {
    if (step.id === 'q4') score += 45
    if (step.id === 'q5') score += 35
    if (step.id === 'q6') score += 25
  }

  if (profile.lenses.includes('holders')) {
    if (step.id === 'q7') score += 40
    if (step.id === 'q8') score += 25
  }

  if (profile.lenses.includes('momentum')) {
    if (step.id === 'q3') score += 30
    if (step.id === 'q10') score += 25
    if (step.id === 'q9') score += 20
  }

  if (profile.lenses.includes('valuation')) {
    if (step.id === 'q2') score += 20
    if (step.id === 'q9') score += 20
  }

  if (profile.lenses.includes('catalyst')) {
    if (step.id === 'q3') score += 20
    if (step.id === 'q4') score += 15
    if (step.id === 'q10') score += 10
  }

  if (!profile.lenses.includes('momentum') && step.id === 'q3') score -= 20
  if (!profile.lenses.includes('holders') && step.id === 'q7') score -= 15
  if (!profile.lenses.includes('valuation') && step.id === 'q9') score -= 5

  if (step.estimatedCostCredits >= 50) {
    score -= 25
  } else if (step.estimatedCostCredits >= 20) {
    score -= 10
  }

  return score
}

function isMandatory(step: QueryStep) {
  return step.id === 'q1' || step.id === 'q2'
}

function utilityPerCredit(step: QueryStep, profile: ThesisProfile) {
  return scoreStep(step, profile) / Math.max(step.estimatedCostCredits, 1)
}

export function prioritizePlan(
  steps: QueryStep[],
  profile: ThesisProfile,
  maxCalls?: number,
  maxCredits?: number,
) {
  const budget = Number.isFinite(maxCredits) ? (maxCredits as number) : Number.POSITIVE_INFINITY
  const callLimit = Number.isFinite(maxCalls) ? Math.max(1, maxCalls as number) : steps.length

  const mandatory = steps
    .filter(isMandatory)
    .sort((a, b) => scoreStep(b, profile) - scoreStep(a, profile))
  const optional = steps
    .filter((step) => !isMandatory(step))
    .sort((a, b) => {
      const byUtility = utilityPerCredit(b, profile) - utilityPerCredit(a, profile)
      if (byUtility !== 0) return byUtility
      return scoreStep(b, profile) - scoreStep(a, profile)
    })

  const selected: QueryStep[] = []
  let spent = 0

  for (const step of mandatory) {
    if (selected.length >= callLimit) break
    if (spent + step.estimatedCostCredits > budget && selected.length > 0) continue
    selected.push(step)
    spent += step.estimatedCostCredits
  }

  for (const step of optional) {
    if (selected.length >= callLimit) break
    if (spent + step.estimatedCostCredits > budget) continue
    selected.push(step)
    spent += step.estimatedCostCredits
  }

  return selected
}
