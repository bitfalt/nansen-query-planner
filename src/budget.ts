export type BudgetProfileName = 'safe' | 'expanded'

export type BudgetProfile = {
  name: BudgetProfileName
  maxCalls: number
  maxCredits: number
}

export const BUDGET_PROFILES: Record<BudgetProfileName, BudgetProfile> = {
  safe: {
    name: 'safe',
    maxCalls: 8,
    maxCredits: 80,
  },
  expanded: {
    name: 'expanded',
    maxCalls: 10,
    maxCredits: 200,
  },
}

export function resolveBudgetProfile(name?: string | null): BudgetProfile {
  if (name === 'expanded') return BUDGET_PROFILES.expanded
  return BUDGET_PROFILES.safe
}
