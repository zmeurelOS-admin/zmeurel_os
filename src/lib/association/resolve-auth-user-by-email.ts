/**
 * Caută utilizator Auth după email (normalizat lowercase), paginând listUsers.
 * Folosește doar pe server cu client service role.
 */
export async function resolveAuthUserIdByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  emailRaw: string
): Promise<{ id: string; email: string } | null> {
  const normalized = emailRaw.trim().toLowerCase()
  if (!normalized.includes('@')) return null

  let page = 1
  const perPage = 200
  for (let safety = 0; safety < 100; safety++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[resolveAuthUserIdByEmail] listUsers', error.message)
      return null
    }
    const users = data?.users ?? []
    for (const u of users) {
      if (u.email?.toLowerCase() === normalized) {
        return { id: u.id, email: u.email ?? normalized }
      }
    }
    if (users.length < perPage) break
    page += 1
  }
  return null
}
