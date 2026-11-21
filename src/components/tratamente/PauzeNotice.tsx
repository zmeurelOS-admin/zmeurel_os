'use client'

import { TriangleAlert } from 'lucide-react'

import { Notice } from '@/components/kit'
import type { PauzaParcela } from '@/lib/tratamente/pauza'
import { detaliuPauza, titluPauza } from '@/lib/tratamente/texte'
import { ziCuDataRo } from '@/lib/tratamente/zile'

/**
 * Pauzele active: una singură → avertismentul mare („Maravilla: nu recolta până vineri 18.07”); mai multe →
 * un singur avertisment, cu câte un rând pe parcelă (ca ecranul să nu se umple de casete).
 */
export function PauzeNotice({
  pauze,
  azi,
}: {
  pauze: ReadonlyArray<PauzaParcela & { nume: string }>
  azi: string
}) {
  if (pauze.length === 0) return null
  if (pauze.length === 1) {
    const [pauza] = pauze
    return (
      <Notice tone="warning" icon={<TriangleAlert aria-hidden />} title={titluPauza(pauza.nume, pauza)}>
        {detaliuPauza(pauza, azi)}
      </Notice>
    )
  }
  return (
    <Notice tone="warning" icon={<TriangleAlert aria-hidden />} title={`${pauze.length} parcele în pauză: nu recolta din ele`}>
      <ul className="space-y-0.5">
        {pauze.map((pauza) => (
          <li key={pauza.parcelaId}>
            <span className="font-bold">{pauza.nume}</span>: până {ziCuDataRo(pauza.panaLa)}
            {pauza.produs ? ` · ${pauza.produs}` : ''}
          </li>
        ))}
      </ul>
    </Notice>
  )
}
