import type { QueryStep, ThesisInput } from './types'
import { buildThesisProfile, prioritizePlan } from './thesis/profile'

export function buildWeekOnePlan(input: ThesisInput): QueryStep[] {
  const profile = buildThesisProfile(input)
  const token = profile.tokenHint
  const chain = profile.chainHint

  const steps: QueryStep[] = [
    {
      id: 'q1',
      label: 'Resolve entity and search context',
      command: `nansen research search --query "${profile.searchQuery}" --limit 5`,
      rationale: 'Confirm the entity, resolve the best token candidate, and collect the first contextual anchors.',
      category: 'search',
      expectedSignal: 'contextual',
    },
    {
      id: 'q2',
      label: 'Get token info',
      command: `nansen research token info --chain ${chain} --token ${token}`,
      rationale: 'Establish the token identity, contract, market structure, and baseline metadata.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q3',
      label: 'Inspect token indicators',
      command: `nansen research token indicators --chain ${chain} --token ${token}`,
      rationale: 'Pull high-level market, momentum, and risk indicators that could support or weaken the thesis.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q4',
      label: '7-day token flows',
      command: `nansen research token flows --chain ${chain} --token ${token} --days 7`,
      rationale: 'Check short-term net flow pressure, recent capital direction, and whether the move is accelerating.',
      category: 'token',
      expectedSignal: 'supportive',
    },
    {
      id: 'q5',
      label: '30-day token flows',
      command: `nansen research token flows --chain ${chain} --token ${token} --days 30`,
      rationale: 'Compare the short-term claim to medium-term capital movement and persistence.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q6',
      label: 'Flow intelligence',
      command: `nansen research token flow-intelligence --chain ${chain} --token ${token} --days 7`,
      rationale: 'Identify the quality, source, and character of the capital flows behind the thesis.',
      category: 'token',
      expectedSignal: 'supportive',
    },
    {
      id: 'q7',
      label: 'Holder distribution',
      command: `nansen research token holders --chain ${chain} --token ${token}`,
      rationale: 'Check concentration, holder quality, and whether the ownership base contradicts the thesis.',
      category: 'token',
      expectedSignal: 'contradictory',
    },
    {
      id: 'q8',
      label: 'Who bought and sold recently',
      command: `nansen research token who-bought-sold --chain ${chain} --token ${token} --days 7`,
      rationale: 'Identify directional participants, smart-money behavior, and opposing evidence.',
      category: 'token',
      expectedSignal: 'contradictory',
    },
    {
      id: 'q9',
      label: 'PnL snapshot',
      command: `nansen research token pnl --chain ${chain} --token ${token} --days 30`,
      rationale: 'See whether current positioning looks healthy, crowded, or vulnerable to reversal.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q10',
      label: 'OHLCV context',
      command: `nansen research token ohlcv --chain ${chain} --token ${token} --timeframe 1h`,
      rationale: 'Add price-action context to the evidence set and test whether momentum confirms the thesis.',
      category: 'token',
      expectedSignal: 'contextual',
    },
  ]

  return prioritizePlan(steps, profile)
}
