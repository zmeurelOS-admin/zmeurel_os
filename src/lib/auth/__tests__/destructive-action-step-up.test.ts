import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { destructiveActionScopes } from '@/lib/auth/destructive-action-step-up-contract'
import {
  __resetDestructiveActionStepUpForTests,
  issueDestructiveActionStepUpToken,
  verifyAndConsumeDestructiveActionStepUpToken,
} from '@/lib/auth/destructive-action-step-up'

const ORIGINAL_SECRET = process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET
const USER_ID = '7c560f97-a30a-4f52-a2a7-8f9222f0f66e'

describe('destructive action step-up tokens', () => {
  beforeEach(() => {
    process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET =
      'test-step-up-secret-value-with-at-least-thirty-two-bytes'
    __resetDestructiveActionStepUpForTests()
  })

  it('emite token valid și îl consumă o singură dată', () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.farmReset,
    })
    expect(issued).not.toBeNull()

    const first = verifyAndConsumeDestructiveActionStepUpToken({
      token: issued!.token,
      userId: USER_ID,
      scope: destructiveActionScopes.farmReset,
    })
    expect(first).toEqual({ ok: true })

    const second = verifyAndConsumeDestructiveActionStepUpToken({
      token: issued!.token,
      userId: USER_ID,
      scope: destructiveActionScopes.farmReset,
    })
    expect(second).toEqual({ ok: false, reason: 'replayed' })
  })

  it('respinge token expirat', () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.gdprAccountDelete,
      now: 1000,
      ttlMs: 60_000,
    })
    expect(issued).not.toBeNull()

    const result = verifyAndConsumeDestructiveActionStepUpToken({
      token: issued!.token,
      userId: USER_ID,
      scope: destructiveActionScopes.gdprAccountDelete,
      now: 1000 + 61_000,
    })
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('respinge token invalid pentru alt scope', () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.gdprFarmDelete,
    })
    expect(issued).not.toBeNull()

    const result = verifyAndConsumeDestructiveActionStepUpToken({
      token: issued!.token,
      userId: USER_ID,
      scope: destructiveActionScopes.gdprAccountDelete,
    })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('eșuează sigur când cheia lipsește', () => {
    process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET = ''
    __resetDestructiveActionStepUpForTests()

    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.gdprFarmDelete,
    })
    expect(issued).toBeNull()

    const result = verifyAndConsumeDestructiveActionStepUpToken({
      token: 'v1.invalid.invalid',
      userId: USER_ID,
      scope: destructiveActionScopes.gdprFarmDelete,
    })
    expect(result).toEqual({ ok: false, reason: 'misconfigured' })
  })
})

afterAll(() => {
  process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET = ORIGINAL_SECRET
})
