'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Mail, NotebookPen } from 'lucide-react'

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
import { clientSchema } from '@/lib/clienti/schema'
import { CLIENT_TIP_LABEL } from '@/lib/clienti/view'
import { resolveExistingClientByPhone } from '@/lib/comenzi/ai-order-client'
import { formatLeiKg, formatNumber } from '@/lib/format-ro'
import { PRET_SE_INCARCA, usePretStandardStare } from '@/lib/pret-standard'
import { queryKeys } from '@/lib/query-keys'
import { createClienți, updateClienți, type Client, type ClientTip } from '@/lib/supabase/queries/clienti'
import { downloadVCard } from '@/lib/utils/downloadVCard'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface ClientPrefill {
  nume_client: string
  telefon: string
  email: string
  adresa: string
  observatii: string
}

export interface ClientStepFormProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  clienti: readonly Client[]
  /** Clientul editat; fără el, formularul creează unul nou. */
  editing?: Client | null
  /** Valori venite prin URL (chatul AI). Se aplică doar la creare. */
  prefill?: ClientPrefill | null
}

const STEPS = ['client'] as const
const TIPURI: readonly ClientTip[] = ['standard', 'patiserie', 'magazin']

interface Draft {
  nume: string
  telefon: string
  tip: ClientTip
  pret: string
  adresa: string
  email: string
  nota: string
  showEmail: boolean
  showNota: boolean
}

function draftFrom(editing: Client | null, prefill: ClientPrefill | null): Draft {
  if (editing) {
    return {
      nume: editing.nume_client ?? '',
      telefon: editing.telefon ?? '',
      tip: editing.tip,
      pret: editing.pret_negociat_lei_kg ? formatNumber(editing.pret_negociat_lei_kg) : '',
      adresa: editing.adresa ?? '',
      email: editing.email ?? '',
      nota: editing.observatii ?? '',
      showEmail: Boolean(editing.email?.trim()),
      showNota: Boolean(editing.observatii?.trim()),
    }
  }
  return {
    nume: prefill?.nume_client ?? '',
    telefon: prefill?.telefon ?? '',
    tip: 'standard',
    pret: '',
    adresa: prefill?.adresa ?? '',
    email: prefill?.email ?? '',
    nota: prefill?.observatii ?? '',
    showEmail: Boolean(prefill?.email?.trim()),
    showNota: Boolean(prefill?.observatii?.trim()),
  }
}

/**
 * Formularul unui client, același pentru nou și editare: nume, telefon, tip pe plăci, preț negociat
 * (doar la patiserii și magazine), adresă, notă. Un singur ecran, cu „Salvează clientul” sub câmpuri.
 */
