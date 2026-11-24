'use client'

import { useRouter } from 'next/navigation'
import { Banknote } from 'lucide-react'

import { ListRow } from '@/components/kit'
import { formatLei } from '@/lib/format-ro'
import { numarRo } from '@/lib/notifications/zilnice/common'
import { LINK_NEINCASATE_30, neincasatePeste30, textNeincasatePeste30, type ComandaPentruNeincasate } from '@/lib/notifications/zilnice/neincasate-30'

export interface NeincasatePeste30AcasaProps {
  comenzi: readonly ComandaPentruNeincasate[]
  /** Ziua de azi în București (`YYYY-MM-DD`); `null` până se știe. */
  azi: string | null
  /** Doar proprietarul vede banii. */
  proprietar: boolean
}

/**
 * Rândul din Acasă (promptul 33): „N comenzi neîncasate de peste 30 de zile · total X lei”, doar pentru proprietar și
 * doar dacă există; atins, deschide lista filtrată din Comenzi. Aceeași socoteală ca notificarea de dimineață.
 */
export function NeincasatePeste30Acasa({ comenzi, azi, proprietar }: NeincasatePeste30AcasaProps) {
  const router = useRouter()
  if (!proprietar || !azi) return null
  const rezultat = neincasatePeste30(comenzi, azi)
  if (rezultat.numar === 0) return null
  return (
    <ListRow
      avatar={false}
      leading={
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-text [&_svg]:size-5" aria-hidden>
          <Banknote />
        </span>
      }
      // Titlul stă pe un rând: numărul sus, totalul dedesubt; textul întreg pentru cititorul de ecran.
      title={`${numarRo(rezultat.numar, 'comandă neîncasată', 'comenzi neîncasate')} de peste 30 de zile`}
      detail={`Total ${formatLei(rezultat.lei)} · vezi lista în Comenzi`}
      aria-label={textNeincasatePeste30(rezultat)}
      onClick={() => router.push(LINK_NEINCASATE_30)}
    />
  )
}
