'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  Button,
  CalendarPanel,
  KgField,
  Notice,
  StepFormTitle,
  SummaryList,
  SummaryRow,
  Tile,
  TileGroup,
  ToggleRow,
  addDaysIso,
  kitText,
  parseDecimal,
} from '@/components/kit'
import { CANTITATI_KG } from '@/lib/comenzi/day-view'
import { formatKg, formatLei, formatLeiKg, formatNumber, weekdayDateRo } from '@/lib/format-ro'
import type { ComandaOrderKind } from '@/lib/supabase/queries/comenzi'
import { cn } from '@/lib/utils'
import { PRET_SE_INCARCA } from '@/lib/pret-standard'

export type ComandaChoiceKey = 'cantitate' | 'data' | 'adresa' | 'pret' | 'nota'

export const COMANDA_CHOICE_LABEL: Record<ComandaChoiceKey, string> = {
  cantitate: 'Cantitate',
  data: 'Data livrării',
  adresa: 'Adresă',
  pret: 'Preț',
  nota: 'Notă',
}

/** `undefined` = nimic ales încă; `null` = „Fără dată”. */
export type ComandaDateValue = string | null | undefined

const QTY_OTHER = 'alta'
const DATE_OTHER = 'alta-zi'
const DATE_NONE = 'fara-data'

function SectionLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className={cn('px-1 font-bold text-fg-muted', kitText.secondary)}>
      {children}
    </h3>
  )
}

// ─── Pasul 2: detaliile ────────────────────────────────────────────────────────

export interface ComandaDetaliiStepProps {
  clientName: string
  todayIso: string
  /** `null` = nimic ales. */
  cantitateKg: number | null
  onCantitate: (kg: number) => void
  date: ComandaDateValue
  onDate: (date: string | null) => void
  adresa: string
  pretLeiKg: number
  /** Prețul standard încă nu a venit din Setări: se arată un schelet, nu prețul de rezervă. */
  pretSeIncarca?: boolean
  /** De unde vine prețul afișat. */
  pretSursa: 'negociat' | 'standard' | 'manual'
  orderKind: ComandaOrderKind
  nota: string
  /** `null` = comutatorul nu apare (coloana lipsește). */
  prioritara: boolean | null
  onPrioritara: (value: boolean) => void
  onOpenChoice: (choice: ComandaChoiceKey) => void
  saveError: string | null
}

