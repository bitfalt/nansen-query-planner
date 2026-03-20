import type { QueryStep, ThesisInput } from './types'

export function buildWeekOnePlan(input: ThesisInput): QueryStep[] {
  const token = input.token
  const chain = input.chain

  return [
    {
      id: 'q1',
      label: 'Resolve entity and search context',
      command: `nansen research search --query "${token}" --limit 5`,
      rationale: 'Confirm the entity and collect the first contextual anchors.',
      category: 'search',
      expectedSignal: 'contextual',
    },
    {
      id: 'q2',
      label: 'Get token info',
      command: `nansen research token info --chain ${chain} --token ${token}`,
      rationale: 'Establish the token identity, contract, and basic metadata.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q3',
      label: 'Inspect token indicators',
      command: `nansen research token indicators --chain ${chain} --token ${token}`,
      rationale: 'Pull high-level market and risk indicators that could support or weaken the thesis.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q4',
      label: '7-day token flows',
      command: `nansen research token flows --chain ${chain} --token ${token} --days 7`,
      rationale: 'Check short-term net flow pressure and direction.',
      category: 'token',
      expectedSignal: 'supportive',
    },
    {
      id: 'q5',
      label: '30-day token flows',
      command: `nansen research token flows --chain ${chain} --token ${token} --days 30`,
      rationale: 'Compare short-term thesis to medium-term capital movement.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q6',
      label: 'Flow intelligence',
      command: `nansen research token flow-intelligence --chain ${chain} --token ${token} --days 7`,
      rationale: 'Identify the quality and character of capital flows.',
      category: 'token',
      expectedSignal: 'supportive',
    },
    {
      id: 'q7',
      label: 'Holder distribution',
      command: `nansen research token holders --chain ${chain} --token ${token}`,
      rationale: 'Check concentration and holder quality risk.',
      category: 'token',
      expectedSignal: 'contradictory',
    },
    {
      id: 'q8',
      label: 'Who bought and sold recently',
      command: `nansen research token who-bought-sold --chain ${chain} --token ${token} --days 7`,
      rationale: 'Identify directional participants and opposing evidence.',
      category: 'token',
      expectedSignal: 'contradictory',
    },
    {
      id: 'q9',
      label: 'PnL snapshot',
      command: `nansen research token pnl --chain ${chain} --token ${token} --days 30`,
      rationale: 'See whether current positioning looks healthy or crowded.',
      category: 'token',
      expectedSignal: 'contextual',
    },
    {
      id: 'q10',
      label: 'OHLCV context',
      command: `nansen research token ohlcv --chain ${chain} --token ${token} --timeframe 1h`,
      rationale: 'Add price-action context to the evidence set.',
      category: 'token',
      expectedSignal: 'contextual',
    },
  ]
}
