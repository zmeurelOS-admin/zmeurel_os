'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Store, UserRound } from 'lucide-react'

import { ComandaClientStep } from '@/components/comenzi/ComandaClientStep'
import { COMENZI_INVALIDATED } from '@/components/comenzi/useComandaActions'
import {
  Button,
  KgField,
  Notice,
  NumericKeypad,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { parseStocInsuficient } from '@/lib/comenzi/day-view'
import { formatKg, formatLei, formatLeiKg, formatNumber, round2 } from '@/lib/format-ro'
import { PERIOADA_PRET_LABEL, PRET_SE_INCARCA, pretPentruClient, usePretStandardStare } from '@/lib/pret-standard'
import { queryKeys } from '@/lib/query-keys'
import type { Client } from '@/lib/supabase/queries/clienti'
import { getComenziStockSummaryAzi, type Comanda } from '@/lib/supabase/queries/comenzi'
import { saveVanzareRapida, stocRamasDupa } from '@/lib/vanzari/vanzare-rapida'
import { VANZARE_RAPIDA_FARA_CLIENT } from '@/lib/vanzari/view'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface VanzareRapidaFormProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  todayIso: string
  clienti: readonly Client[]
  /** Pentru „Clienți recenți” din alegerea clientului. */
  comenzi: readonly Pick<Comanda, 'client_id' | 'created_at'>[]
}