/** Cantitatea pe plăci (nimic preselectat), ziua livrării, adresa, prețul, nota și „Prioritară”. */
export function ComandaDetaliiStep({
  clientName,
  todayIso,
  cantitateKg,
  onCantitate,
  date,
  onDate,
  adresa,
  pretLeiKg,
  pretSeIncarca = false,
  pretSursa,
  orderKind,
  nota,
  prioritara,
  onPrioritara,
  onOpenChoice,
  saveError,
}: ComandaDetaliiStepProps) {
  // Eroarea trebuie văzută și când conținutul pasului e derulat în jos.
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (saveError) errorRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [saveError])

  const presetQty = cantitateKg !== null && (CANTITATI_KG as readonly number[]).includes(cantitateKg)
  const qtyValue = cantitateKg === null ? null : presetQty ? String(cantitateKg) : QTY_OTHER

  const maine = addDaysIso(todayIso, 1)
  const poimaine = addDaysIso(todayIso, 2)
  const presetDate = date === todayIso || date === maine || date === poimaine
  const dateValue = date === undefined ? null : date === null ? DATE_NONE : presetDate ? date : DATE_OTHER

  const zeroPrice = orderKind !== 'manual'
  const total = cantitateKg !== null && !zeroPrice && !pretSeIncarca ? cantitateKg * pretLeiKg : null
  const pretText = pretSeIncarca
    ? PRET_SE_INCARCA
    : zeroPrice
    ? orderKind === 'cadou'
      ? 'Cadou · 0 lei'
      : 'Consum propriu · 0 lei'
    : // Scurt, ca să încapă lângă total la 390 px.
      `${formatLeiKg(pretLeiKg)}${pretSursa === 'negociat' ? ' · negociat' : pretSursa === 'standard' ? ' · standard' : ''}`

  return (
    <div className="space-y-3">
      <StepFormTitle>
        <span className="block truncate">{clientName}</span>
      </StepFormTitle>

      {saveError ? (
        <div ref={errorRef}>
          <Notice tone="danger" title="Comanda nu s-a salvat">
            {saveError}
          </Notice>
        </div>
      ) : null}

      <section className="space-y-2">
        <SectionLabel id="comanda-cantitate">Câte kilograme?</SectionLabel>
        <TileGroup
          type="single"
          columns={4}
          value={qtyValue}
          onValueChange={() => undefined}
          aria-labelledby="comanda-cantitate"
        >
          {CANTITATI_KG.map((kg) => (
            <Tile key={kg} size="sm" value={String(kg)} title={`${kg} kg`} onClick={() => onCantitate(kg)} />
          ))}
          <Tile
            size="sm"
            value={QTY_OTHER}
            dashed={qtyValue !== QTY_OTHER}
            title={qtyValue === QTY_OTHER && cantitateKg !== null ? formatKg(cantitateKg) : 'Alta'}
            aria-label={
              qtyValue === QTY_OTHER && cantitateKg !== null ? `Altă cantitate: ${formatKg(cantitateKg)}. Schimbă` : 'Altă cantitate'
            }
            onClick={() => onOpenChoice('cantitate')}
          />
        </TileGroup>
      </section>

      <section className="space-y-2">
        <SectionLabel id="comanda-data">Când livrezi?</SectionLabel>
        <TileGroup type="single" columns={3} value={dateValue} onValueChange={() => undefined} aria-labelledby="comanda-data">
          <Tile size="sm" value={todayIso} title="Azi" onClick={() => onDate(todayIso)} />
          <Tile size="sm" value={maine} title="Mâine" onClick={() => onDate(maine)} />
          <Tile size="sm" value={poimaine} title="Poimâine" onClick={() => onDate(poimaine)} />
          <Tile
            size="sm"
            value={DATE_OTHER}
            title={dateValue === DATE_OTHER && date ? weekdayDateRo(date) : 'Altă zi'}
            aria-label={dateValue === DATE_OTHER && date ? `Altă zi: ${weekdayDateRo(date)}. Schimbă` : 'Altă zi'}
            onClick={() => onOpenChoice('data')}
          />
          <Tile size="sm" value={DATE_NONE} title="Fără dată" className="col-span-2" onClick={() => onDate(null)} />
        </TileGroup>
      </section>

      <SummaryList>
        <SummaryRow
          label="Adresă de livrare"
          value={adresa.trim() || 'Fără adresă'}
          onChange={() => onOpenChoice('adresa')}
          changeLabel={adresa.trim() ? 'Schimbă' : 'Adaugă'}
        />
        <SummaryRow
          label="Preț"
          value={pretText}
          amount={total !== null ? formatLei(total) : undefined}
          onChange={() => onOpenChoice('pret')}
        />
        <SummaryRow
          label="Notă pentru livrare"
          value={nota.trim() || 'Fără notă'}
          onChange={() => onOpenChoice('nota')}
          changeLabel={nota.trim() ? 'Schimbă' : 'Adaugă'}
        />
      </SummaryList>

      {prioritara !== null ? (
        <ToggleRow
          tone="warning"
          icon={<Flag />}
          title="Prioritară"
          subtitle={date ? 'Prima în listă și la „Pune în livrare azi”.' : 'Alege întâi ziua livrării.'}
          checked={prioritara && Boolean(date)}
          disabled={!date}
          onCheckedChange={onPrioritara}
        />
      ) : null}
    </div>
  )
}

// ─── Alegerile pasului (țin locul conținutului, nu se deschid peste formular) ──

export interface ComandaChoiceProps {
  choice: Exclude<ComandaChoiceKey, 'cantitate'>
  todayIso: string
  date: ComandaDateValue
  onDate: (date: string) => void
  adresa: string
  /** Adresa din fișa clientului, dacă diferă de cea scrisă pe comandă. */
  adresaClient: string | null
  onAdresa: (adresa: string) => void
  pretLeiKg: number
  pretStandard: number
  pretNegociat: number | null
  orderKind: ComandaOrderKind
  onPret: (value: { pret: number; orderKind: ComandaOrderKind }) => void
  nota: string
  onNota: (nota: string) => void
}

