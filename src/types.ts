export type ThesisInput = {
  thesis: string
  token?: string
  chain?: string
  mode: 'plan' | 'execute'
  maxCalls?: number
  maxCredits?: number
}

export type QueryStep = {
  id: string
  label: string
  command: string
  rationale: string
  category: 'search' | 'token' | 'smart-money' | 'profiler'
  queryFamily:
    | 'identity'
    | 'baseline'
    | 'indicators'
    | 'flows'
    | 'flow-intelligence'
    | 'holders'
    | 'participants'
    | 'pnl'
    | 'price'
  expectedSignal: 'supportive' | 'contradictory' | 'contextual'
  estimatedCostCredits: number
}

export type Evidence = {
  id: string
  stepId: string
  summary: string
  stance: 'bull' | 'bear' | 'neutral'
  signalStrength: number
  metrics?: Record<string, string | number | boolean>
  rawOutputPath?: string
}

export type Verdict = {
  decision: 'SUPPORTED' | 'CONTRADICTED' | 'MIXED' | 'INCONCLUSIVE'
  confidence: 'low' | 'medium' | 'high'
  bullEvidenceCount: number
  bearEvidenceCount: number
  neutralEvidenceCount: number
  bullSignal: number
  bearSignal: number
  explanation: string
}

export type StructuredReport = {
  reportType: 'thesis-battlefield.v1'
  runId: string
  generatedAt: string
  thesis: string
  token: string
  chain: string
  mode: 'plan' | 'execute'
  executed: boolean
  verdict: Verdict
  plannerSummary: {
    totalQueries: number
    executedQueries: number
    categories: string[]
    estimatedTotalCredits: number
    recommendedBudgetProfile: 'safe' | 'expanded'
    recommendedBudgetReasoning: string[]
    budgetOptions: {
      safe: { maxCalls: number; maxCredits: number }
      expanded: { maxCalls: number; maxCredits: number }
    }
  }
  llmSummary: {
    oneSentence: string
    analystTake: string
    nextAction: string
  }
  plannedQueries: QueryStep[]
  evidence: Evidence[]
  queryTrace: string[]
  nextQuestions: string[]
  strongestBullEvidence: Evidence | null
  strongestBearEvidence: Evidence | null
  caveats: string[]
  agentSummary: {
    strongestBullCase: string
    strongestBearCase: string
  }
  thesisProfile?: {
    searchQuery: string
    tokenHint: string
    chainHint: string
    lenses: string[]
    claimPolarity: 'positive' | 'negative'
    claimFocus:
      | 'accumulation'
      | 'concentration-risk'
      | 'crowding-risk'
      | 'momentum-confirmation'
      | 'general'
    ambiguityWarning?: string
    confidence: 'low' | 'medium' | 'high'
    reasoning: string[]
  }
}

export type PlannerRun = {
  runId: string
  input: ThesisInput
  steps: QueryStep[]
  evidence: Evidence[]
  executed: boolean
}

export type CommandResult = {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}
