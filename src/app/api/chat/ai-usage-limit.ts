export const DEFAULT_PRIVILEGED_AI_DAILY_LIMIT = 60

function normalizeUserId(userId: string | null | undefined): string {
  return String(userId ?? '').trim().toLowerCase()
}

function getPrivilegedUserIdAllowlist(): Set<string> {
  const raw = process.env.AI_CHAT_PRIVILEGED_USER_IDS?.trim()
  if (!raw) return new Set()
  const values = raw
    .split(',')
    .map((item) => normalizeUserId(item))
    .filter(Boolean)
  return new Set(values)
}

function getPrivilegedDailyLimit(): number {
  const fromEnv = Number.parseInt(process.env.AI_CHAT_PRIVILEGED_DAILY_LIMIT ?? '', 10)
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv
  }
  return DEFAULT_PRIVILEGED_AI_DAILY_LIMIT
}

export function isPrivilegedAiLimitUser(params: {
  isSuperadmin?: boolean | null
  userId?: string | null
}): boolean {
  if (params.isSuperadmin === true) return true
  const normalizedUserId = normalizeUserId(params.userId)
  if (!normalizedUserId) return false
  return getPrivilegedUserIdAllowlist().has(normalizedUserId)
}

export function resolveAiDailyLimit(params: {
  baseLimit: number
  isSuperadmin?: boolean | null
  userId?: string | null
}): number {
  return isPrivilegedAiLimitUser(params) ? getPrivilegedDailyLimit() : params.baseLimit
}
