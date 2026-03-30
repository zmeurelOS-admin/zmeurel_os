import Link from 'next/link'

import { DashboardCard } from '@/components/dashboard/DashboardCard'

type MeteoData = {
  available: boolean
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

export function MeteoDashboardCard({
  data,
  loading,
  error,
}: {
  data: MeteoData | null
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <DashboardCard title="Meteo azi" className="overflow-hidden">
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-28 rounded-full bg-[var(--agri-surface-muted)]" />
          <div className="h-12 w-40 rounded-2xl bg-[var(--agri-surface-muted)]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-[var(--agri-surface-muted)]" />
            <div className="h-20 rounded-2xl bg-[var(--agri-surface-muted)]" />
          </div>
        </div>
      </DashboardCard>
    )
  }

  if (error) {
    return (
      <DashboardCard title="Meteo azi" className="overflow-hidden">
        <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/50 px-4 py-4 text-sm text-[var(--agri-text-muted)]">
          {error}
        </div>
        <div className="pt-2 text-[10px] text-[var(--agri-text-muted)]">
          Date meteo:{' '}
          <Link href="https://openweathermap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            OpenWeather
          </Link>
        </div>
      </DashboardCard>
    )
  }

  if (!data?.available) {
    return (
      <DashboardCard title="Meteo azi" className="overflow-hidden">
        <div className="rounded-2xl border border-dashed border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/50 px-4 py-4 text-sm text-[var(--agri-text-muted)]">
          Adaugă coordonate pe o parcelă comercială sau în Setări pentru a vedea meteo pe dashboard.
        </div>
        <div className="pt-2 text-[10px] text-[var(--agri-text-muted)]">
          Date meteo:{' '}
          <Link href="https://openweathermap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            OpenWeather
          </Link>
        </div>
      </DashboardCard>
    )
  }

  const sprayTone = data.spray?.canSpray
    ? 'border-[rgba(13,155,92,0.1)] bg-[rgba(13,155,92,0.06)] text-[#0D9B5C]'
    : 'border-[rgba(207,34,46,0.1)] bg-[rgba(207,34,46,0.05)] text-[#CF222E]'

  return (
    <DashboardCard
      title="Meteo azi"
      rightSlot={
        <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--agri-text-muted)]">
          {data.source === 'cache' ? 'Cache 3h' : 'Actualizat'}
        </span>
      }
      className="overflow-hidden"
      contentClassName="space-y-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--agri-surface-muted)] text-2xl shadow-sm">
              {iconToEmoji(data.current?.icon)}
            </div>
            <div>
              <div className="text-3xl font-bold leading-none text-[var(--agri-text)]">
                {formatNumber(data.current?.temp, 1)}°C
              </div>
              <div className="mt-1 text-sm text-[var(--agri-text-muted)]">{capitalize(data.current?.description)}</div>
            </div>
          </div>
        </div>

        <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${sprayTone}`}>
          {data.spray?.canSpray ? 'Poți stropi' : data.spray?.reason ?? 'Nu poți stropi'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">Vânt</div>
          <div className="mt-2 text-lg font-bold text-[var(--agri-text)]">{formatNumber(data.current?.windSpeed, 1)} km/h</div>
          <div className="mt-1 text-xs text-[var(--agri-text-muted)]">Umiditate {formatNumber(data.current?.humidity, 0)}%</div>
        </div>

        <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">Mâine</div>
          <div className="mt-2 flex items-center gap-2 text-lg font-bold text-[var(--agri-text)]">
            <span>{iconToEmoji(data.forecastTomorrow?.icon)}</span>
            <span>{formatNumber(data.forecastTomorrow?.tempMin, 1)}° / {formatNumber(data.forecastTomorrow?.tempMax, 1)}°</span>
          </div>
          <div className="mt-1 text-xs text-[var(--agri-text-muted)]">Ploaie {formatPercent(data.forecastTomorrow?.pop)}</div>
        </div>

        <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">Recomandare</div>
          <div className="mt-2 text-lg font-bold text-[var(--agri-text)]">{data.spray?.canSpray ? 'Condiții bune' : 'Atenție'}</div>
          <div className="mt-1 text-xs text-[var(--agri-text-muted)]">{data.spray?.reason ?? 'Ploaie redusă, vânt mic și temperatură potrivită.'}</div>
        </div>
      </div>

      <div className="text-[10px] text-[var(--agri-text-muted)]">
        Date meteo:{' '}
        <Link href="https://openweathermap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          OpenWeather
        </Link>
      </div>
    </DashboardCard>
  )
}
