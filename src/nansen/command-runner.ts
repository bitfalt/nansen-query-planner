import { spawnSync } from 'node:child_process'

export type CommandResult = {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export function runNansenCommand(args: string[]): CommandResult {
  const result = spawnSync('nansen', args, { encoding: 'utf-8' })
  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status,
  }
}
