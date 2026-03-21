#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  alignEvidenceToThesis,
  buildEvidenceFromCommand,
  buildThesisProfile,
  buildVerdict,
  buildWeekOnePlan,
} from '../src/index'

type FixtureFile = {
  meta: {
    slug: string
    token: string
    chain: string
    budgetProfile: string
  }
  queryOutputs: Record<string, string>
}

function loadFixture(name: string): FixtureFile {
  const path = join(process.cwd(), 'fixtures', 'live-samples', name)
  return JSON.parse(readFileSync(path, 'utf8')) as FixtureFile
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runCase(options: {
  fixtureName: string
  thesis: string
  expectedDecision: string
  expectedFocus: string
  maxCalls: number
  maxCredits: number
}) {
  const fixture = loadFixture(options.fixtureName)
  const profile = buildThesisProfile({
    thesis: options.thesis,
    token: fixture.meta.token,
    chain: fixture.meta.chain,
    mode: 'plan',
    maxCalls: options.maxCalls,
    maxCredits: options.maxCredits,
  })
  const steps = buildWeekOnePlan({
    thesis: options.thesis,
    token: fixture.meta.token,
    chain: fixture.meta.chain,
    mode: 'plan',
    maxCalls: options.maxCalls,
    maxCredits: options.maxCredits,
  })
  const evidence = steps
    .filter((step) => Boolean(fixture.queryOutputs[step.id]))
    .map((step) =>
      alignEvidenceToThesis(
        step,
        buildEvidenceFromCommand(
          step,
          {
            success: !fixture.queryOutputs[step.id].includes('"success":false'),
            stdout: fixture.queryOutputs[step.id],
            stderr: '',
            exitCode: fixture.queryOutputs[step.id].includes('"success":false') ? 1 : 0,
          },
          `${fixture.meta.slug}/${step.id}.txt`,
        ),
        profile,
      ),
    )

  const verdict = buildVerdict(evidence, true, profile)

  assert(profile.claimFocus === options.expectedFocus, `${options.thesis}: expected focus ${options.expectedFocus}, got ${profile.claimFocus}`)
  assert(verdict.decision === options.expectedDecision, `${options.thesis}: expected verdict ${options.expectedDecision}, got ${verdict.decision}`)

  return {
    thesis: options.thesis,
    claimFocus: profile.claimFocus,
    verdict,
    evidence: evidence.map((entry) => ({
      stepId: entry.stepId,
      stance: entry.stance,
      signalStrength: entry.signalStrength,
    })),
  }
}

const results = [
  runCase({
    fixtureName: 'hype-solana-expanded.json',
    thesis: 'This token is too concentrated in a few wallets and the holder base is unhealthy.',
    expectedDecision: 'SUPPORTED',
    expectedFocus: 'concentration-risk',
    maxCalls: 10,
    maxCredits: 200,
  }),
  runCase({
    fixtureName: 'hype-solana-expanded.json',
    thesis: 'This token looks crowded and late longs are likely trapped.',
    expectedDecision: 'SUPPORTED',
    expectedFocus: 'crowding-risk',
    maxCalls: 10,
    maxCredits: 200,
  }),
  runCase({
    fixtureName: 'hype-solana-expanded.json',
    thesis: 'Price momentum is finally confirming the capital rotation into this token.',
    expectedDecision: 'SUPPORTED',
    expectedFocus: 'momentum-confirmation',
    maxCalls: 10,
    maxCredits: 200,
  }),
  runCase({
    fixtureName: 'strk-starknet-safe.json',
    thesis: 'A lot of capital is moving into Starknet since they just revealed private BTC and private ERC20s. I believe smart money is moving into Starknet.',
    expectedDecision: 'SUPPORTED',
    expectedFocus: 'accumulation',
    maxCalls: 8,
    maxCredits: 80,
  }),
]

console.log(JSON.stringify({ ok: true, results }, null, 2))
