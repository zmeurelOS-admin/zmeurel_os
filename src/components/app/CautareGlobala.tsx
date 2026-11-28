'use client'

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { EVENIMENT_CAUTARE, kitFocus, kitText } from '@/components/kit'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  cautaGlobal,
  grupuriPermise,
  paginiCautare,
  type ElementCautare,
  type GrupCautare,
  type RezultatCautare,
} from '@/lib/cautare/globala'
import { comandaClientName } from '@/lib/comenzi/display'
import { formatKg, shortDateRo } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { useEsteDesktop } from '@/lib/ui/useEsteDesktop'
import { cn } from '@/lib/utils'

function esteCampDeText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Ctrl K / ⌘ K deschide căutarea (promptul 35, §2). Doar pe desktop, doar când pagina are focus și nu ești într-un
 * câmp de text (acolo scurtătura rămâne a câmpului / a browserului); altfel nu se oprește nimic.
 */
export function esteScurtaturaCautare(event: Pick<globalThis.KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'defaultPrevented' | 'target'>): boolean {
  if (event.defaultPrevented || event.altKey || event.shiftKey) return false
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return false
  if (esteCampDeText(event.target)) return false
  return typeof document === 'undefined' || document.hasFocus()
}

/** Fereastra căutării globale; montată o dată, în carcasa aplicației. Pe telefon nu se înregistrează nimic. */
export function CautareGlobala() {
  const esteDesktop = useEsteDesktop()
  const [deschis, setDeschis] = useState(false)

  useEffect(() => {
    if (!esteDesktop) return
    const deschide = () => setDeschis(true)
    const tasta = (event: globalThis.KeyboardEvent) => {
      if (!esteScurtaturaCautare(event)) return
      event.preventDefault()
      setDeschis(true)
    }
    window.addEventListener(EVENIMENT_CAUTARE, deschide)
    window.addEventListener('keydown', tasta)
    return () => {
      window.removeEventListener(EVENIMENT_CAUTARE, deschide)
      window.removeEventListener('keydown', tasta)
    }
  }, [esteDesktop])

  if (!esteDesktop) return null
  return <FereastraCautare deschis={deschis} onDeschis={setDeschis} />
}

