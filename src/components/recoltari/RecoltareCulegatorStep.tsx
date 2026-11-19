'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'

import { BigInput, Button, Notice, StepFormTitle, Tile, TileGroup, parseDecimal } from '@/components/kit'
import { queryKeys } from '@/lib/query-keys'
import { formatKg, splitWorkerName } from '@/lib/recoltari/day-view'
import { createCulegator, type Culegator } from '@/lib/supabase/queries/culegatori'

// ─── Pasul 1: alegerea culegătorului ───────────────────────────────────────────

export interface RecoltareCulegatorStepProps {
  /** Culegătorii activi, în ordinea afișării. */
  culegatori: readonly Culegator[]
  selectedId: string | null
  /** Kilogramele notate deja în ziua formularului, pe culegător. */
  kgByWorker: Readonly<Record<string, number>>
  /** Ziua formularului e azi (insigna spune „azi”). */
  isToday: boolean
  onPick: (culegatorId: string) => void
  onAddNew: () => void
}

/** Plăci mari, pe două coloane. Atingerea alege culegătorul și trece la kilograme. */
export function RecoltareCulegatorStep({
  culegatori,
  selectedId,
  kgByWorker,
  isToday,
  onPick,
  onAddNew,
}: RecoltareCulegatorStepProps) {
  return (
    <div className="space-y-4">
      <StepFormTitle>Cine a cules?</StepFormTitle>

      {culegatori.length === 0 ? (
        <Notice tone="info" title="Nu ai niciun culegător activ">
          Adaugă primul culegător ca să poți nota kilogramele.
        </Notice>
      ) : null}

      <TileGroup type="single" value={selectedId} onValueChange={() => undefined} aria-label="Culegător">
        {culegatori.map((culegator) => {
          const name = splitWorkerName(culegator.nume_prenume)
          const kg = kgByWorker[culegator.id] ?? 0
          return (
            <Tile
              key={culegator.id}
              value={culegator.id}
              leading={name.initial}
              title={name.first}
              subtitle={name.rest || undefined}
              badge={kg > 0 ? `✓ ${isToday ? 'azi ' : ''}${formatKg(kg)}` : undefined}
              // Și placa deja aleasă trebuie să ducă mai departe (încă o cântărire), de aceea `onClick`.
              onClick={() => onPick(culegator.id)}
            />
          )
        })}
        <Tile dashed leading={<UserPlus />} title="Culegător nou" onClick={onAddNew} />
      </TileGroup>
    </div>
  )
}

// ─── Culegător nou ─────────────────────────────────────────────────────────────

export interface RecoltareCulegatorNouProps {
  onCreated: (culegator: Culegator) => void
}

/** Nume + tarif; după salvare culegătorul e ales și formularul trece la kilograme. */
export function RecoltareCulegatorNou({ onCreated }: RecoltareCulegatorNouProps) {
  const queryClient = useQueryClient()
  const [nume, setNume] = useState('')
  const [tarif, setTarif] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const numeCurat = nume.trim().replace(/\s+/g, ' ')
  const tarifNumar = parseDecimal(tarif)
  const tarifValid = tarifNumar !== null && tarifNumar >= 0
  const canSave = numeCurat.length >= 2 && tarifValid

  const save = async () => {
    if (!canSave || tarifNumar === null || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const created = await createCulegator({ nume_prenume: numeCurat, tarif_lei_kg: tarifNumar })
      queryClient.setQueryData<Culegator[]>(queryKeys.culegatori, (previous) =>
        previous ? [created, ...previous.filter((item) => item.id !== created.id)] : previous,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      onCreated(created)
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Culegătorul nu s-a salvat.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <StepFormTitle>Culegător nou</StepFormTitle>
      <BigInput
        label="Nume și prenume"
        value={nume}
        onChange={(event) => setNume(event.target.value)}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={80}
      />
      <BigInput
        label="Tarif (lei pe kilogram)"
        value={tarif}
        onChange={(event) => setTarif(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="ex. 2,5"
        error={tarif.trim() !== '' && !tarifValid ? 'Scrie tariful cu cifre, de exemplu 2,5.' : undefined}
        hint="Cât primește pentru un kilogram cules."
      />
      {error ? (
        <Notice tone="danger" title="Culegătorul nu s-a salvat">
          {error}
        </Notice>
      ) : null}
      {/* Butonul stă sub câmpuri, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={!canSave} loading={saving}>
        {saving ? 'Se salvează…' : 'Salvează culegătorul'}
      </Button>
    </form>
  )
}
