'use client'

import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import { AppCard } from '@/components/ui/app-card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { MeteoFereastra } from '@/lib/tratamente/meteo'

interface MeteoWindowBarProps {
  dateLabel: string
  ferestre: MeteoFereastra[]
}

function round(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 10) / 10}`
}

function computeStats(ferestre: MeteoFereastra[]) {
  const temps = ferestre
    .map((item) => item.temperatura_c)
    .filter((value): value is number => typeof value === 'number')
  const winds = ferestre
    .map((item) => item.vant_kmh)
    .filter((value): value is number => typeof value === 'number')
  const precip = ferestre.reduce((sum, item) => sum + (item.precipitatii_mm ?? 0), 0)

  return {
    minTemp: temps.length > 0 ? Math.min(...temps) : null,
    maxTemp: temps.length > 0 ? Math.max(...temps) : null,
    maxWind: winds.length > 0 ? Math.max(...winds) : null,
    totalPrecip: precip,
  }
}

export function MeteoWindowBar({ dateLabel, ferestre }: MeteoWindowBarProps) {
  const stats = computeStats(ferestre)

  return (
    <AppCard className="rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Ferestre meteo</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{dateLabel}</p>
        </div>
      </div>

      <TooltipProvider delayDuration={120}>
        <div className="mt-4" role="img" aria-label="Bară meteo 24h">
          <div className="grid grid-cols-24 gap-1">
            {ferestre.map((fereastra, index) => (
              <Tooltip key={`${fereastra.ora_start}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid="meteo-segment"
                    aria-label={`Ora ${format(parseISO(fereastra.ora_start), 'HH:mm')} ${fereastra.safe ? 'sigură' : 'nesigură'}`}
                    className={`h-8 rounded-md transition-colors active:scale-[0.98] ${
                      fereastra.safe ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] space-y-1">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {format(parseISO(fereastra.ora_start), 'HH:mm', { locale: ro })}
                  </p>
                  <p>Temp: {round(fereastra.temperatura_c)}°C</p>
                  <p>Vânt: {round(fereastra.vant_kmh)} km/h</p>
                  <p>Ploaie: {round(fereastra.precipitatii_mm)} mm</p>
                  {fereastra.motiv_blocaj ? <p>{fereastra.motiv_blocaj}</p> : <p>Fereastră sigură</p>}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-5 text-[11px] text-[var(--text-secondary)]">
            <span>00</span>
            <span className="text-center">06</span>
            <span className="text-center">12</span>
            <span className="text-center">18</span>
            <span className="text-right">24</span>
          </div>
        </div>
      </TooltipProvider>

      <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
        <p>{`Temp: ${round(stats.minTemp)}°C - ${round(stats.maxTemp)}°C`}</p>
        <p>{`Vânt max: ${round(stats.maxWind)} km/h`}</p>
        <p>{`Precipitații total: ${round(stats.totalPrecip)} mm`}</p>
      </div>
    </AppCard>
  )
}
