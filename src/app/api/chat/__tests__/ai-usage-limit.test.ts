/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

const originalPrivilegedUserIds = process.env.AI_CHAT_PRIVILEGED_USER_IDS
const originalPrivilegedLimit = process.env.AI_CHAT_PRIVILEGED_DAILY_LIMIT

function restoreEnv() {
  if (originalPrivilegedUserIds === undefined) {
    delete process.env.AI_CHAT_PRIVILEGED_USER_IDS
  } else {
    process.env.AI_CHAT_PRIVILEGED_USER_IDS = originalPrivilegedUserIds
  }

  if (originalPrivilegedLimit === undefined) {
    delete process.env.AI_CHAT_PRIVILEGED_DAILY_LIMIT
  } else {
    process.env.AI_CHAT_PRIVILEGED_DAILY_LIMIT = originalPrivilegedLimit
  }
}

async function loadModule() {
  vi.resetModules()
  return import('@/app/api/chat/ai-usage-limit')
}

afterEach(() => {
  restoreEnv()
})

describe('ai usage limit privileged resolution', () => {
  it('acordă limită privilegiată pentru superadmin fără email hardcodat', async () => {
    const { resolveAiDailyLimit, DEFAULT_PRIVILEGED_AI_DAILY_LIMIT } = await loadModule()
    const result = resolveAiDailyLimit({
      baseLimit: 20,
      isSuperadmin: true,
      userId: 'user-1',
    })
    expect(result).toBe(DEFAULT_PRIVILEGED_AI_DAILY_LIMIT)
  })

  it('acordă limită privilegiată pe allowlist explicit de user IDs', async () => {
    process.env.AI_CHAT_PRIVILEGED_USER_IDS = '  user-a , USER-b '
    process.env.AI_CHAT_PRIVILEGED_DAILY_LIMIT = '75'
    const { resolveAiDailyLimit } = await loadModule()

    const result = resolveAiDailyLimit({
      baseLimit: 20,
      userId: 'user-b',
      isSuperadmin: false,
    })
    expect(result).toBe(75)
  })

  it('nu acordă limită privilegiată când user-ul nu e în role/allowlist', async () => {
    process.env.AI_CHAT_PRIVILEGED_USER_IDS = 'user-a,user-b'
    const { resolveAiDailyLimit } = await loadModule()

    const result = resolveAiDailyLimit({
      baseLimit: 20,
      userId: 'user-c',
      isSuperadmin: false,
    })
    expect(result).toBe(20)
  })
})
