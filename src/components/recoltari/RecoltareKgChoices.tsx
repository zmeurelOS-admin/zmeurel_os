'use client'

import { useState } from 'react'

import { BigTextarea, Button, CalendarPanel, Notice, StepFormTitle, Tile, TileGroup, addDaysIso, kitText } from '@/components/kit'
import {
  MOTIV_RECOLTARE_PAUZA_TEXT,
  getPrimaryParcelCrop,
  type MotivRecoltarePauza,
  type ParcelCropRow,
} from '@/lib/parcele/crop-config'
import type { PauzaParcela } from '@/lib/tratamente/pauza'
import { subtitluPauza } from '@/lib/tratamente/texte'
import { ziCuDataRo, zileText, ziRelativaRo } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'
import { getUnitateTipLabel } from '@/lib/parcele/unitate'
import type { Parcela } from '@/lib/supabase/queries/parcele'

import type { RecoltareKgChoiceKey } from './RecoltareKgStep'

/** Ce scrie în antetul formularului cât e deschisă o alegere. */
export const RECOLTARE_CHOICE_LABEL: Record<RecoltareKgChoiceKey, string> = {
  data: 'Data',
  parcela: 'Parcela',
  cultura: 'Cultura',
  nota: 'Notă',
  tratament: 'Tratament',
}

export interface RecoltareKgChoiceProps {
  choice: RecoltareKgChoiceKey
  /** Trece la altă alegere (ex. din avertisment la parcelă) sau, cu `null`, înapoi la kilograme. */
  onChoice: (choice: RecoltareKgChoiceKey | null) => void
  /** Numele parcelei alese, pentru textul avertismentului. */
  parcelaLabel: string | null
  /** Pauza după tratament pe parcela aleasă, în ziua recoltării (sursa unică, `lib/tratamente/pauza`). */
  pauseWarning: PauzaParcela | null
  /** Pauzele tuturor parcelelor în ziua recoltării (se văd în lista de parcele). */
  pauze: ReadonlyMap<string, PauzaParcela>
  /** Motivul ales la „Recoltez totuși”. */
  motivPauza: MotivRecoltarePauza | null
  onMotivPauza: (motiv: MotivRecoltarePauza) => void
  todayIso: string
  date: string
  onDate: (iso: string) => void
  /** Parcelele, cu cele comerciale primele. */
  parcele: readonly Parcela[]
  parcelaId: string | null
  onParcela: (parcelaId: string) => void
  crops: readonly ParcelCropRow[]
  cropId: string | null
  onCrop: (cropId: string) => void
  note: string
  onNote: (note: string) => void
}

/**
 * Alegerile de la pasul de kilograme. Țin locul conținutului pasului (nu se deschid într-o foaie peste formular):
 * două ferestre suprapuse s-ar închide amândouă la „înapoi” pe Android.
 */
export function RecoltareKgChoice(props: RecoltareKgChoiceProps) {
  switch (props.choice) {
    case 'data':
      return (
        <div className="space-y-4">
          <StepFormTitle>Ce zi?</StepFormTitle>
          <CalendarPanel
            value={props.date}
            onChange={props.onDate}
            max={props.todayIso}
            shortcuts={[
              { label: 'Azi', value: props.todayIso },
              { label: 'Ieri', value: addDaysIso(props.todayIso, -1) },
              { label: 'Alaltăieri', value: addDaysIso(props.todayIso, -2) },
            ]}
          />
        </div>
      )

    case 'parcela':
      return (
        <div className="space-y-4">
          <StepFormTitle>Ce parcelă?</StepFormTitle>
          {props.parcele.length === 0 ? (
            <Notice tone="info" title="Nu ai nicio parcelă">
              Adaugă o parcelă în pagina Parcele, apoi revino.
            </Notice>
          ) : (
            <TileGroup type="single" value={props.parcelaId} onValueChange={() => undefined} aria-label="Parcelă">
              {props.parcele.map((parcela) => {
                const pauza = props.pauze.get(parcela.id)
                return (
                  <Tile
                    key={parcela.id}
                    value={parcela.id}
                    title={parcela.nume_parcela?.trim() || 'Parcelă fără nume'}
                    subtitle={
                      pauza ? (
                        <span className={cn('font-bold', props.parcelaId === parcela.id ? undefined : 'text-warning-text')}>
                          {subtitluPauza(pauza)}
                        </span>
                      ) : (
                        parcelaSubtitle(parcela)
                      )
                    }
                    className={pauza && props.parcelaId !== parcela.id ? 'border-warning-border' : undefined}
                    onClick={() => props.onParcela(parcela.id)}
                  />
                )
              })}
            </TileGroup>
          )}
        </div>
      )

    case 'cultura':
      return (
        <div className="space-y-4">
          <StepFormTitle>Ce ai recoltat?</StepFormTitle>
          <TileGroup type="single" value={props.cropId} onValueChange={() => undefined} aria-label="Cultură">
            {props.crops.map((crop) => (
              <Tile
                key={crop.id}
                value={crop.id}
                title={crop.culture || crop.variety || 'Cultură'}
                subtitle={crop.culture && crop.variety && crop.variety !== crop.culture ? crop.variety : undefined}
                onClick={() => props.onCrop(crop.id)}
              />
            ))}
          </TileGroup>
        </div>
      )

    case 'nota':
      return <NotaChoice note={props.note} onNote={props.onNote} />

    case 'tratament':
      return <PauzaChoice {...props} />
  }
}

