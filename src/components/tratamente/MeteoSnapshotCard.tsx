'use client'

import { AppCard } from '@/components/ui/app-card'
import type { MeteoSnapshot } from '@/lib/tratamente/meteo'

interface MeteoSnapshotCardProps {
  snapshot: MeteoSnapshot | null
}

export function MeteoSnapshotCard({ snapshot }: MeteoSnapshotCardProps) {
  return (
    <AppCard className="rounded-2xl">
      <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Snapshot meteo</h3>

      {snapshot ? (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
          <p>{`Temp: ${snapshot.temperatura_c ?? '—'}°C`}</p>
          <p>{`Umiditate: ${snapshot.umiditate_pct ?? '—'}%`}</p>
          <p>{`Vânt: ${snapshot.vant_kmh ?? '—'} km/h`}</p>
          <p>{`Ploaie 24h: ${snapshot.precipitatii_mm_24h ?? '—'} mm`}</p>
          <p className="col-span-2">{snapshot.descriere ?? 'Fără descriere meteo disponibilă.'}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Fără snapshot meteo.</p>
      )}
    </AppCard>
  )
}
