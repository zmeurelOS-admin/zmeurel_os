'use client'

import Link from 'next/link'
import { CloudRain, MapPin, Snowflake, Wind } from 'lucide-react'

import { Notice, kitFocus, kitText } from '@/components/kit'
import { avertizariPrognoza, numeZiScurt, textTemperaturi, type ZiPrognoza } from '@/lib/dashboard/prognoza'
import { cn } from '@/lib/utils'

/**
 * Următoarele 3 zile, compact, sub ziua de azi (promptul 33): min / max, ploaia în mm, vântul în km/h, plus
 * avertizarea de îngheț (min ≤ 0 °C) și de ploaie mare (≥ 20 mm). Fără zile (serviciul n-a răspuns, cache vechi),
 * nu se arată nimic.
 */
export function PrognozaZile({ zile, azi, className }: { zile: readonly ZiPrognoza[]; azi: string; className?: string }) {
  if (zile.length === 0) return null
  const avertizari = avertizariPrognoza(zile, azi)
  return (
    <div className={cn('space-y-2', className)}>
      <ul aria-label="Următoarele zile" className="grid grid-cols-3 gap-2">
        {zile.map((zi) => (
          <li key={zi.zi} className="flex min-w-0 flex-col gap-0.5 rounded-box border border-border bg-surface px-2.5 py-2">
            <span className={cn('truncate font-bold text-fg', kitText.helper)}>{numeZiScurt(zi.zi, azi)}</span>
            <span className={cn('font-extrabold tabular-nums text-fg', kitText.secondary)}>{textTemperaturi(zi)}</span>
            <span className={cn('flex items-center gap-1 tabular-nums text-fg-muted [&_svg]:size-3.5', kitText.helper)}>
              <CloudRain aria-hidden />
              {zi.ploaieMm === null ? '—' : `${Math.round(zi.ploaieMm)} mm`}
            </span>
            <span className={cn('flex items-center gap-1 tabular-nums text-fg-muted [&_svg]:size-3.5', kitText.helper)}>
              <Wind aria-hidden />
              {zi.vantMaxKmh === null ? '—' : `${Math.round(zi.vantMaxKmh)} km/h`}
            </span>
          </li>
        ))}
      </ul>
      {avertizari.map((avertizare) => (
        <Notice
          key={avertizare.tip}
          tone="warning"
          icon={avertizare.tip === 'inghet' ? <Snowflake aria-hidden /> : <CloudRain aria-hidden />}
          title={avertizare.text}
        />
      ))}
    </div>
  )
}

/** Rândul „Pune locul fermei ca să vezi vremea ta” → Setări › Ferma (fără geolocalizare automată). */
export function PuneLoculFermei({ className }: { className?: string }) {
  return (
    <Link
      href="/settings/ferma"
      className={cn(
        'flex min-h-touch items-center gap-3 rounded-box border border-border bg-surface px-3 py-2 text-fg active:bg-surface-muted',
        kitFocus,
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted [&_svg]:size-4" aria-hidden>
        <MapPin />
      </span>
      <span className={cn('min-w-0 flex-1 font-semibold', kitText.secondary)}>Pune locul fermei ca să vezi vremea ta</span>
    </Link>
  )
}
