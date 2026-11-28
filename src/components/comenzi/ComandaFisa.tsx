'use client'

import Link from 'next/link'

import { AntetFisa, SectiuneFisa, buttonVariants, kitText } from '@/components/kit'
import { clientPeScurt, istoricComanda, livrariAzi } from '@/lib/comenzi/tabel'
import { formatKg, formatLei, shortDateRo } from '@/lib/format-ro'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { cn } from '@/lib/utils'

import { useComandaFisa, VIEW_TITLE } from './useComandaFisa'

export interface ComandaFisaProps {
  comanda: Comanda
  /** Toate comenzile (clientul pe scurt, livrările de azi). */
  comenzi: readonly Comanda[]
  clientName: string
  numeClient: (comanda: Comanda) => string
  clientTelefon?: string | null
  todayIso: string
  canWrite: boolean
  canDelete: boolean
  hasPrioritara: boolean
  onEdit: (comanda: Comanda) => void
  /** Clic pe o livrare de azi: o deschide în fișă. */
  onAlege?: (id: string) => void
}

/**
 * Fișa comenzii în dreapta, pe desktop (promptul 35, §5). Același conținut ca foaia de pe telefon (`useComandaFisa`):
 * acțiunile sus, în dreapta; detaliile, istoricul, clientul pe scurt și livrările de azi în ordine.
 */
export function ComandaFisa({ comanda, comenzi, clientName, numeClient, clientTelefon, todayIso, canWrite, canDelete, hasPrioritara, onEdit, onAlege }: ComandaFisaProps) {
  const fisa = useComandaFisa({
    activ: true,
    inPanou: true,
    onClose: () => undefined,
    comanda,
    clientName,
    clientTelefon,
    todayIso,
    canWrite,
    canDelete,
    hasPrioritara,
    onEdit,
  })
  if (!fisa) return null

  const context = [comanda.telefon?.trim() || clientTelefon?.trim(), comanda.locatie_livrare?.trim() || 'Fără adresă'].filter(Boolean).join(' · ')
  const client = clientPeScurt(comenzi, comanda, todayIso)
  const traseu = livrariAzi(comenzi)

  if (fisa.view !== 'detalii') {
    return (
      <div className="space-y-4">
        <AntetFisa titlu={clientName} context={`${formatKg(comanda.cantitate_kg)} · ${context}`} />
        <SectiuneFisa titlu={VIEW_TITLE[fisa.view]} className="max-w-xl">
          {fisa.content}
        </SectiuneFisa>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AntetFisa titlu={clientName} context={context} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <SectiuneFisa>
            <div className="space-y-4">
              {fisa.info}
              {fisa.legaturiTelefon}
            </div>
          </SectiuneFisa>

          <SectiuneFisa titlu="Istoric">
            <ol className="space-y-2">
              {istoricComanda(comanda).map((pas) => (
                <li key={pas.eticheta} className={cn('flex flex-wrap justify-between gap-2 text-fg', kitText.secondary)}>
                  <span className="font-semibold">{pas.eticheta}</span>
                  <span className="text-fg-muted">{shortDateRo(pas.ziua)}</span>
                </li>
              ))}
            </ol>
          </SectiuneFisa>

          {client ? (
            <SectiuneFisa
              titlu="Clientul"
              dreapta={
                comanda.client_id ? (
                  <Link href={`/clienti?id=${comanda.client_id}`} className={buttonVariants({ variant: 'quiet', size: 'touch' })}>
                    Fișa clientului
                  </Link>
                ) : null
              }
            >
              <ul className={cn('space-y-1.5 text-fg', kitText.secondary)}>
                <li>
                  {client.comenziAn} {client.comenziAn === 1 ? 'comandă' : 'comenzi'} în {todayIso.slice(0, 4)} · {formatKg(client.kgAn)}
                </li>
                {client.ultima ? (
                  <li>
                    Ultima livrată: {client.ultima.data_livrare ? shortDateRo(client.ultima.data_livrare) : '—'} · {formatKg(client.ultima.cantitate_kg)}
                  </li>
                ) : null}
                {client.deIncasat > 0 ? <li className="font-semibold text-warning-text">De încasat: {formatLei(client.deIncasat)}</li> : null}
              </ul>
            </SectiuneFisa>
          ) : null}

          <SectiuneFisa
            titlu="Livrările de azi, în ordine"
            dreapta={
              <Link href="/livrari" className={buttonVariants({ variant: 'quiet', size: 'touch' })}>
                Livrări azi
              </Link>
            }
          >
            {traseu.length === 0 ? (
              <p className={cn('text-fg-muted', kitText.secondary)}>Nicio comandă în livrare azi.</p>
            ) : (
              <ol className="space-y-1">
                {traseu.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onAlege?.(item.id)}
                      className={cn(
                        'flex min-h-touch w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-control px-2 py-1.5 text-left text-fg hover:bg-surface-muted',
                        item.id === comanda.id && 'bg-primary-soft',
                        kitText.secondary,
                      )}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted font-bold">{index + 1}</span>
                      <span className="min-w-0 flex-1 break-words font-semibold">{numeClient(item)}</span>
                      <span className="text-fg-muted">{formatKg(item.cantitate_kg)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </SectiuneFisa>
        </div>

        {canWrite ? (
          <aside aria-label="Ce faci cu comanda" className="self-start rounded-box border border-border bg-surface p-4 xl:sticky xl:top-4">
            {fisa.butoane}
          </aside>
        ) : null}
      </div>
    </div>
  )
}
