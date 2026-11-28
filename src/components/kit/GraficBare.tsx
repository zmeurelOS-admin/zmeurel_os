'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export interface BaraGrafic {
  cheie: string
  /** Eticheta de sub bară (`S24`, `iun`) sau din stânga (orizontal: numele parcelei). */
  eticheta: string
  valoare: number
  /** A doua serie (anul trecut, cheltuielile); `null` = lipsește. */
  comparatie?: number | null
}

export interface GraficBareProps {
  bare: readonly BaraGrafic[]
  /** Ce arată graficul, pentru cititoarele de ecran („Recolta pe săptămâni, în kg”). */
  eticheta: string
  /** Valoarea scrisă (`1.240 kg`). */
  formatare: (valoare: number) => string
  /** Legenda seriilor (ex. `['2026', '2025']`). Fără a doua, se arată doar prima. */
  legenda?: readonly [string, string?]
  orientare?: 'verticala' | 'orizontala'
  /** Înălțimea zonei de bare la cea verticală (px). */
  inaltime?: number
  /** Culoarea seriei de comparație: estompată (anul trecut) sau a doua culoare (cheltuieli). */
  comparatieTon?: 'estompat' | 'alerta'
  className?: string
  /** Sub grafic (ex. o notă). */
  jos?: ReactNode
}

/**
 * Grafic cu bare (promptul 35, §3 și §8), desenat în HTML, fără bibliotecă. Pentru cititoarele de ecran: o descriere
 * și un tabel ascuns cu toate valorile.
 */
export function GraficBare({
  bare,
  eticheta,
  formatare,
  legenda,
  orientare = 'verticala',
  inaltime = 180,
  comparatieTon = 'estompat',
  className,
  jos,
}: GraficBareProps) {
  const cuComparatie = bare.some((bara) => bara.comparatie !== null && bara.comparatie !== undefined)
  const max = Math.max(1, ...bare.flatMap((bara) => [bara.valoare, bara.comparatie ?? 0]))
  const procent = (valoare: number) => `${Math.max(0, Math.min(100, (valoare / max) * 100))}%`
  const culoareComparatie = comparatieTon === 'alerta' ? 'bg-warning-text/70' : 'bg-border-strong'

  const tabel = (
    <table className="sr-only">
      <caption>{eticheta}</caption>
      <thead>
        <tr>
          <th scope="col">—</th>
          <th scope="col">{legenda?.[0] ?? 'Valoare'}</th>
          {cuComparatie ? <th scope="col">{legenda?.[1] ?? 'Comparație'}</th> : null}
        </tr>
      </thead>
      <tbody>
        {bare.map((bara) => (
          <tr key={bara.cheie}>
            <th scope="row">{bara.eticheta}</th>
            <td>{formatare(bara.valoare)}</td>
            {cuComparatie ? <td>{bara.comparatie === null || bara.comparatie === undefined ? '—' : formatare(bara.comparatie)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const legendaJsx = legenda ? (
    <div className={cn('flex flex-wrap items-center gap-3 text-fg-muted', kitText.helper)} aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-primary" />
        {legenda[0]}
      </span>
      {cuComparatie && legenda[1] ? (
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm', culoareComparatie)} />
          {legenda[1]}
        </span>
      ) : null}
    </div>
  ) : null

  if (orientare === 'orizontala') {
    return (
      <div className={cn('space-y-2', className)}>
        {legendaJsx}
        <ul className="space-y-2.5" aria-hidden>
          {bare.map((bara) => (
            <li key={bara.cheie} className="space-y-1">
              <div className={cn('flex flex-wrap items-baseline justify-between gap-2 text-fg', kitText.secondary)}>
                <span className="min-w-0 break-words font-semibold">{bara.eticheta}</span>
                <span className="shrink-0 font-bold tabular-nums">{formatare(bara.valoare)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: procent(bara.valoare) }} />
              </div>
            </li>
          ))}
        </ul>
        {tabel}
        {jos}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {legendaJsx}
      <div role="img" aria-label={eticheta} className="flex items-end gap-1" style={{ height: inaltime }}>
        {bare.map((bara) => (
          <div key={bara.cheie} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={`${bara.eticheta}: ${formatare(bara.valoare)}`}>
            <div className="w-full max-w-7 rounded-t-[4px] bg-primary" style={{ height: procent(bara.valoare) }} />
            {cuComparatie ? <div className={cn('w-full max-w-7 rounded-t-[4px]', culoareComparatie)} style={{ height: procent(bara.comparatie ?? 0) }} /> : null}
          </div>
        ))}
      </div>
      <div className="flex gap-1" aria-hidden>
        {bare.map((bara, index) => (
          <span key={bara.cheie} className={cn('min-w-0 flex-1 text-center text-fg-muted', kitText.helper)}>
            {/* Multe bare: eticheta din două în două, ca să nu se suprapună. */}
            {bare.length > 16 && index % 2 === 1 ? '' : bara.eticheta}
          </span>
        ))}
      </div>
      {tabel}
      {jos}
    </div>
  )
}
