'use client'

import { AppCard } from '@/components/ui/app-card'

interface FracTimelineCardItem {
  aplicareId: string
  cod: string | null
}

interface FracRotationCardProps {
  timeline: FracTimelineCardItem[]
  violatii: Array<{ frac: string; aplicari_consecutive: number }>
}

function hashCode(input: string): number {
  return [...input].reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
}

function colorForCode(code: string): string {
  const hue = Math.abs(hashCode(code)) % 360
  return `hsl(${hue} 68% 58%)`
}

export function FracRotationCard({ timeline, violatii }: FracRotationCardProps) {
  return (
    <AppCard className="rounded-2xl">
      <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Rotație FRAC/IRAC</h3>

      {timeline.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">Nicio aplicare înregistrată.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {timeline.map((item) => {
            const code = item.cod ?? '—'
            const color = colorForCode(code)

            return (
              <span
                key={item.aplicareId}
                data-testid={`frac-chip-${code}`}
                className="inline-flex min-h-9 min-w-12 items-center justify-center rounded-xl border px-2 text-xs [font-weight:650]"
                style={{ backgroundColor: `${color}22`, borderColor: color, color }}
              >
                {code}
              </span>
            )
          })}
        </div>
      )}

      {violatii.length > 0 ? (
        <div className="mt-4 space-y-2 text-sm text-[var(--status-danger-text)]">
          {violatii.map((violatie) => (
            <p key={`${violatie.frac}-${violatie.aplicari_consecutive}`}>
              {violatie.aplicari_consecutive} violări: {violatie.frac} folosit de {violatie.aplicari_consecutive} ori consecutiv
            </p>
          ))}
        </div>
      ) : null}
    </AppCard>
  )
}

