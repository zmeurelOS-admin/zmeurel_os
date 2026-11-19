'use client'

import { useState } from 'react'

import { BigTextarea, Button, CalendarPanel, Notice, StepFormTitle, Tile, TileGroup, addDaysIso } from '@/components/kit'
import { getPrimaryParcelCrop, type ParcelCropRow } from '@/lib/parcele/crop-config'
import { getUnitateTipLabel } from '@/lib/parcele/unitate'
import type { Parcela } from '@/lib/supabase/queries/parcele'

import type { RecoltareKgChoiceKey } from './RecoltareKgStep'

/** Ce scrie în antetul formularului cât e deschisă o alegere. */
export const RECOLTARE_CHOICE_LABEL: Record<RecoltareKgChoiceKey, string> = {
  data: 'Data',
  parcela: 'Parcela',
  cultura: 'Cultura',
  nota: 'Notă',
}

export interface RecoltareKgChoiceProps {
  choice: RecoltareKgChoiceKey
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
              {props.parcele.map((parcela) => (
                <Tile
                  key={parcela.id}
                  value={parcela.id}
                  title={parcela.nume_parcela?.trim() || 'Parcelă fără nume'}
                  subtitle={parcelaSubtitle(parcela)}
                  onClick={() => props.onParcela(parcela.id)}
                />
              ))}
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
