type SearchResponse = {
  success?: boolean
  data?: {
    tokens?: Array<{
      name?: string
      symbol?: string
      chain?: string
      address?: string
      market_cap?: number | null
      volume_24h?: number | null
      rank?: number | null
    }>
  }
}

export type ResolvedTokenCandidate = {
  address: string
  symbol: string
  name: string
  chain: string
  rank: number | null
  score: number
}

function safeParse(text: string): SearchResponse | null {
  try {
    return JSON.parse(text) as SearchResponse
  } catch {
    return null
  }
}

export function resolveTokenCandidateFromSearch(
  stdout: string,
  chain?: string,
  token?: string,
): ResolvedTokenCandidate | null {
  const parsed = safeParse(stdout.trim())
  const candidates = parsed?.data?.tokens
  if (!candidates || candidates.length === 0) return null

  const normalizedChain = chain?.toLowerCase() ?? null
  const normalizedToken = token?.toLowerCase() ?? null

  const ranked = candidates
    .map((candidate) => {
      let score = 0
      const candidateChain = candidate.chain?.toLowerCase() ?? ''
      const candidateSymbol = candidate.symbol?.toLowerCase() ?? ''
      const candidateName = candidate.name?.toLowerCase() ?? ''

      if (normalizedChain && candidateChain === normalizedChain) score += 5
      if (normalizedToken && candidateSymbol === normalizedToken) score += 6
      if (normalizedToken && candidateName === normalizedToken) score += 4
      if (normalizedToken && candidateName.includes(normalizedToken)) score += 2
      if (typeof candidate.market_cap === 'number' && candidate.market_cap > 0) score += 1
      if (typeof candidate.volume_24h === 'number' && candidate.volume_24h > 0) score += 1

      return {
        address: candidate.address ?? '',
        symbol: candidate.symbol ?? 'unknown',
        name: candidate.name ?? 'unknown',
        chain: candidate.chain ?? 'unknown',
        rank: typeof candidate.rank === 'number' ? candidate.rank : null,
        score,
      }
    })
    .filter((candidate) => candidate.address)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER
      const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER
      return rankA - rankB
    })

  return ranked[0] ?? null
}

export function resolveTokenAddressFromSearch(stdout: string, chain?: string, token?: string): string | null {
  return resolveTokenCandidateFromSearch(stdout, chain, token)?.address ?? null
}
