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

function safeParse(text: string): SearchResponse | null {
  try {
    return JSON.parse(text) as SearchResponse
  } catch {
    return null
  }
}

export function resolveTokenAddressFromSearch(
  stdout: string,
  chain: string,
  token: string,
): string | null {
  const parsed = safeParse(stdout.trim())
  const candidates = parsed?.data?.tokens
  if (!candidates || candidates.length === 0) return null

  const normalizedChain = chain.toLowerCase()
  const normalizedToken = token.toLowerCase()

  const exactChain = candidates.filter(
    (item) => item.chain?.toLowerCase() === normalizedChain,
  )

  const exactSymbol = exactChain.filter(
    (item) => item.symbol?.toLowerCase() === normalizedToken,
  )

  const ranked = (exactSymbol.length ? exactSymbol : exactChain).sort((a, b) => {
    const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER
    const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER
    return rankA - rankB
  })

  return ranked[0]?.address ?? null
}
