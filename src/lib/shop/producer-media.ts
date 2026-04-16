// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function resolveProducerLogoUrl(admin: AnyAdmin, value: string | null | undefined): string | null {
  const trimmed = normalizeOptionalText(value)
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const publicUrl = admin?.storage?.from?.('producer-logos')?.getPublicUrl?.(trimmed)?.data?.publicUrl
  return typeof publicUrl === 'string' && publicUrl.trim() ? publicUrl : trimmed
}
