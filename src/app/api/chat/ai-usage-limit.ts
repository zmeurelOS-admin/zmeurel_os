export const TEST_ACCOUNT_AI_EMAIL = 'zmeurel.app@gmail.com'
export const PRIVILEGED_AI_DAILY_LIMIT = 60

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase()
}

export function isPrivilegedAiLimitUser(params: {
  isSuperadmin?: boolean | null
  email?: string | null
}): boolean {
  if (params.isSuperadmin === true) return true
  return normalizeEmail(params.email) === TEST_ACCOUNT_AI_EMAIL
}

export function resolveAiDailyLimit(params: {
  baseLimit: number
  isSuperadmin?: boolean | null
  email?: string | null
}): number {
  return isPrivilegedAiLimitUser(params) ? PRIVILEGED_AI_DAILY_LIMIT : params.baseLimit
}
