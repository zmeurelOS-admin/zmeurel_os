/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

const originalAccountDeleteProtectedUserIds = process.env.ACCOUNT_DELETE_PROTECTED_USER_IDS
const originalDemoCleanupProtectedOwnerUserIds = process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS

function restoreEnv() {
  if (originalAccountDeleteProtectedUserIds === undefined) {
    delete process.env.ACCOUNT_DELETE_PROTECTED_USER_IDS
  } else {
    process.env.ACCOUNT_DELETE_PROTECTED_USER_IDS = originalAccountDeleteProtectedUserIds
  }

  if (originalDemoCleanupProtectedOwnerUserIds === undefined) {
    delete process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS
  } else {
    process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS = originalDemoCleanupProtectedOwnerUserIds
  }
}

async function loadModule() {
  vi.resetModules()
  return import('@/lib/auth/protected-account')
}

afterEach(() => {
  restoreEnv()
})

describe('protected account helpers', () => {
  it('protejează ștergerea contului pentru superadmin indiferent de allowlist', async () => {
    const { isProtectedAccountDeletionUser } = await loadModule()
    expect(
      isProtectedAccountDeletionUser({
        userId: 'user-1',
        isSuperadmin: true,
      }),
    ).toBe(true)
  })

  it('protejează ștergerea contului pentru user_id din allowlist', async () => {
    process.env.ACCOUNT_DELETE_PROTECTED_USER_IDS = 'user-a,user-b'
    const { isProtectedAccountDeletionUser } = await loadModule()
    expect(
      isProtectedAccountDeletionUser({
        userId: 'user-b',
        isSuperadmin: false,
      }),
    ).toBe(true)
    expect(
      isProtectedAccountDeletionUser({
        userId: 'user-c',
        isSuperadmin: false,
      }),
    ).toBe(false)
  })

  it('protejează owner-ul demo cleanup când user_id este în allowlist', async () => {
    process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS = 'owner-a,owner-b'
    const { isProtectedDemoCleanupOwnerUserId } = await loadModule()
    expect(isProtectedDemoCleanupOwnerUserId('owner-b')).toBe(true)
    expect(isProtectedDemoCleanupOwnerUserId('owner-z')).toBe(false)
  })
})