export function ComandaChoice(props: ComandaChoiceProps) {
  switch (props.choice) {
    case 'data':
      return (
        <div className="space-y-4">
          <StepFormTitle>În ce zi livrezi?</StepFormTitle>
          <CalendarPanel value={props.date ?? null} onChange={props.onDate} min={props.todayIso} />
        </div>
      )
    case 'adresa':
      return (
        <TextChoice
          title="Unde livrezi?"
          label="Adresă de livrare"
          placeholder="ex. Str. Vișinilor 10, Burdujeni"
          initial={props.adresa}
          suggestion={
            props.adresaClient && props.adresaClient.trim() !== props.adresa.trim()
              ? { label: 'Adresa din fișa clientului', value: props.adresaClient.trim() }
              : null
          }
          onDone={props.onAdresa}
        />
      )
    case 'nota':
      return (
        <TextChoice
          title="Notă pentru livrare"
          label="Notă (opțional)"
          placeholder="ex. sună înainte, lasă la poartă"
          initial={props.nota}
          suggestion={null}
          onDone={props.onNota}
        />
      )
    case 'pret':
      return <PretChoice {...props} />
  }
}

function TextChoice({
  title,
  label,
  placeholder,
  initial,
  suggestion,
  onDone,
}: {
  title: string
  label: string
  placeholder: string
  initial: string
  suggestion: { label: string; value: string } | null
  onDone: (text: string) => void
}) {
  const [text, setText] = useState(initial)
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(text.trim())
      }}
    >
      <StepFormTitle>{title}</StepFormTitle>
      <BigTextarea
        label={label}
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={500}
        placeholder={placeholder}
      />
      {suggestion ? (
        <Button type="button" variant="neutral" size="touch" className="h-auto min-h-touch w-full justify-start whitespace-normal py-2 text-left" onClick={() => setText(suggestion.value)}>
          <span className="flex min-w-0 flex-col">
            <span className={cn('font-medium text-fg-muted', kitText.helper)}>{suggestion.label}</span>
            <span className="break-words">{suggestion.value}</span>
          </span>
        </Button>
      ) : null}
      {/* Sub câmp, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full">
        Gata
      </Button>
    </form>
  )
}

function PretChoice({ pretLeiKg, pretStandard, pretNegociat, orderKind, onPret }: ComandaChoiceProps) {
  const [text, setText] = useState(orderKind === 'manual' ? formatNumber(pretLeiKg) : '')
  const [kind, setKind] = useState<ComandaOrderKind>(orderKind)
  const parsed = parseDecimal(text)
  const valid = kind !== 'manual' || (parsed !== null && parsed > 0)

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        onPret({ pret: kind === 'manual' ? (parsed ?? 0) : 0, orderKind: kind })
      }}
    >
      <StepFormTitle>Cu ce preț?</StepFormTitle>

      <TileGroup
        type="single"
        columns={3}
        value={kind}
        onValueChange={(value) => setKind((value as ComandaOrderKind | null) ?? 'manual')}
        aria-label="Felul comenzii"
      >
        <Tile size="sm" value="manual" title="Vânzare" />
        <Tile size="sm" value="cadou" title="Cadou" />
        <Tile size="sm" value="consum_propriu" title="Consum" subtitle="propriu" />
      </TileGroup>

      {kind === 'manual' ? (
        <>
          <BigInput
            label="Preț (lei pe kilogram)"
            value={text}
            onChange={(event) => setText(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            trailing={<span className={cn('font-bold text-fg-muted', kitText.secondary)}>lei/kg</span>}
            error={text.trim() !== '' && !valid ? 'Scrie prețul cu cifre, de exemplu 35.' : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="neutral" size="touch" onClick={() => setText(formatNumber(pretStandard))}>
              Standard: {formatLeiKg(pretStandard)}
            </Button>
            {pretNegociat !== null ? (
              <Button type="button" variant="neutral" size="touch" onClick={() => setText(formatNumber(pretNegociat))}>
                Negociat: {formatLeiKg(pretNegociat)}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <Notice tone="info" title={kind === 'cadou' ? 'Cadou: fără bani' : 'Consum propriu: fără bani'}>
          {kind === 'cadou'
            ? 'Comanda se livrează ca oricare alta, cu 0 lei.'
            : 'Kilogramele se scad din stoc imediat ce salvezi, fără livrare.'}
        </Notice>
      )}

      <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={!valid}>
        Gata
      </Button>
    </form>
  )
}

// ─── Altă cantitate: câmp de kg + tastatura din aplicație (în `dock`) ──────────

export function ComandaCantitateChoice({ value, active }: { value: string; active: boolean }) {
  return (
    <div className="space-y-4">
      <StepFormTitle>Câte kilograme?</StepFormTitle>
      <KgField label="Cantitate" value={value} active={active} onActivate={() => undefined} />
    </div>
  )
}