function FereastraCautare({ deschis, onDeschis }: { deschis: boolean; onDeschis: (deschis: boolean) => void }) {
  const router = useRouter()
  const baza = useId()
  const { memberRole, memberAccess, isSuperAdmin, associationRole } = useDashboardAuth()
  const ctx = useMemo(() => ({ memberRole, memberAccess, isSuperAdmin, associationRole }), [associationRole, isSuperAdmin, memberAccess, memberRole])
  const permise = useMemo(() => grupuriPermise(ctx), [ctx])
  const [intrebare, setIntrebare] = useState('')
  const [activ, setActiv] = useState(0)

  // Aceleași chei ca în module: ce e deja încărcat nu se mai cere. Grupurile interzise nu pornesc deloc.
  const comenziQuery = useQuery({ queryKey: queryKeys.comenzi, queryFn: getComenzi, enabled: deschis && permise.comenzi })
  const clientiQuery = useQuery({ queryKey: queryKeys.clienti, queryFn: getClienți, enabled: deschis && (permise.clienti || permise.comenzi) })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, enabled: deschis && permise.parcele })
  const culegatoriQuery = useQuery({ queryKey: queryKeys.culegatori, queryFn: getCulegatori, enabled: deschis && permise.culegatori })

  const surse = useMemo<Partial<Record<GrupCautare, ElementCautare[]>>>(() => {
    const clienti = clientiQuery.data ?? []
    const clientMap = new Map(clienti.map((client) => [client.id, client]))
    return {
      pagini: paginiCautare(ctx),
      comenzi: (comenziQuery.data ?? [])
        .filter((comanda) => comanda.status !== 'anulata')
        .map((comanda) => {
          const nume = comandaClientName(comanda, clientMap)
          return {
            id: comanda.id,
            titlu: nume,
            detaliu: [formatKg(comanda.cantitate_kg), comanda.data_livrare ? shortDateRo(comanda.data_livrare) : 'Fără dată', comanda.locatie_livrare?.trim()]
              .filter(Boolean)
              .join(' · '),
            href: `/comenzi?id=${comanda.id}`,
            texte: [nume, comanda.locatie_livrare],
            telefoane: [comanda.telefon, comanda.client_id ? clientMap.get(comanda.client_id)?.telefon : null],
          }
        }),
      clienti: permise.clienti
        ? clienti.map((client) => ({
            id: client.id,
            titlu: client.nume_client,
            detaliu: [client.telefon, client.adresa].filter(Boolean).join(' · ') || undefined,
            href: `/clienti?id=${client.id}`,
            texte: [client.nume_client, client.adresa],
            telefoane: [client.telefon],
          }))
        : [],
      parcele: (parceleQuery.data ?? []).map((parcela) => ({
        id: parcela.id,
        titlu: parcela.nume_parcela?.trim() || 'Parcelă',
        detaliu: [parcela.cultura, parcela.soi].filter(Boolean).join(' · ') || undefined,
        href: `/parcele/${parcela.id}`,
        texte: [parcela.nume_parcela, parcela.cultura, parcela.soi, parcela.tip_fruct],
      })),
      culegatori: (culegatoriQuery.data ?? []).map((culegator) => ({
        id: culegator.id,
        titlu: culegator.nume_prenume,
        detaliu: culegator.telefon ?? undefined,
        href: `/culegatori?id=${culegator.id}`,
        texte: [culegator.nume_prenume],
        telefoane: [culegator.telefon],
      })),
    }
  }, [clientiQuery.data, comenziQuery.data, ctx, culegatoriQuery.data, parceleQuery.data, permise.clienti])

  const grupuri = useMemo(() => cautaGlobal(intrebare, surse, permise), [intrebare, permise, surse])
  const toate = useMemo(() => grupuri.flatMap((grup) => grup.rezultate), [grupuri])
  const activEfectiv = Math.min(activ, Math.max(0, toate.length - 1))
  const seIncarca = [comenziQuery, clientiQuery, parceleQuery, culegatoriQuery].some((query) => query.isFetching && !query.data)

  const schimbaDeschis = (next: boolean) => {
    if (!next) {
      setIntrebare('')
      setActiv(0)
    }
    onDeschis(next)
  }

  const deschide = (rezultat: RezultatCautare) => {
    schimbaDeschis(false)
    router.push(rezultat.href)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiv((index) => Math.min(toate.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiv((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      const rezultat = toate[activEfectiv]
      if (rezultat) {
        event.preventDefault()
        deschide(rezultat)
      }
    }
  }

  const idRezultat = (index: number) => `${baza}-r${index}`
  let index = -1

  return (
    <Dialog open={deschis} onOpenChange={schimbaDeschis}>
      <DialogContent
        showCloseButton={false}
        className="grid max-h-[min(80dvh,640px)] w-[min(96vw,640px)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-card border border-border bg-surface p-0 text-fg sm:max-w-none sm:p-0"
      >
        <DialogTitle className="sr-only">Caută în fermă</DialogTitle>
        <DialogDescription className="sr-only">Comenzi, clienți, parcele, culegători și paginile aplicației. Săgețile aleg, Enter deschide.</DialogDescription>
        <div className="flex items-center gap-2 border-b border-border-subtle px-4">
          <Search className="size-5 shrink-0 text-fg-muted" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded={toate.length > 0}
            aria-controls={`${baza}-lista`}
            aria-activedescendant={toate.length > 0 ? idRezultat(activEfectiv) : undefined}
            aria-label="Caută comandă, client, parcelă, culegător sau o pagină"
            placeholder="Caută comandă, client, parcelă, culegător…"
            value={intrebare}
            onChange={(event) => {
              setIntrebare(event.target.value)
              setActiv(0)
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            className={cn('h-touch-lg min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle', kitText.base)}
          />
          <kbd className={cn('shrink-0 rounded-control border border-border-subtle bg-surface-muted px-1.5 font-semibold text-fg-muted', kitText.helper)}>Esc</kbd>
        </div>
        <div id={`${baza}-lista`} role="listbox" aria-label="Rezultate" className="min-h-0 overflow-y-auto p-2">
          {!intrebare.trim() ? (
            <p className={cn('px-3 py-4 text-fg-muted', kitText.secondary)}>Scrie numele unui client, al unei parcele, un telefon sau o pagină („Magazia”).</p>
          ) : grupuri.length === 0 ? (
            <p className={cn('px-3 py-4 text-fg-muted', kitText.secondary)}>{seIncarca ? 'Se încarcă datele…' : `Nimic găsit pentru „${intrebare.trim()}”.`}</p>
          ) : (
            grupuri.map((grup) => (
              <div key={grup.grup} role="group" aria-label={grup.titlu} className="pb-2">
                <p className={cn('px-3 pb-1 pt-2 font-bold text-fg-subtle', kitText.helper)}>{grup.titlu}</p>
                {grup.rezultate.map((rezultat) => {
                  index += 1
                  const i = index
                  const ales = i === activEfectiv
                  return (
                    <div
                      key={`${grup.grup}-${rezultat.id}`}
                      id={idRezultat(i)}
                      role="option"
                      aria-selected={ales}
                      onMouseEnter={() => setActiv(i)}
                      onClick={() => deschide(rezultat)}
                      className={cn('cursor-pointer rounded-control px-3 py-2', ales ? 'bg-primary-soft' : 'hover:bg-surface-muted', kitFocus)}
                    >
                      <p className={cn('break-words font-semibold text-fg', kitText.secondary)}>{rezultat.titlu}</p>
                      {rezultat.detaliu ? <p className={cn('break-words text-fg-muted', kitText.helper)}>{rezultat.detaliu}</p> : null}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
