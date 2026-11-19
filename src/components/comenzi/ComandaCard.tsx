'use client'

import { Flag, PhoneMissed, Store } from 'lucide-react'

import { ActionCard, StatusPill } from '@/components/kit'
import { localitateScurta } from '@/lib/comenzi/day-view'
import {
  comandaDayLabel,
  comandaDinMagazin,
  comandaKindLabel,
  comandaNota,
  comandaPlata,
  comandaStatus,
} from '@/lib/comenzi/display'
import { formatKg, formatLei } from '@/lib/format-ro'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

export interface ComandaCardProps {
  comanda: Comanda
  clientName: string
  todayIso: string
  /** Arată ziua livrării în rândul de sub nume (listele care amestecă zile). */
  showDay?: boolean
  onOpen: () => void
}

/** Cardul unei comenzi: client, localitate, kg, sumă, status, plată, steagul „Prioritară”. Atingerea deschide foaia ei. */
export function ComandaCard({ comanda, clientName, todayIso, showDay = false, onOpen }: ComandaCardProps) {
  const status = comandaStatus(comanda, todayIso)
  const plata = comandaPlata(comanda)
  const kind = comandaKindLabel(comanda)
  const nota = comandaNota(comanda)
  const localitate = localitateScurta(comanda.locatie_livrare)
  const meta = [showDay ? comandaDayLabel(comanda, todayIso) : null, localitate].filter(Boolean).join(' · ')

  return (
    <ActionCard
      title={<span className="line-clamp-2 break-words">{clientName}</span>}
      meta={meta || 'Fără adresă'}
      amount={formatKg(comanda.cantitate_kg)}
      amountLabel={kind ? kind : formatLei(comanda.total)}
      onOpen={onOpen}
      openLabel={`Deschide comanda: ${clientName}, ${formatKg(comanda.cantitate_kg)}, ${status.label}`}
      pills={
        <>
          {comanda.prioritara ? (
            <StatusPill tone="warning" icon={<Flag aria-hidden />}>
              Prioritară
            </StatusPill>
          ) : null}
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {plata ? <StatusPill tone={plata.tone}>{plata.label}</StatusPill> : null}
          {comandaDinMagazin(comanda) ? (
            <StatusPill tone="info" icon={<Store aria-hidden />}>
              Magazin
            </StatusPill>
          ) : null}
          {comanda.last_call_status === 'no_answer' ? (
            <StatusPill tone="warning" icon={<PhoneMissed aria-hidden />}>
              N-a răspuns
            </StatusPill>
          ) : null}
        </>
      }
      note={nota ? <span className="line-clamp-2">{nota}</span> : undefined}
    />
  )
}
