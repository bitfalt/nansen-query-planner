import { spawnSync } from 'node:child_process'
import type { CommandResult } from '../types'

export function runNansenCommand(args: string[]): CommandResult {
  const result = spawnSync('nansen', args, { encoding: 'utf-8' })
  const stderr = [result.stderr, result.error?.message].filter(Boolean).join('\n')

  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr,
    exitCode: result.status,
  }
}
