import type { Evidence, QueryStep } from '../types'
import type { ThesisProfile } from './profile'

function shouldFlipForNegativeClaim(step: QueryStep) {
  return step.id !== 'q1'
}

function neutralizeEvidence(evidence: Evidence): Evidence {
  return { ...evidence, stance: 'neutral', signalStrength: Math.min(evidence.signalStrength, 0.5) }
}

function flipEvidence(evidence: Evidence): Evidence {
  if (evidence.stance === 'bull') return { ...evidence, stance: 'bear' }
  if (evidence.stance === 'bear') return { ...evidence, stance: 'bull' }
  return evidence
}

export function alignEvidenceToThesis(step: QueryStep, evidence: Evidence, profile: ThesisProfile): Evidence {
  if (profile.claimFocus === 'concentration-risk') {
    if (step.id === 'q7' || step.id === 'q9') {
      return flipEvidence(evidence)
    }

    if (step.id === 'q2' || step.id === 'q4' || step.id === 'q5' || step.id === 'q6' || step.id === 'q8' || step.id === 'q10') {
      return neutralizeEvidence(evidence)
    }

    return evidence
  }

  if (profile.claimFocus === 'crowding-risk') {
    if (step.id === 'q9') {
      return flipEvidence(evidence)
    }

    if (step.id === 'q7') {
      return neutralizeEvidence(evidence)
    }

    return evidence
  }

  if (profile.claimPolarity !== 'negative') {
    return evidence
  }

  if (!shouldFlipForNegativeClaim(step)) {
    return evidence
  }

  return flipEvidence(evidence)
}
