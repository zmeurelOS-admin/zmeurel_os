'use client'

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface VedereListaDetaliuProps<T> {
  elemente: readonly T[]
  /** Id-ul unui element (pus în adresă ca `?id=`). */
  cheie: (element: T) => string
  /** Elementul ales din adresă. Lipsă sau inexistent (șters, filtrat) = primul din listă. */
  idAles: string | null
  /** `push` = clic (intră în istoric), altfel săgeți (`replace`). */
  onAlege: (id: string, optiuni: { push: boolean }) => void
  /** Rândul din listă. Conținutul e text, nu butoane: rândul întreg e opțiunea. */
  randeazaRand: (element: T, ales: boolean) => ReactNode
  /** Fișa elementului ales, în dreapta. */
  randeazaFisa: (element: T) => ReactNode
  /** Numele listei pentru cititoarele de ecran (ex. „Comenzi”). */
  etichetaLista: string
  /** Sus în listă: filtrele (chip-uri) și căutarea din listă. */
  capLista?: ReactNode
  /** Lista e goală (după filtre). */
  gol?: ReactNode
  /** Ce stă în dreapta când lista e goală. */
  fisaGoala?: ReactNode
  className?: string
}

/** Elementul afișat în dreapta: cel din adresă, dacă e în listă; altfel primul. Pur, testat. */
export function elementAles<T>(elemente: readonly T[], cheie: (element: T) => string, idAles: string | null): T | null {
  if (idAles) {
    const gasit = elemente.find((element) => cheie(element) === idAles)
    if (gasit) return gasit
  }
  return elemente[0] ?? null
}

/**
 * Listă + detaliu pe desktop (promptul 35, §4): lista în stânga (380 px, derulare proprie, lipită sus), fișa
 * elementului ales în dreapta, fără schimbarea paginii. Se vede doar de la 1024 px (`hidden lg:grid`); pe telefon
 * modulul își păstrează lista și foaia de azi. Săgețile sus / jos mută selecția, Enter trece în fișă.
 */
export function VedereListaDetaliu<T>({
  elemente,
  cheie,
  idAles,
  onAlege,
  randeazaRand,
  randeazaFisa,
  etichetaLista,
  capLista,
  gol,
  fisaGoala,
  className,
}: VedereListaDetaliuProps<T>) {
  const baza = useId()
  const fisaRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const ales = elementAles(elemente, cheie, idAles)
  const idEfectiv = ales ? cheie(ales) : null
  const idOptiune = (id: string) => `${baza}-${id}`

  const muta = (pas: number) => {
    if (elemente.length === 0) return
    const curent = idEfectiv ? elemente.findIndex((element) => cheie(element) === idEfectiv) : -1
    const urmator = Math.min(elemente.length - 1, Math.max(0, curent + pas))
    const id = cheie(elemente[urmator])
    onAlege(id, { push: false })
    document.getElementById(idOptiune(id))?.scrollIntoView?.({ block: 'nearest' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      muta(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      muta(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      muta(-elemente.length)
    } else if (event.key === 'End') {
      event.preventDefault()
      muta(elemente.length)
    } else if (event.key === 'Enter' && ales) {
      event.preventDefault()
      fisaRef.current?.focus()
    }
  }

  return (
    <div className={cn('hidden gap-4 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]', className)}>
      <section
        aria-label={etichetaLista}
        className="sticky top-4 flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col self-start overflow-hidden rounded-box border border-border bg-surface"
      >
        {capLista ? <div className="shrink-0 space-y-2 border-b border-border-subtle p-3">{capLista}</div> : null}
        {elemente.length === 0 ? (
          <div className="p-4">{gol}</div>
        ) : (
          <div
            ref={listaRef}
            role="listbox"
            tabIndex={0}
            aria-label={etichetaLista}
            aria-activedescendant={idEfectiv ? idOptiune(idEfectiv) : undefined}
            onKeyDown={onKeyDown}
            className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5', kitFocus)}
          >
            {elemente.map((element) => {
              const id = cheie(element)
              const selectat = id === idEfectiv
              return (
                <div
                  key={id}
                  id={idOptiune(id)}
                  role="option"
                  aria-selected={selectat}
                  onClick={() => onAlege(id, { push: true })}
                  className={cn(
                    'cursor-pointer rounded-control px-3 py-2.5 text-fg transition-colors',
                    kitText.secondary,
                    selectat ? 'bg-primary-soft' : 'hover:bg-surface-muted',
                  )}
                >
                  {randeazaRand(element, selectat)}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div ref={fisaRef} tabIndex={-1} className="min-w-0 outline-none">
        {ales ? randeazaFisa(ales) : fisaGoala}
      </div>
    </div>
  )
}
