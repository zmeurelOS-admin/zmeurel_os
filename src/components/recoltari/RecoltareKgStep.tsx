'use client'

import { useEffect, useRef } from 'react'
import { CalendarDays, MapPin, NotebookPen, Plus, Sprout } from 'lucide-react'

import { Button, KgField, Notice, StatusPill, StepFormTitle, kitText } from '@/components/kit'
import { formatLei, formatTarif } from '@/lib/recoltari/day-view'
import { cn } from '@/lib/utils'

export type RecoltareKgChoiceKey = 'data' | 'parcela' | 'cultura' | 'nota'

export interface RecoltareKgStepProps {
  workerName: string
  dateLabel: string
  /** `null` = nicio parcelă aleasă încă. */
  parcelaLabel: string | null
  /** Parcela are mai multe culturi: apare a treia pastilă, obligatorie. */
  showCrop: boolean
  cropLabel: string | null
  onOpenChoice: (choice: RecoltareKgChoiceKey) => void

  cal1: string
  cal2: string
  active: 'cal1' | 'cal2'
  onActivate: (field: 'cal1' | 'cal2') => void
  withCal2: boolean
  onAddCal2: () => void
  /** Cantitatea a venit din chat, nu a fost tastată: se marchează până la prima tastă. */
  kgFromChat: boolean

  /** `null` = culegătorul nu are tarif. */
  tarifLeiKg: number | null
  paymentLei: number | null
  note: string
  /** Parcela are un tratament în perioada de pauză. Avertizează, nu blochează. */
  pauseWarning: { produs: string | null; permisDeLa: string } | null
  saveError: string | null
}

/** Pasul 2: data și parcela ca pastile, kilogramele tastate, plata recalculată pe loc. */
export function RecoltareKgStep({
  workerName,
  dateLabel,
  parcelaLabel,
  showCrop,
  cropLabel,
  onOpenChoice,
  cal1,
  cal2,
  active,
  onActivate,
  withCal2,
  onAddCal2,
  kgFromChat,
  tarifLeiKg,
  paymentLei,
  note,
  pauseWarning,
  saveError,
}: RecoltareKgStepProps) {
  const hasNote = note.trim() !== ''

  // Eroarea trebuie văzută și când conținutul pasului e derulat în jos.
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (saveError) errorRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [saveError])

  return (
    <div className="space-y-2">
      <StepFormTitle>
        <span className="block truncate">{workerName}</span>
      </StepFormTitle>

      {/* Sus, nu sub câmpuri: la 390×800 zona de sub plată e sub marginea ecranului. */}
      {saveError ? (
        <div ref={errorRef}>
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Pastila icon={<CalendarDays aria-hidden />} label="Data" value={dateLabel} onClick={() => onOpenChoice('data')} />
        <Pastila
          icon={<MapPin aria-hidden />}
          label="Parcela"
          value={parcelaLabel}
          placeholder="Alege parcela"
          onClick={() => onOpenChoice('parcela')}
        />
      </div>
      {showCrop ? (
        <Pastila
          icon={<Sprout aria-hidden />}
          label="Cultura"
          value={cropLabel}
          placeholder="Alege cultura"
          onClick={() => onOpenChoice('cultura')}
        />
      ) : null}

      {pauseWarning ? (
        // Două rânduri, ca să rămână câmpul de kg și plata pe ecran la 390×800.
        <Notice tone="warning" title={pauseWarning.produs ? `Tratament activ: ${pauseWarning.produs}` : 'Tratament activ pe parcelă'}>
          Recoltare permisă de la {pauseWarning.permisDeLa}.
        </Notice>
      ) : null}

      <KgField label="Calitatea 1" value={cal1} active={active === 'cal1'} onActivate={() => onActivate('cal1')} />
      {kgFromChat ? (
        <div className="flex justify-center">
          <StatusPill tone="info">Din chat — verifică</StatusPill>
        </div>
      ) : null}
      {withCal2 ? (
        <KgField
          size="md"
          label="Calitatea 2"
          value={cal2}
          active={active === 'cal2'}
          onActivate={() => onActivate('cal2')}
        />
      ) : null}

      {tarifLeiKg === null ? (
        <Notice tone="danger" title="Culegătorul nu are tarif">
          Completează tariful în pagina Culegători, apoi revino.
        </Notice>
      ) : (
        <p className={cn('flex items-baseline justify-between gap-3 px-1 text-fg-muted', kitText.secondary)}>
          <span>De plată ({formatTarif(tarifLeiKg)})</span>
          <span className={cn('font-extrabold text-fg', kitText.card)}>{formatLei(paymentLei ?? 0)}</span>
        </p>
      )}

      <div className={cn('grid gap-2', withCal2 ? 'grid-cols-1' : 'grid-cols-2')}>
        {withCal2 ? null : (
          <Button type="button" variant="quiet" size="touch" className="min-w-0 px-2" onClick={onAddCal2}>
            <Plus aria-hidden />
            <span className="truncate">Calitatea 2</span>
          </Button>
        )}
        <Button
          type="button"
          variant="quiet"
          size="touch"
          className="min-w-0 px-2"
          aria-label={hasNote ? `Notă: ${note.trim()}. Schimbă nota` : 'Adaugă o notă'}
          onClick={() => onOpenChoice('nota')}
        >
          <NotebookPen aria-hidden />
          <span className="truncate">{hasNote ? note.trim() : 'Notă'}</span>
        </Button>
      </div>
    </div>
  )
}

/** Pastilă schimbabilă: arată valoarea aleasă și deschide alegerea ei. */
function Pastila({
  icon,
  label,
  value,
  placeholder,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  placeholder?: string
  onClick: () => void
}) {
  const missing = !value
  return (
    <Button
      type="button"
      variant="neutral"
      size="touch"
      aria-label={missing ? `${label}: ${placeholder ?? 'nealeasă'}` : `${label}: ${value} — schimbă`}
      onClick={onClick}
      className={cn('min-w-0 justify-start px-3', missing && 'border-primary text-primary')}
    >
      {icon}
      <span className="truncate">{value ?? placeholder}</span>
    </Button>
  )
}
