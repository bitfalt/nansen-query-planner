import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { CommandResult } from '../types'

function resolveNansenExecutable() {
  const explicitPath = process.env.NANSEN_CLI_PATH
  if (explicitPath) return explicitPath

  const bunBinPath = process.env.HOME ? join(process.env.HOME, '.bun', 'bin', 'nansen') : null
  if (bunBinPath && existsSync(bunBinPath)) return bunBinPath

  return 'nansen'
}

export function runNansenCommand(args: string[]): CommandResult {
  const result = spawnSync(resolveNansenExecutable(), args, { encoding: 'utf-8' })
  const stderr = [result.stderr, result.error?.message].filter(Boolean).join('\n')

  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr,
    exitCode: result.status,
  }
}
