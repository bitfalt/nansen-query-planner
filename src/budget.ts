import type { ThesisProfile } from './thesis/profile'

export type BudgetProfileName = 'safe' | 'expanded'

export type BudgetProfile = {
  name: BudgetProfileName
  maxCalls: number
  maxCredits: number
}

export type BudgetRecommendation = {
  recommendedProfile: BudgetProfileName
  reasoning: string[]
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

export function recommendBudgetProfile(profile: ThesisProfile): BudgetRecommendation {
  const reasoning: string[] = []
  let recommendedProfile: BudgetProfileName = 'safe'

  if (profile.lenses.length >= 3) {
    recommendedProfile = 'expanded'
    reasoning.push('The thesis bundles multiple evidence lenses, so a cheap pass will likely under-cover it.')
  }

  if (profile.claimFocus === 'concentration-risk' || profile.claimFocus === 'crowding-risk') {
    recommendedProfile = 'expanded'
    reasoning.push('Holder-health and crowding claims usually need the more expensive holder/PnL families.')
  }

  if (profile.claimFocus === 'momentum-confirmation' && profile.lenses.includes('flows')) {
    recommendedProfile = 'expanded'
    reasoning.push('Combining momentum confirmation with flow validation is more convincing with the fuller query set.')
  }

  if (profile.claimFocus === 'accumulation' && profile.lenses.length <= 2) {
    reasoning.push('A safe pass is usually enough for a first live read on a straightforward accumulation thesis.')
  }

  if (reasoning.length === 0) {
    reasoning.push('Start with the safe budget unless the thesis explicitly needs deeper holder, PnL, or indicator coverage.')
  }

  return {
    recommendedProfile,
    reasoning,
  }
}
