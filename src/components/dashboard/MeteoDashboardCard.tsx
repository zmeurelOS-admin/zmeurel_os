'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { DashboardCard } from '@/components/dashboard/DashboardCard'
import { cn } from '@/lib/utils'

type MeteoData = {
  available: boolean
  error?: string
  source?: 'cache' | 'fresh'
  current?: {
    temp: number | null
    icon: string | null
    description: string | null
    windSpeed: number | null
    humidity: number | null
  }
  forecastTomorrow?: {
    tempMin: number | null
    tempMax: number | null
    icon: string | null
    pop: number | null
  }
  spray?: {
    canSpray: boolean
    reason?: string
  }
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(digits, 1),
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function iconToEmoji(icon: string | null | undefined): string {
  switch (icon) {
    case '01d':
      return '☀️'
    case '01n':
      return '🌙'
    case '02d':
    case '02n':
      return '🌤️'
    case '03d':
    case '03n':
    case '04d':
    case '04n':
      return '☁️'
    case '09d':
    case '09n':
    case '10d':
    case '10n':
      return '🌧️'
    case '11d':
    case '11n':
      return '⛈️'
    case '13d':
    case '13n':
      return '❄️'
    case '50d':
    case '50n':
      return '🌫️'
    default:
      return '🌤️'
  }
}

function capitalize(value: string | null | undefined): string {
  const normalized = (value ?? '').trim()
  if (!normalized) return 'Date indisponibile'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function sprayTone(value: MeteoData['spray']) {
  const reason = (value?.reason ?? '').toLowerCase()
  if (value?.canSpray) {
    return {
      label: 'Stropire: condiții bune acum.',
      className: 'text-[var(--success-text)]',
    }
  }

  const severe =
    reason.includes('vânt') ||
    reason.includes('furtun') ||
    reason.includes('ploi') ||
    reason.includes('ploaie putern') ||
    reason.includes('îngheț')

  if (severe) {
    return {
      label: `Stropire: ${value?.reason ?? 'Condițiile sunt nefavorabile acum.'}`,
      className: 'text-[var(--status-danger-text)]',
    }
  }

  return {
    label: `Stropire: ${value?.reason ?? 'Condițiile nu sunt ideale acum.'}`,
    className: 'text-[var(--status-warning-text)]',
  }
}

export function MeteoDashboardCard({
  data,
  loading,
  error,
  primaryContext = 'camp',
  microclimate,
  className,
  compact = false,
}: {
  data: MeteoData | null
  loading: boolean
  error: string | null
  primaryContext?: 'solar' | 'camp' | 'mixed'
  microclimate?: {
    hasData: boolean
    isRecent: boolean
    temperature: number | null
    humidity: number | null
  } | null
  className?: string
  /** Pe desktop: card mai dens, fără lățime „hero”. */
  compact?: boolean
}) {
  const [hidePersistentError, setHidePersistentError] = useState(false)

  useEffect(() => {
    if (!error) return

    // reafișează eroarea la un nou eveniment (fără setState sincron în effect body)
    window.setTimeout(() => setHidePersistentError(false), 0)
    const timer = window.setTimeout(() => {
      setHidePersistentError(true)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [error])

  if (hidePersistentError && error) return null

  if (loading) {
    return (
      <DashboardCard title="Meteo azi" className={cn('overflow-hidden', compact && 'dashboard-meteo-compact', className)}>
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-28 rounded-full bg-[var(--surface-card-muted)]" />
          <div className="h-12 w-40 rounded-xl bg-[var(--surface-card-muted)]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 rounded-xl bg-[var(--surface-card-muted)]" />
            <div className="h-16 rounded-xl bg-[var(--surface-card-muted)]" />
          </div>
        </div>
      </DashboardCard>
    )
  }

  if (error) {
    return (
      <DashboardCard title="Meteo azi" className={cn('overflow-hidden', compact && 'dashboard-meteo-compact', className)}>
        <p className="text-sm text-[var(--text-secondary)]">Meteo indisponibil. Verifică mai târziu.</p>
      </DashboardCard>
    )
  }

  if (!data?.available) {
    const edgeError = (data?.error ?? '').trim()
    const isLikelyCoordsHint =
      !edgeError ||
      edgeError.toLowerCase().includes('tenant invalid') ||
      edgeError.toLowerCase().includes('coord')

    return (
      <DashboardCard title="Meteo azi" className={cn('overflow-hidden', compact && 'dashboard-meteo-compact', className)}>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          {edgeError && !isLikelyCoordsHint ? (
            <>
              <p>Meteo nu s-a putut încărca: {edgeError}</p>
              <p className="text-xs">
                Dacă mesajul menționează serviciul meteo sau cheia API, verifică `OPENWEATHERMAP_API_KEY` și deploy-ul
                funcțiilor `fetch-meteo` / `get-meteo`.
              </p>
            </>
          ) : (
            <p>Adaugă coordonate pe un teren comercial sau în Setări pentru a vedea meteo aici.</p>
          )}
        </div>
      </DashboardCard>
    )
  }

  const sprayStatus = sprayTone(data.spray)
  const isSolarContext = primaryContext === 'solar'
  const usesMicroclimate = isSolarContext && Boolean(microclimate?.isRecent)
  const currentTemp = usesMicroclimate ? microclimate?.temperature : data.current?.temp
  const currentHumidity = usesMicroclimate ? microclimate?.humidity : data.current?.humidity
  const solarHighTemp = typeof currentTemp === 'number' && currentTemp >= 28
  const solarHighHumidity = typeof currentHumidity === 'number' && currentHumidity > 80

  return (
    <DashboardCard
      title="Meteo azi"
      rightSlot={
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {data.source === 'cache' ? 'Cache 3h' : 'Actualizat'}
        </span>
      }
      className={cn('overflow-hidden', compact && 'dashboard-meteo-compact', className)}
      contentClassName={cn('space-y-2.5', compact && 'space-y-2')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('flex items-center', compact ? 'gap-2' : 'gap-3')}>
            <div className={cn(compact ? 'text-xl' : 'text-2xl')} aria-hidden="true">
              {iconToEmoji(data.current?.icon)}
            </div>
            <div>
              <div
                className={cn(
                  'font-bold leading-none tracking-[-0.04em] text-[var(--text-primary)]',
                  compact ? 'text-[1.35rem]' : 'text-[1.75rem]',
                )}
              >
                {formatNumber(currentTemp, 1)}°C
              </div>
              <div className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                {capitalize(data.current?.description)}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[9rem] text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {isSolarContext
            ? 'Context solar'
            : data.spray?.canSpray
              ? 'Poți stropi'
              : 'Atenție la stropire'}
        </div>
      </div>

      <div className={cn('text-[13px] leading-5 text-[var(--text-secondary)]', compact && 'text-[12px]')}>
        {isSolarContext
          ? `Temperatură ${formatNumber(currentTemp, 1)}°C • Umiditate ${formatNumber(currentHumidity, 0)}%`
          : `Vânt ${formatNumber(data.current?.windSpeed, 1)} km/h • Umiditate ${formatNumber(currentHumidity, 0)}%`}
      </div>

      {isSolarContext ? (
        <div className="space-y-1">
          {solarHighTemp ? (
            <div className="text-[13px] leading-5 [font-weight:650] text-[var(--status-warning-text)]">
              Aerisește solarul — temperatura este ridicată.
            </div>
          ) : null}
          {solarHighHumidity ? (
            <div className="text-[13px] leading-5 [font-weight:650] text-[var(--status-danger-text)]">
              Risc de boli — urmărește umiditatea în solar.
            </div>
          ) : null}
          {!solarHighTemp && !solarHighHumidity ? (
            <div className="text-[13px] leading-5 [font-weight:650] text-[var(--success-text)]">
              Parametri buni în solar pentru lucru curent.
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cn('text-[13px] leading-5 [font-weight:650]', sprayStatus.className)}>
          {sprayStatus.label}
        </div>
      )}

      {data.forecastTomorrow && !isSolarContext ? (
        <div className={cn('text-[12px] leading-5 text-[var(--text-secondary)]', compact && 'hidden')}>
          Mâine: {formatNumber(data.forecastTomorrow.tempMin, 1)}° / {formatNumber(data.forecastTomorrow.tempMax, 1)}°
          {' • '}Ploaie {formatPercent(data.forecastTomorrow.pop)}
        </div>
      ) : null}

      {data.forecastTomorrow && isSolarContext ? (
        <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
          Meteo exterior: vânt {formatNumber(data.current?.windSpeed, 1)} km/h • ploaie mâine {formatPercent(data.forecastTomorrow.pop)}
        </div>
      ) : null}

      {isSolarContext ? (
        <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
          {usesMicroclimate
            ? 'Pe baza datelor introduse în solar'
            : microclimate?.hasData
              ? 'Nu există date recente din solar'
              : 'Pe baza vremii exterioare'}
        </div>
      ) : null}

      {compact ? null : (
        <div className="text-[11px] leading-snug text-[var(--text-secondary)]">
          Sursă meteo:{' '}
          <Link href="https://openweathermap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            OpenWeather
          </Link>
        </div>
      )}
    </DashboardCard>
  )
}
