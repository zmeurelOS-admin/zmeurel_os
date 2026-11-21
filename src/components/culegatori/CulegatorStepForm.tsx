'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { NotebookPen } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  Button,
  Notice,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  kitText,
  parseDecimal,
  useStepForm,
} from '@/components/kit'
import { TIPURI_ANGAJARE, normalizeTipAngajare, type TipAngajare } from '@/lib/culegatori/view'
import { formatNumber } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { createCulegator, updateCulegator, type Culegator } from '@/lib/supabase/queries/culegatori'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface CulegatorStepFormProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  /** Culegătorul editat; fără el, formularul creează unul nou. */
  editing?: Culegator | null
}

const STEPS = ['culegator'] as const

interface Draft {
  nume: string
  telefon: string
  tarif: string
  tip: TipAngajare
  nota: string
  showNota: boolean
}

function draftFrom(editing: Culegator | null): Draft {
  return {
    nume: editing?.nume_prenume ?? '',
    telefon: editing?.telefon ?? '',
    tarif: editing && Number.isFinite(Number(editing.tarif_lei_kg)) ? formatNumber(Number(editing.tarif_lei_kg)) : '',
    tip: normalizeTipAngajare(editing?.tip_angajare),
    nota: editing?.observatii ?? '',
    showNota: Boolean(editing?.observatii?.trim()),
  }
}

/**
 * Formularul unui culegător, același pentru nou și editare: nume, telefon, tarif, tip pe plăci, notă.
 * Data angajării nu mai e în formular; valoarea din baza de date rămâne neatinsă.
 */
export function CulegatorStepForm({ open, onOpenChange, editing = null }: CulegatorStepFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const mode = editing ? 'edit' : 'create'
  const form = useStepForm({ steps: STEPS, open, mode, analytics: { moduleName: 'culegatori' } })

  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing))
  const [initial, setInitial] = useState<Draft>(() => draftFrom(editing))
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Culegator | null>(null)
  const inFlight = useRef(false)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    const next = draftFrom(editing)
    setDraft(next)
    setInitial(next)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }))

  const numeCurat = draft.nume.trim().replace(/\s+/g, ' ')
  const tarifNumar = parseDecimal(draft.tarif)
  const tarifValid = tarifNumar !== null && tarifNumar >= 0
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const canSave = numeCurat.length >= 2 && tarifValid && !saving

  const save = async () => {
    if (!canSave || tarifNumar === null || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setSaveError(null)

    const input = {
      nume_prenume: numeCurat,
      tarif_lei_kg: tarifNumar,
      telefon: draft.telefon.trim(),
      tip_angajare: draft.tip,
      observatii: draft.nota.trim(),
    }

    try {
      // La editare, data angajării și statusul nu se trimit: rămân cum sunt în baza de date.
      const row = editing ? await updateCulegator(editing.id, input) : await createCulegator({ ...input, status_activ: true, client_sync_id: form.clientSyncId })
      queryClient.setQueryData<Culegator[]>(queryKeys.culegatori, (previous) => {
        if (!previous) return previous
        return previous.some((item) => item.id === row.id)
          ? previous.map((item) => (item.id === row.id ? { ...item, ...row } : item))
          : [row, ...previous]
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      hapticSuccess()
      setSaved(row)
      form.markSuccess()
    } catch (cause) {
      hapticError()
      setSaveError(cause instanceof Error && cause.message ? cause.message : 'Culegătorul nu s-a salvat.')
      form.markFailed()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)

  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setConfirmingClose(true)
    return true
  }

  const content = confirmingClose ? (
    <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
      <StepFormTitle>{editing ? 'Renunți la modificări?' : 'Renunți la culegător?'}</StepFormTitle>
      <p className={cn('text-fg-muted', kitText.base)}>
        {editing ? 'Culegătorul rămâne cum era salvat.' : 'Ce ai scris nu a fost salvat.'}
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setConfirmingClose(false)}>
          Continuă
        </Button>
        <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
          Renunță
        </Button>
      </div>
    </div>
  ) : (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <StepFormTitle>{editing ? 'Editează culegătorul' : 'Culegător nou'}</StepFormTitle>

      {saveError ? (
        <Notice tone="danger" title="Culegătorul nu s-a salvat">
          {saveError}
        </Notice>
      ) : null}

      <BigInput
        label="Nume și prenume"
        value={draft.nume}
        onChange={(event) => set('nume', event.target.value)}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={80}
        error={draft.nume.trim() !== '' && numeCurat.length < 2 ? 'Numele trebuie să aibă minimum 2 litere.' : undefined}
      />
      <BigInput
        label="Telefon (opțional)"
        type="tel"
        inputMode="tel"
        value={draft.telefon}
        onChange={(event) => set('telefon', event.target.value)}
        autoComplete="off"
        enterKeyHint="next"
        placeholder="07xx xxx xxx"
      />
      <BigInput
        label="Tarif (lei pe kilogram)"
        value={draft.tarif}
        onChange={(event) => set('tarif', event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="ex. 2,5"
        error={draft.tarif.trim() !== '' && !tarifValid ? 'Scrie tariful cu cifre, de exemplu 2,5.' : undefined}
        hint="Plata se calculează la fiecare recoltare: kg × tarif."
      />

      <div className="space-y-2">
        <p id="culegator-tip" className={cn('font-semibold text-fg', kitText.secondary)}>
          Tip
        </p>
        <TileGroup
          type="single"
          columns={2}
          value={draft.tip}
          onValueChange={(value) => set('tip', (value as TipAngajare | null) ?? 'Sezonier')}
          aria-labelledby="culegator-tip"
        >
          {TIPURI_ANGAJARE.map((tip) => (
            <Tile key={tip} size="sm" value={tip} title={tip} />
          ))}
        </TileGroup>
      </div>

      {draft.showNota ? (
        <BigTextarea label="Notă" value={draft.nota} onChange={(event) => set('nota', event.target.value)} rows={2} maxLength={500} />
      ) : (
        <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => set('showNota', true)}>
          <NotebookPen aria-hidden />
          Notă
        </Button>
      )}

      {/* Sub câmpuri, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={!canSave} loading={saving}>
        {saving ? 'Se salvează…' : 'Salvează culegătorul'}
      </Button>
    </form>
  )

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? 'Editează culegătorul' : 'Culegător nou'}
      description="Nume, telefon, tarif și tip."
      stepLabel={confirmingClose ? 'Nesalvat' : editing ? 'Editare' : 'Culegător nou'}
      onBack={() => {
        if (!confirmingClose) return false
        setConfirmingClose(false)
        return true
      }}
      success={
        saved ? (
          <SuccessScreen
            title={editing ? 'Modificat' : 'Culegător salvat'}
            description={saved.nume_prenume}
            primaryAction={{ label: 'Gata', onClick: close }}
            secondaryAction={
              editing
                ? undefined
                : {
                    label: 'Adaugă kg azi',
                    onClick: () => {
                      close()
                      router.push(`/recoltari?culegator=${saved.id}`)
                    },
                  }
            }
          />
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