/** „Zmeură · Delniwa”; când cultura și soiul au același text, o singură dată. */
export function cropText(crop: Pick<ParcelCropRow, 'culture' | 'variety'> | null | undefined): string {
  const parts = [crop?.culture?.trim(), crop?.variety?.trim()].filter((part): part is string => Boolean(part))
  return Array.from(new Set(parts)).join(' · ')
}

function parcelaSubtitle(parcela: Parcela): string {
  return cropText(getPrimaryParcelCrop(parcela)) || getUnitateTipLabel(parcela.tip_unitate)
}

const MOTIVE: MotivRecoltarePauza[] = ['consum_propriu', 'fructe_aruncate', 'altceva']

/**
 * Parcela aleasă e în pauză după tratament: doar avertizare, nu blocare. Acțiunea principală e „Alege altă
 * parcelă”; „Recoltez totuși” cere un motiv, care se salvează lângă recoltare.
 */
function PauzaChoice(props: RecoltareKgChoiceProps) {
  const [cuMotiv, setCuMotiv] = useState(props.motivPauza !== null)
  const pauza = props.pauseWarning
  if (!pauza) {
    return (
      <div className="space-y-4">
        <StepFormTitle>Tratament pe parcelă</StepFormTitle>
        <Notice tone="success" title="Parcela aleasă nu e în pauză" />
        <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => props.onChoice(null)}>
          Înapoi
        </Button>
      </div>
    )
  }

  const cand = ziRelativaRo(pauza.panaLa, props.date)
  return (
    <div className="space-y-4">
      <StepFormTitle>
        {props.parcelaLabel ?? 'Parcela'} e în pauză până {cand === 'Mâine' ? 'mâine' : ziCuDataRo(pauza.panaLa)}
      </StepFormTitle>
      <Notice tone="warning" title={`Nu recolta până ${ziCuDataRo(pauza.panaLa)}`}>
        Tratată {ziRelativaRo(pauza.ziAplicare, props.todayIso).toLocaleLowerCase('ro-RO')}
        {pauza.produs ? ` cu ${pauza.produs}` : ''} (pauză {zileText(pauza.zilePauza)}). Doar avertizare: poți recolta totuși,
        cu un motiv.
      </Notice>

      {cuMotiv ? (
        <div className="space-y-2">
          <p className={cn('font-bold text-fg', kitText.secondary)}>De ce recoltezi totuși? Se notează.</p>
          <TileGroup
            type="single"
            value={props.motivPauza}
            onValueChange={() => undefined}
            aria-label="Motivul recoltării în pauză"
            columns={2}
          >
            {MOTIVE.map((motiv) => (
              <Tile
                key={motiv}
                value={motiv}
                size="sm"
                title={MOTIV_RECOLTARE_PAUZA_TEXT[motiv]}
                onClick={() => props.onMotivPauza(motiv)}
              />
            ))}
          </TileGroup>
          <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => props.onChoice('parcela')}>
            Alege altă parcelă
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => props.onChoice('parcela')}>
            Alege altă parcelă
          </Button>
          <Button type="button" variant="quiet" size="touch" className="w-full text-warning-text" onClick={() => setCuMotiv(true)}>
            Recoltez totuși
          </Button>
        </div>
      )}
    </div>
  )
}

function NotaChoice({ note, onNote }: { note: string; onNote: (note: string) => void }) {
  const [text, setText] = useState(note)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onNote(text.trim())
      }}
    >
      <StepFormTitle>Adaugă o notă</StepFormTitle>
      <BigTextarea
        label="Notă (opțional)"
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={500}
        placeholder="ex. fructe ude, după ploaie"
      />
      {/* Sub câmp, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full">
        Gata
      </Button>
    </form>
  )
}
