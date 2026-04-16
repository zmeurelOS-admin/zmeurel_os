function normalizeId(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function parseUserIdAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((item) => normalizeId(item))
      .filter(Boolean),
  )
}

function getProtectedDeletionUserIds(): Set<string> {
  return parseUserIdAllowlist(process.env.ACCOUNT_DELETE_PROTECTED_USER_IDS)
}

function getDemoCleanupProtectedOwnerUserIds(): Set<string> {
  return parseUserIdAllowlist(process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS)
}

export function isProtectedAccountDeletionUser(params: {
  userId?: string | null
  isSuperadmin?: boolean | null
}): boolean {
  if (params.isSuperadmin === true) return true
  const normalizedUserId = normalizeId(params.userId)
  if (!normalizedUserId) return false
  return getProtectedDeletionUserIds().has(normalizedUserId)
}

export function isProtectedDemoCleanupOwnerUserId(userId: string | null | undefined): boolean {
  const normalizedUserId = normalizeId(userId)
  if (!normalizedUserId) return false
  return getDemoCleanupProtectedOwnerUserIds().has(normalizedUserId)
}
