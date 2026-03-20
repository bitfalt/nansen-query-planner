export type ThesisInput = {
  thesis: string
  token: string
  chain: string
  mode: 'plan' | 'execute'
  maxCalls?: number
}

export type QueryStep = {
  id: string
  label: string
  command: string
  rationale: string
  category: 'search' | 'token' | 'smart-money' | 'profiler'
  expectedSignal: 'supportive' | 'contradictory' | 'contextual'
}

export type Evidence = {
  id: string
  stepId: string
  summary: string
  stance: 'bull' | 'bear' | 'neutral'
  rawOutputPath?: string
}

export type PlannerRun = {
  runId: string
  input: ThesisInput
  steps: QueryStep[]
  evidence: Evidence[]
  executed: boolean
}
