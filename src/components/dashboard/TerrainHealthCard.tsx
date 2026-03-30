import { cn } from '@/lib/utils'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type StatusTone = 'good' | 'warn' | 'bad'

function toneForDays(daysSinceTreatment: number, maxDays: number): StatusTone {
  if (daysSinceTreatment > maxDays) return 'bad'
  if (daysSinceTreatment <= 7) return 'good'
  return 'warn'
}

function badgeStyle(tone: StatusTone) {
  if (tone === 'good') {
    return 'border-[rgba(13,155,92,0.1)] bg-[rgba(13,155,92,0.06)] text-[#0D9B5C]'
  }
  if (tone === 'warn') {
    return 'border-[rgba(179,90,0,0.1)] bg-[rgba(179,90,0,0.06)] text-[#B35A00]'
  }
  return 'border-[rgba(207,34,46,0.1)] bg-[rgba(207,34,46,0.05)] text-[#CF222E]'
}

function fillStyle(tone: StatusTone) {
  if (tone === 'good') return 'bg-[#0D9B5C]'
  if (tone === 'warn') return 'bg-[#B35A00]'
  return 'bg-[#CF222E]'
}

export function TerrainHealthCard({
  name,
  variety,
  daysSinceTreatment,
  lastProduct,
  maxDays,
}: {
  name: string
  variety: string
  daysSinceTreatment: number
  lastProduct: string
  maxDays: number
}) {
  const safeMaxDays = Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 1
  const safeDays = Number.isFinite(daysSinceTreatment) && daysSinceTreatment >= 0 ? daysSinceTreatment : 0

  const tone = toneForDays(safeDays, safeMaxDays)
  const progress = clamp((safeDays / safeMaxDays) * 100, 0, 100)

  const badgeLabel =
    tone === 'good'
      ? 'La zi'
      : tone === 'bad'
        ? 'Depășit'
        : `${safeDays}/${safeMaxDays} zile`

  return (
    <div className="rounded-[22px] bg-[var(--agri-surface)] p-[18px] shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-bold text-[var(--agri-text)]">{name}</div>
          <div className="mt-1 truncate text-sm text-[var(--agri-text-muted)]">
            {variety}
            {lastProduct ? ` · ${lastProduct}` : ''}
          </div>
        </div>

        <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold', badgeStyle(tone))}>
          {badgeLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="h-[7px] w-full rounded-[4px] bg-[#EEECEA]">
          <div
            className={cn('h-[7px] rounded-[4px] transition-[width] duration-300', fillStyle(tone))}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--agri-text-muted)]">
          <span>Ultimul tratament</span>
          <span className="font-semibold text-[var(--agri-text)]">{safeDays} zile</span>
        </div>
      </div>
    </div>
  )
}
