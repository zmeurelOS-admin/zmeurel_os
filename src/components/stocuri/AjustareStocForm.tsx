'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Home, Minus, MoreHorizontal, NotebookPen, Plus, Snowflake, Soup } from 'lucide-react'

import {
  BigInput,
  Button,
  KgField,
  Notice,
  NumericKeypad,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import { formatKg, round2 } from '@/lib/format-ro'
import { invalidateStock } from '@/lib/query-keys'
import { ajustareAdauga, deltaKgText, ETICHETA_AJUSTARE, problemaAjustare, TIPURI_AJUSTARE } from '@/lib/stocuri/stoc'
import { createAjustareStoc, type AjustareStocTip } from '@/lib/supabase/queries/ajustari-stoc'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

const STEPS = ['motiv', 'kg'] as const
const FIELDS = ['kg'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

const ICON_TIP: Record<AjustareStocTip, React.ReactNode> = {
  congelat: <Snowflake />,
  procesat: <Soup />,
  pierdere: <Ban />,
  consum_propriu: <Home />,
  corectie_plus: <Plus />,
  corectie_minus: <Minus />,
  altul: <MoreHorizontal />,
}

function mesajEroare(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  if (NETWORK_ERROR.test(message)) return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”.'
  if (/forbidden_read_only|row-level security|42501/i.test(message)) return 'Nu ai drept să ajustezi stocul.'
  return message || 'Nu s-a salvat. Verifică internetul și încearcă din nou.'
}

export interface AjustareStocFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Disponibilul de acum (cifra mare), pentru regula „nu sub 0”. */
  disponibilKg: number
}

/**
 * „Ajustează stocul” în 2 pași: motivul (plăci mari), apoi kilogramele pe tastatura din aplicație și o notă.
 * O scădere nu poate duce disponibilul sub 0 (regula e și pe server, în `create_ajustare_stoc`).
 */
export function AjustareStocForm({ open, onOpenChange, disponibilKg }: AjustareStocFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: { moduleName: 'stocuri' } })
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 5 })

  const [tip, setTip] = useState<AjustareStocTip | null>(null)
  const [nota, setNota] = useState('')
  const [scriuNota, setScriuNota] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ tip: AjustareStocTip; delta: number } | null>(null)

  // O cheie nouă de formular = o ajustare nouă: câmpurile pornesc goale (poate rula de două ori, același rezultat).
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    fields.reset()
    setTip(null)
    setNota('')
    setScriuNota(false)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const kg = fields.numbers.kg
  // Cheia formularului pleacă spre server (`client_sync_id`): o reîncercare primește ajustarea deja scrisă.
  // Garda din memorie rămâne pentru baza de date fără migrarea cu cheia.
  const savedKeys = useRef(new Set<string>())
  const inFlight = useRef(false)

  const problema = form.stepKey === 'kg' && kg ? problemaAjustare(tip, kg, disponibilKg) : null
  const canSave = tip !== null && Boolean(kg && kg > 0) && problema === null && !saving

  const save = async () => {
    if (!canSave || !tip || !kg || inFlight.current) return
    const key = form.clientSyncId
    if (savedKeys.current.has(key)) return
    inFlight.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const rand = await createAjustareStoc({ tip, cantitateKg: kg, motiv: nota.trim() || null, clientSyncId: key })
      savedKeys.current.add(key)
      invalidateStock(queryClient)
      hapticSuccess()
      setSaved({ tip, delta: Number(rand.delta_kg) })
      form.markSuccess({ tip })
    } catch (cause) {
      hapticError()
      setSaveError(mesajEroare(cause))
      form.markFailed({ tip })
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)
  const dirty = tip !== null || Boolean(kg) || nota.trim() !== ''

  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setConfirmingClose(true)
    return true
  }

  const handleBack = () => {
    if (confirmingClose) {
      setConfirmingClose(false)
      return true
    }
    if (scriuNota) {
      setScriuNota(false)
      return true
    }
    return false
  }

  const peKg = form.stepKey === 'kg' && !confirmingClose && !scriuNota
  const adauga = tip ? ajustareAdauga(tip) : false

  let content: React.ReactNode
  if (confirmingClose) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la ajustare?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Stocul rămâne cum era.</p>
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
  } else if (form.stepKey === 'motiv') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>De ce se schimbă stocul?</StepFormTitle>
        <TileGroup type="single" value={tip} onValueChange={() => undefined} aria-label="Motivul">
          {TIPURI_AJUSTARE.map((valoare) => (
            <Tile
              key={valoare}
              value={valoare}
              leading={ICON_TIP[valoare]}
              title={ETICHETA_AJUSTARE[valoare]}
              // Și placa deja aleasă duce mai departe, de aceea `onClick`.
              onClick={() => {
                setTip(valoare)
                setSaveError(null)
                form.next()
              }}
            />
          ))}
        </TileGroup>
        <p className={cn('text-fg-muted', kitText.secondary)}>Pasul 2: kilogramele, pe tastatura din aplicație, și o notă opțională.</p>
      </div>
    )
  } else if (scriuNota) {
    content = (
      <NotaChoice
        nota={nota}
        onDone={(text) => {
          setNota(text)
          setScriuNota(false)
        }}
      />
    )
  } else {
    content = (
      <div className="space-y-2.5">
        <StepFormTitle eyebrow={tip ? ETICHETA_AJUSTARE[tip] : undefined}>{adauga ? 'Câte kg adaugi?' : 'Câte kg scazi?'}</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.secondary)}>Zmeură cal. I disponibilă acum: {formatKg(disponibilKg)}</p>
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <KgField label="Cantitatea" value={fields.values.kg} active onActivate={() => undefined} />
        {problema ? <Notice tone="warning" title={problema} /> : null}
        <Button
          type="button"
          variant="quiet"
          size="touch"
          className="w-full min-w-0 px-2"
          aria-label={nota.trim() ? `Nota: ${nota.trim()}. Schimbă` : 'Adaugă o notă (opțional)'}
          onClick={() => setScriuNota(true)}
        >
          <NotebookPen aria-hidden />
          <span className="truncate">{nota.trim() || 'Notă (opțional)'}</span>
        </Button>
      </div>
    )
  }

  const deltaAfisat = kg ? (adauga ? kg : -kg) : 0

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Ajustează stocul"
      description="Alegi motivul, apoi scrii kilogramele."
      stepLabel={confirmingClose ? 'Nesalvat' : scriuNota ? 'Notă' : undefined}
      onBack={handleBack}
      dock={peKg ? <NumericKeypad onKey={(key) => fields.press(key)} disabled={saving} aria-label="Tastatură pentru kilograme" /> : undefined}
      footer={
        peKg
          ? {
              primary: {
                label: saving ? 'Se salvează…' : kg ? `Salvează ${deltaKgText(round2(deltaAfisat))}` : 'Salvează',
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
            title="Stoc ajustat"
            description={`${ETICHETA_AJUSTARE[saved.tip]} · ${deltaKgText(saved.delta)}`}
            primaryAction={{ label: 'Gata', onClick: close }}
          />
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}

function NotaChoice({ nota, onDone }: { nota: string; onDone: (nota: string) => void }) {
  const [text, setText] = useState(nota)
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(text.trim())
      }}
    >
      <StepFormTitle>O notă?</StepFormTitle>
      <BigInput
        label="Notă (opțional)"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={200}
        placeholder="ex. pentru gem, mucegăite"
        autoFocus
      />
      {/* Sub câmp, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full">
        Gata
      </Button>
    </form>
  )
}