export function ClientStepForm({ open, onOpenChange, clienti, editing = null, prefill = null }: ClientStepFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { standard, seIncarca: pretSeIncarca } = usePretStandardStare()
  const mode = editing ? 'edit' : 'create'
  const form = useStepForm({ steps: STEPS, open, mode, analytics: { moduleName: 'clienti' } })

  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing, prefill))
  const [initial, setInitial] = useState<Draft>(() => draftFrom(editing, prefill))
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [saved, setSaved] = useState<Client | null>(null)
  const inFlight = useRef(false)

  // O cheie de formular nouă înseamnă un formular nou. Poate rula de două ori: dă același rezultat.
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    const next = draftFrom(editing, prefill)
    setDraft(next)
    setInitial(next)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setWarning(null)
    setSaved(null)
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }))

  const numeCurat = draft.nume.trim().replace(/\s+/g, ' ')
  const negociat = draft.tip !== 'standard'
  const pretNumar = parseDecimal(draft.pret)
  const pretInvalid = negociat && draft.pret.trim() !== '' && (pretNumar === null || pretNumar <= 0)
  const emailCheck = clientSchema.shape.email.safeParse(draft.email.trim())

  // Același telefon la alt client: baza de date îl respinge, așa că spunem dinainte la cine e.
  const phoneOwner = useMemo(() => {
    const match = resolveExistingClientByPhone([...clienti], draft.telefon)
    const candidates = match.status === 'existing' ? [match.client] : match.status === 'ambiguous' ? match.clients : []
    return candidates.find((client) => client.id !== editing?.id) ?? null
  }, [clienti, draft.telefon, editing?.id])

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const canSave = numeCurat.length >= 2 && !pretInvalid && emailCheck.success && !phoneOwner && !saving

  const save = async () => {
    if (!canSave || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setSaveError(null)
    setWarning(null)

    const input = {
      nume_client: numeCurat,
      telefon: draft.telefon.trim() || null,
      email: draft.email.trim() || null,
      adresa: draft.adresa.trim() || null,
      // Prețul negociat e al patiseriilor și magazinelor; la „Persoană” rămâne ce era (nu îl ștergem la editare).
      ...(negociat ? { pret_negociat_lei_kg: pretNumar && pretNumar > 0 ? pretNumar : null } : {}),
      observatii: draft.nota.trim() || null,
      tip: draft.tip,
    }

    try {
      const client = editing
        ? await updateClienți(editing.id, input)
        : await createClienți(input, {
            onDuplicateWarning: (existing) =>
              setWarning(`Există deja un client cu nume asemănător: ${existing.nume_client}. L-am salvat și pe acesta.`),
          })
      queryClient.setQueryData<Client[]>(queryKeys.clienti, (previous) => {
        if (!previous) return previous
        return previous.some((item) => item.id === client.id)
          ? previous.map((item) => (item.id === client.id ? { ...item, ...client } : item))
          : [...previous, client]
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      hapticSuccess()
      setSaved(client)
      form.markSuccess()
    } catch (cause) {
      hapticError()
      const message = cause instanceof Error ? cause.message : ''
      setSaveError(
        /duplicate key|23505/i.test(message)
          ? 'Numărul de telefon e deja la alt client.'
          : message || 'Clientul nu s-a salvat. Verifică internetul și încearcă din nou.',
      )
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
      <StepFormTitle>{editing ? 'Renunți la modificări?' : 'Renunți la client?'}</StepFormTitle>
      <p className={cn('text-fg-muted', kitText.base)}>
        {editing ? 'Clientul rămâne cum era salvat.' : 'Ce ai scris nu a fost salvat.'}
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
      <StepFormTitle>{editing ? 'Editează clientul' : 'Client nou'}</StepFormTitle>

      {saveError ? (
        <Notice tone="danger" title="Clientul nu s-a salvat">
          {saveError}
        </Notice>
      ) : null}

      <BigInput
        label="Nume"
        value={draft.nume}
        onChange={(event) => set('nume', event.target.value)}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={120}
        error={draft.nume.trim() !== '' && numeCurat.length < 2 ? 'Numele trebuie să aibă minimum 2 litere.' : undefined}
      />
      <BigInput
        label="Telefon"
        type="tel"
        inputMode="tel"
        value={draft.telefon}
        onChange={(event) => set('telefon', event.target.value)}
        autoComplete="off"
        enterKeyHint="next"
        placeholder="07xx xxx xxx"
        error={phoneOwner ? `Numărul e deja la ${phoneOwner.nume_client}.` : undefined}
        hint="Îl folosim pentru apel și WhatsApp."
      />

      <div className="space-y-2">
        <p id="client-tip" className={cn('font-semibold text-fg', kitText.secondary)}>
          Tip
        </p>
        <TileGroup
          type="single"
          columns={3}
          value={draft.tip}
          onValueChange={(value) => set('tip', (value as ClientTip | null) ?? 'standard')}
          aria-labelledby="client-tip"
        >
          {TIPURI.map((tip) => (
            <Tile key={tip} size="sm" value={tip} title={CLIENT_TIP_LABEL[tip]} />
          ))}
        </TileGroup>
      </div>

      {negociat ? (
        <BigInput
          label="Preț negociat (lei/kg)"
          value={draft.pret}
          onChange={(event) => set('pret', event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          placeholder="ex. 25"
          error={pretInvalid ? 'Scrie prețul cu cifre, de exemplu 25.' : undefined}
          hint="Valabil tot anul. Îl poți schimba la fiecare comandă."
        />
      ) : (
        <p className={cn('rounded-box bg-surface-muted px-4 py-3 text-fg-muted', kitText.secondary)}>
          Plătește prețul standard: acum {pretSeIncarca ? PRET_SE_INCARCA : formatLeiKg(standard.activ)}, din Setări › Preț standard. Îl poți schimba la
          fiecare comandă.
        </p>
      )}

      <BigTextarea
        label="Adresă de livrare (opțional)"
        value={draft.adresa}
        onChange={(event) => set('adresa', event.target.value)}
        rows={2}
        maxLength={300}
        placeholder="ex. Str. Vișinilor 10, Burdujeni"
      />

      {draft.showNota ? (
        <BigTextarea
          label="Notă"
          value={draft.nota}
          onChange={(event) => set('nota', event.target.value)}
          rows={2}
          maxLength={500}
        />
      ) : null}
      {draft.showEmail ? (
        <BigInput
          label="Email"
          type="email"
          inputMode="email"
          value={draft.email}
          onChange={(event) => set('email', event.target.value)}
          autoComplete="off"
          error={!emailCheck.success ? 'Email invalid.' : undefined}
        />
      ) : null}
      {!draft.showNota || !draft.showEmail ? (
        <div className="grid grid-cols-2 gap-2.5">
          {draft.showNota ? null : (
            <Button type="button" variant="quiet" size="touch" className="min-w-0" onClick={() => set('showNota', true)}>
              <NotebookPen aria-hidden />
              Notă
            </Button>
          )}
          {draft.showEmail ? null : (
            <Button type="button" variant="quiet" size="touch" className="min-w-0" onClick={() => set('showEmail', true)}>
              <Mail aria-hidden />
              Email
            </Button>
          )}
        </div>
      ) : null}

      {/* Sub câmpuri, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={!canSave} loading={saving}>
        {saving ? 'Se salvează…' : 'Salvează clientul'}
      </Button>
    </form>
  )

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? 'Editează clientul' : 'Client nou'}
      description="Nume, telefon, tip și adresă."
      stepLabel={confirmingClose ? 'Nesalvat' : editing ? 'Editare' : 'Client nou'}
      onBack={() => {
        if (!confirmingClose) return false
        setConfirmingClose(false)
        return true
      }}
      success={
        saved ? (
          <div className="flex min-h-full flex-col gap-3">
            {warning ? <Notice tone="warning" title={warning} /> : null}
            <SuccessScreen
              className="min-h-0 flex-1"
              title={editing ? 'Modificat' : 'Client salvat'}
              description={saved.nume_client}
              primaryAction={{ label: 'Gata', onClick: close }}
              secondaryAction={
                editing
                  ? undefined
                  : {
                      label: 'Comandă nouă pentru el',
                      onClick: () => {
                        close()
                        router.push(`/comenzi?client=${saved.id}&nou=1`)
                      },
                    }
              }
            />
            {!editing && saved.telefon?.trim() ? (
              <Button
                type="button"
                variant="quiet"
                size="touch"
                className="w-full"
                onClick={() => downloadVCard(saved.nume_client, saved.telefon?.trim() ?? '')}
              >
                Salvează contactul în telefon
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
