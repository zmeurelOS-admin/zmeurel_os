'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useMeteo } from '@/hooks/useMeteo'
import { cn } from '@/lib/utils'

type WeatherCardData = NonNullable<ReturnType<typeof useMeteo>['data']> & {
  city?: string | null
  locationName?: string | null
}

function iconToEmoji(icon: string | null | undefined): string {
  switch (icon) {
    case '01d':
    case '01n':
      return '☀️'
    case '02d':
    case '02n':
      return '🌤️'
    case '03d':
    case '03n':
      return '☁️'
    case '04d':
    case '04n':
      return '☁️'
    case '09d':
    case '09n':
      return '🌧️'
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

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(digits, 1),
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return String(Math.round(value * 100))
}

type VerdictTone = 'good' | 'warn' | 'bad'

function verdictClasses(tone: VerdictTone) {
  if (tone === 'good') {
    return 'border-[rgba(13,155,92,0.1)] bg-[rgba(13,155,92,0.06)] text-[#0D9B5C]'
  }
  if (tone === 'warn') {
    return 'border-[rgba(179,90,0,0.1)] bg-[rgba(179,90,0,0.06)] text-[#B35A00]'
  }
  return 'border-[rgba(207,34,46,0.1)] bg-[rgba(207,34,46,0.05)] text-[#CF222E]'
}

function resolveLocationLabel(data: WeatherCardData | null): string {
  const explicitLocation = (data?.city ?? data?.locationName ?? '').trim()
  if (explicitLocation) {
    return explicitLocation.toUpperCase()
  }

  return 'FERMĂ'
}

function computeTodayVerdict(data: WeatherCardData | null): { label: string; tone: VerdictTone } {
  if (data?.spray?.canSpray) {
    return { label: '● Poți stropi', tone: 'good' }
  }

  if (data?.spray?.reason) {
    return { label: `● Nu stropi (${data.spray.reason})`, tone: 'bad' }
  }

  return { label: '● Nu stropi', tone: 'warn' }
}

function computeTomorrowVerdict(pop: number | null | undefined): { label: string; tone: VerdictTone } {
  if (pop === null || pop === undefined || Number.isNaN(pop)) {
    return { label: '● Date insuficiente', tone: 'warn' }
  }
  if (pop >= 0.3) {
    return { label: '● Nu stropi (ploi probabile)', tone: 'bad' }
  }
  if (pop >= 0.2) {
    return { label: '● Atenție (ploi posibile)', tone: 'warn' }
  }
  return { label: '● Poți stropi', tone: 'good' }
}

export function WeatherCard({ data }: { data: WeatherCardData | null }) {
  const router = useRouter()

  const available = data?.available === true

  if (!available) {
    return (
      <div>
        <div className="rounded-[22px] bg-[var(--agri-surface)] p-[18px] shadow-sm">
          <div className="text-sm font-semibold text-[var(--agri-text)]">📍 Setează locația fermei pentru prognoză meteo</div>
          <div className="mt-2 text-sm text-[var(--agri-text-muted)]">Completează coordonatele în Setări (sau pe o parcelă comercială).</div>
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white shadow-sm transition duration-150 active:scale-[0.985]"
          >
            Adaugă locație
          </button>
        </div>

        <div className="mt-2 text-[10px] text-[var(--agri-text-muted)]">
          Date meteo:{' '}
          <Link href="https://openweathermap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            OpenWeather
          </Link>
        </div>
      </div>
    )
  }

  const todayVerdict = computeTodayVerdict(data)
  const tomorrowVerdict = computeTomorrowVerdict(data?.forecastTomorrow?.pop)

  return (
    <div>
      <div className="rounded-[22px] bg-[var(--agri-surface)] shadow-sm">
        <div className="grid grid-cols-[1fr_1px_1fr]">
          <div className="p-[18px]">
            <div className="text-[11px] font-[650] tracking-[0.8px] text-[var(--agri-text-muted)]">AZI · {resolveLocationLabel(data)}</div>

            <div className="mt-3 text-[44px] leading-none">{iconToEmoji(data?.current?.icon)}</div>

            <div className="mt-2 text-[32px] font-bold tracking-[-2px] text-[var(--agri-text)]">
              {formatNumber(data?.current?.temp, 0)}°
            </div>

            <div className="mt-2 text-sm text-[var(--agri-text-muted)]">
              Vânt {formatNumber(data?.current?.windSpeed, 0)} km/h
            </div>

            <div
              className={cn(
                'mt-4 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold',
                verdictClasses(todayVerdict.tone)
              )}
            >
              {todayVerdict.label}
            </div>
          </div>

          <div className="w-px bg-[linear-gradient(180deg,transparent,#E8E6E2,transparent)]" />

          <div className="p-[18px]">
            <div className="text-[11px] font-[650] tracking-[0.8px] text-[var(--agri-text-muted)]">MÂINE</div>

            <div className="mt-3 flex items-end gap-2">
              <div className="text-[36px] leading-none">{iconToEmoji(data?.forecastTomorrow?.icon)}</div>
              <div className="text-[22px] font-bold tracking-[-1px] text-[var(--agri-text)]">
                {formatNumber(data?.forecastTomorrow?.tempMin, 0)}°/{formatNumber(data?.forecastTomorrow?.tempMax, 0)}°
              </div>
            </div>

            <div className="mt-2 text-sm text-[var(--agri-text-muted)]">Precipitații {formatPercent(data?.forecastTomorrow?.pop)}%</div>

            <div
              className={cn(
                'mt-4 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold',
                verdictClasses(tomorrowVerdict.tone)
              )}
            >
              {tomorrowVerdict.label}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-[var(--agri-text-muted)]">
        Date meteo:{' '}
        <Link href="https://openweathermap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          OpenWeather
        </Link>
      </div>
    </div>
  )
}
