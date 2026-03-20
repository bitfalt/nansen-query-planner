import type { Evidence, QueryStep, CommandResult } from '../types'

function tryParseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function truncate(text: string, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

export function buildEvidenceFromCommand(step: QueryStep, result: CommandResult, rawOutputPath: string): Evidence {
  const parsed = tryParseJson(result.stdout.trim())
  const defaultStance = step.expectedSignal === 'supportive' ? 'bull' : step.expectedSignal === 'contradictory' ? 'bear' : 'neutral'

  if (!result.success) {
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} could not be validated live yet. The command failed or returned an unusable response.`,
      stance: 'neutral',
      signalStrength: 0,
      metrics: { exitCode: result.exitCode ?? -1 },
      rawOutputPath,
    }
  }

  if (parsed && typeof parsed === 'object') {
    const data = (parsed as any).data
    const size = Array.isArray(data) ? data.length : data && typeof data === 'object' ? Object.keys(data).length : 0
    return {
      id: `ev_${step.id}`,
      stepId: step.id,
      summary: `${step.label} returned live structured data${size ? ` with ${size} top-level item(s)` : ''}.`,
      stance: defaultStance,
      signalStrength: defaultStance === 'neutral' ? 0.5 : 1,
      metrics: {
        success: true,
        hasData: Boolean(data),
        topLevelSize: size,
      },
      rawOutputPath,
    }
  }

  return {
    id: `ev_${step.id}`,
    stepId: step.id,
    summary: `${step.label} returned non-JSON output: ${truncate(result.stdout.trim() || result.stderr.trim() || 'no output')}`,
    stance: defaultStance,
    signalStrength: defaultStance === 'neutral' ? 0.5 : 1,
    metrics: {
      success: true,
      outputKind: 'text',
    },
    rawOutputPath,
  }
}
