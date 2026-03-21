import type { Evidence, QueryStep } from '../types'
import type { ThesisProfile } from './profile'

function shouldFlipForNegativeClaim(step: QueryStep) {
  return step.id !== 'q1'
}

export function alignEvidenceToThesis(step: QueryStep, evidence: Evidence, profile: ThesisProfile): Evidence {
  if (profile.claimPolarity !== 'negative') {
    return evidence
  }

  if (!shouldFlipForNegativeClaim(step)) {
    return evidence
  }

  if (evidence.stance === 'bull') {
    return { ...evidence, stance: 'bear' }
  }

  if (evidence.stance === 'bear') {
    return { ...evidence, stance: 'bull' }
  }

  return evidence
}