const STEPS = ['vanzare'] as const
const FIELDS = ['kg', 'pret'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

interface Saved {
  kg: number
  pret: number
  clientNume: string
  ramasKg: number | null
}

/**
 * Vânzare rapidă, fără comandă (la poartă, la piață): kilogramele pe tastatura din aplicație, prețul standard
 * (se poate schimba), clientul opțional. Se salvează încasată pe loc și scade din stocul cal. 1 ca o livrare.
 */
export function VanzareRapidaForm({ open, onOpenChange, todayIso, clienti, comenzi }: VanzareRapidaFormProps) {
  const queryClient = useQueryClient()
  const { standard, seIncarca: pretSeIncarca } = usePretStandardStare()

  const form = useStepForm({ steps: STEPS, open, analytics: { moduleName: 'vanzari' } })
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 4 })

  const [client, setClient] = useState<Client | null>(null)
  /** Prețul scris de mână. Cât e `false`, se arată prețul clientului sau cel standard. */
  const [pretTouched, setPretTouched] = useState(false)
  const [choosingClient, setChoosingClient] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)

  // ─── O cheie de formular nouă înseamnă o vânzare nouă ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    // Poate rula de două ori pentru aceeași deschidere: dă același rezultat.
    setSessionKey(form.clientSyncId)
    fields.reset()
    setClient(null)
    setPretTouched(false)
    setChoosingClient(false)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const stockQuery = useQuery({
    queryKey: queryKeys.comenziStockSummaryAzi,
    queryFn: getComenziStockSummaryAzi,
    enabled: open,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const disponibilKg = stockQuery.data ? round2(stockQuery.data.totalStocDisponibilKg) : null

  const pretImplicit = pretPentruClient(client, standard)
  const kg = fields.numbers.kg ?? 0
  const pret = pretTouched ? (fields.numbers.pret ?? 0) : pretImplicit.pret
  // Cât setările nu au venit, prețul standard e cel de rezervă: schelet în loc de preț și fără salvare.
  const pretInAsteptare = !pretTouched && pretSeIncarca && pretImplicit.sursa === 'standard'
  const pretText = pretTouched ? fields.values.pret : pretInAsteptare ? PRET_SE_INCARCA : formatNumber(pretImplicit.pret)
  const total = round2(kg * pret)
  const ramasKg = stocRamasDupa(disponibilKg, kg)
  const overStock = disponibilKg !== null && kg > 0 && kg > disponibilKg

  // ─── Salvarea ───
  const inFlight = useRef(false)
  // Comanda creată de o încercare nereușită a acestui formular: reîncercarea o refolosește.
  const pending = useRef<{ key: string; comandaId: string } | null>(null)
  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const canSave = kg > 0 && pret > 0 && !pretInAsteptare && !overStock && !saving

  const save = async () => {
    if (!canSave || inFlight.current) return
    const key = form.clientSyncId
    inFlight.current = true
    setSaving(true)
    setSaveError(null)

    try {
      const result = await saveVanzareRapida({
        clientId: client?.id ?? null,
        kg,
        pretLeiKg: pret,
        todayIso,
        clientSyncId: key,
        pendingComandaId: pending.current?.key === key ? pending.current.comandaId : null,
        onPendingChange: (comandaId) => {
          pending.current = comandaId ? { key, comandaId } : null
        },
      })
      track('vanzare_rapida_add', { kg, pret, cu_client: Boolean(client) })
      hapticSuccess()
      if (liveKeyRef.current === key) {
        setSaved({
          kg: round2(Number(result.vanzare.cantitate_kg) || kg),
          pret,
          clientNume: client?.nume_client ?? VANZARE_RAPIDA_FARA_CLIENT,
          ramasKg,
        })
        form.markSuccess()
      }
    } catch (cause) {
      hapticError()
      if (liveKeyRef.current === key) {
        const stoc = parseStocInsuficient(cause)
        const message = cause instanceof Error ? cause.message : ''
        setSaveError(
          stoc
            ? `Ai doar ${formatKg(stoc.disponibilKg)} în stoc cal. 1. Notează întâi recoltarea sau scrie mai puțin.`
            : NETWORK_ERROR.test(message)
              ? 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”.'
              : message || 'Nu s-a salvat. Verifică internetul și încearcă din nou.',
        )
        form.markFailed()
      }
    } finally {
      inFlight.current = false
      // Și la eroare: stocul sau comenzile s-au putut schimba.
      for (const queryKey of COMENZI_INVALIDATED) void queryClient.invalidateQueries({ queryKey })
      if (liveKeyRef.current === key) setSaving(false)
    }
  }

  const close = () => onOpenChange(false)

  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!(kg > 0 || client !== null || pretTouched)) return false
    setConfirmingClose(true)
    return true
  }

  const handleBack = () => {
    if (confirmingClose) {
      setConfirmingClose(false)
      return true
    }
    if (choosingClient) {
      setChoosingClient(false)
      return true
    }
    return false
  }

  const showKeypad = !choosingClient && !confirmingClose

  let content: React.ReactNode
  if (confirmingClose) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>{kg > 0 ? `Renunți la ${formatKg(kg)}?` : 'Renunți la vânzare?'}</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Vânzarea nu a fost salvată.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setConfirmingClose(false)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (choosingClient) {
    content = (
      <ComandaClientStep
        title="Cui ai vândut?"
        clienti={clienti}
        comenzi={comenzi}
        onPick={(picked) => {
          setClient(picked)
          setChoosingClient(false)
        }}
        extra={
          <Button
            type="button"
            variant="neutral"
            size="touch"
            className="w-full"
            onClick={() => {
              setClient(null)
              setChoosingClient(false)
            }}
          >
            <Store aria-hidden />
            Fără client · la poartă
          </Button>
        }
      />
    )
  } else {
    content = (
      <div className="space-y-2">
        <StepFormTitle>Cât ai vândut?</StepFormTitle>

        {/* Sus, nu sub câmpuri: zona de sub cifre e sub marginea ecranului la 390×800. */}
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}

        <Button
          type="button"
          variant="neutral"
          size="touch"
          className="w-full min-w-0 justify-start px-3"
          aria-label={client ? `Client: ${client.nume_client} — schimbă` : 'Fără client, la poartă — alege client'}
          onClick={() => setChoosingClient(true)}
        >
          {client ? <UserRound aria-hidden /> : <Store aria-hidden />}
          <span className="min-w-0 flex-1 truncate text-left">{client ? client.nume_client : 'Fără client · la poartă'}</span>
          <span className={cn('shrink-0 font-bold text-primary', kitText.secondary)}>{client ? 'Schimbă' : 'Alege client'}</span>
        </Button>

        <KgField label="Cantitate" value={fields.values.kg} active={fields.active === 'kg'} onActivate={() => fields.setActive('kg')} />

        <KgField
          label={
            pretTouched
              ? 'Preț'
              : pretImplicit.sursa === 'negociat'
                ? 'Preț · al clientului'
                : standard.configurabil
                  ? `Preț · ${PERIOADA_PRET_LABEL[standard.perioada].toLowerCase()}`
                  : 'Preț standard'
          }
          unit="lei/kg"
          size="md"
          value={pretText}
          active={fields.active === 'pret'}
          onActivate={() => fields.setActive('pret')}
        />

        <p
          className={cn('px-1 text-center font-semibold', kitText.secondary, overStock ? 'text-danger-text' : 'text-fg-muted')}
          aria-live="polite"
        >
          {disponibilKg === null
            ? stockQuery.isError
              ? 'Stocul cal. 1 nu s-a încărcat.'
              : 'Verific stocul cal. 1…'
            : overStock
              ? `Ai doar ${formatKg(disponibilKg)} în stoc cal. 1.`
              : kg > 0 && ramasKg !== null
                ? `Rămas în stoc cal. 1: ${formatKg(ramasKg)}`
                : `În stoc cal. 1: ${formatKg(disponibilKg)}`}
        </p>
      </div>
    )
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Vânzare rapidă"
      description="Fără comandă: scrii kilogramele și prețul. Se salvează încasată."
      // Un singur pas: „Pasul 1 din 1” nu spune nimic.
      stepLabel={confirmingClose ? 'Nesalvat' : choosingClient ? 'Client' : 'Fără comandă'}
      onBack={handleBack}
      dock={
        showKeypad ? (
          <NumericKeypad
            onKey={(keypadKey) => {
              // Prima tastă pe preț înlocuiește prețul propus (câmpul de dedesubt e gol).
              if (fields.active === 'pret' && !pretTouched) setPretTouched(true)
              fields.press(keypadKey)
            }}
            disabled={saving}
            aria-label={fields.active === 'pret' ? 'Tastatură pentru preț' : 'Tastatură pentru cantitate'}
          />
        ) : undefined
      }
      footer={
        showKeypad
          ? {
              primary: {
                label: saving
                  ? 'Se salvează…'
                  : overStock
                    ? 'Nu ajunge stocul'
                    : total > 0
                      ? `Încasat ${formatLei(total)} · Salvează`
                      : 'Salvează',
                onClick: () => void save(),
                loading: saving,
                disabled: !canSave,
              },
            }
          : null
      }
      success={
        saved ? (
          <SuccessScreen
            title="Vândut și încasat"
            description={
              <>
                {saved.clientNume} · {formatKg(saved.kg)} × {formatLeiKg(saved.pret)} = {formatLei(round2(saved.kg * saved.pret))}
                {saved.ramasKg !== null ? (
                  <>
                    <br />
                    Rămas în stoc cal. 1: {formatKg(Math.max(0, saved.ramasKg))}
                  </>
                ) : null}
              </>
            }
            primaryAction={{ label: 'Gata', onClick: close }}
            secondaryAction={{ label: 'Încă o vânzare', onClick: () => form.restart() }}
          />
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
