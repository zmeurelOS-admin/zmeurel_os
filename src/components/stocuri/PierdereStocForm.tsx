'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, CalendarDays, Gift, Home, MoreHorizontal, NotebookPen } from 'lucide-react'

import {
  BigInput,
  Button,
  CalendarPanel,
  KgField,
  ListRow,
  Notice,
  NumericKeypad,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  addDaysIso,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import { formatKg, round2 } from '@/lib/format-ro'
import { invalidateStock } from '@/lib/query-keys'
import { deltaKgText } from '@/lib/stocuri/stoc'
import {
  ETICHETA_MOTIV_PIERDERE,
  MOTIVE_PIERDERE,
  detaliuPierdere,
  problemaPierdere,
  trecePesteStoc,
  type MotivPierdere,
} from '@/lib/stocuri/pierderi'
import { createPierdereStoc } from '@/lib/supabase/queries/ajustari-stoc'
import { ZiCuDataRo } from '@/lib/tratamente/zile'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

const STEPS = ['motiv', 'kg'] as const
const FIELDS = ['kg'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

const ICON_MOTIV: Record<MotivPierdere, React.ReactNode> = {
  stricat: <Ban />,
  consum_propriu: <Home />,
  donat: <Gift />,
  altul: <MoreHorizontal />,
}

function mesajEroare(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  if (NETWORK_ERROR.test(message)) return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”.'
  if (/forbidden_read_only|row-level security|42501/i.test(message)) return 'Nu ai drept să notezi pierderi în stoc.'
  return message || 'Nu s-a salvat. Verifică internetul și încearcă din nou.'
}

export interface PierdereStocFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Disponibilul culturii acum (cifra mare), pentru confirmarea „sub zero”. */
  disponibilKg: number
  /** Eticheta cifrei („Afine cal. I disponibile”). */
  eticheta: string
  /** Cheia culturii (se scrie în `ajustari_stoc.cultura`); `null` = ferma cu o singură cifră. */
  cultura: string | null
  /** Ziua de azi (București). */
  azi: string
}

/**
 * „Pierdere” din Stocuri (promptul 33), în 2 pași: motivul (stricat, consum propriu, donat, altul cu text), apoi
 * kilogramele, ziua și o notă. Nu e venit și nu e cheltuială: scade doar stocul culturii. Dacă stocul ar trece sub
 * zero, întreabă întâi (și serverul primește confirmarea).
 */
export function PierdereStocForm({ open, onOpenChange, disponibilKg, eticheta, cultura, azi }: PierdereStocFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: { moduleName: 'stocuri' } })
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 5 })

  const [motiv, setMotiv] = useState<MotivPierdere | null>(null)
  const [textAltul, setTextAltul] = useState('')
  const [zi, setZi] = useState(azi)
  const [nota, setNota] = useState('')
  const [vedere, setVedere] = useState<'pas' | 'zi' | 'nota' | 'sub-zero' | 'renunt'>('pas')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ motiv: MotivPierdere; delta: number } | null>(null)

  // O cheie nouă = o pierdere nouă: câmpurile pornesc goale (poate rula de două ori, același rezultat).
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    fields.reset()
    setMotiv(null)
    setTextAltul('')
    setZi(azi)
    setNota('')
    setVedere('pas')
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const kg = fields.numbers.kg
  const inFlight = useRef(false)
  const problema = problemaPierdere({ motiv, kg, textAltul, zi, azi })
  const subZero = trecePesteStoc(kg, disponibilKg)

  const save = async (subZeroConfirmat: boolean) => {
    if (!motiv || !kg || problema || inFlight.current) return
    if (subZero && !subZeroConfirmat) {
      setVedere('sub-zero')
      return
    }
    inFlight.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const rand = await createPierdereStoc({
        motiv,
        cantitateKg: kg,
        detaliu: detaliuPierdere(motiv, textAltul, nota),
        data: zi,
        cultura,
        clientSyncId: form.clientSyncId,
        subZeroConfirmat,
      })
      invalidateStock(queryClient)
      hapticSuccess()
      setSaved({ motiv, delta: Number(rand.delta_kg) })
      form.markSuccess({ motiv })
    } catch (cause) {
      hapticError()
      setVedere('pas')
      setSaveError(mesajEroare(cause))
      form.markFailed({ motiv })
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)
  const dirty = motiv !== null || Boolean(kg) || nota.trim() !== '' || textAltul.trim() !== ''

  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setVedere('renunt')
    return true
  }

  const handleBack = () => {
    if (vedere !== 'pas') {
      setVedere('pas')
      return true
    }
    return false
  }

  const peKg = form.stepKey === 'kg' && vedere === 'pas'
  const eAzi = zi === azi

  let content: React.ReactNode
  if (vedere === 'renunt') {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la pierdere?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Stocul rămâne cum era.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere('pas')}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'sub-zero') {
    const ramane = round2(disponibilKg - (kg ?? 0))
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Stocul trece sub zero</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>
          {eticheta}: {formatKg(disponibilKg)}. După pierdere rămân {formatKg(ramane)}.
        </p>
        <p className={cn('text-fg-muted', kitText.secondary)}>Notezi totuși? Poate n-ai trecut încă o recoltare.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={saving} onClick={() => void save(true)}>
            Da, notez pierderea
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" disabled={saving} onClick={() => setVedere('pas')}>
            Înapoi
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'zi') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Ce zi?</StepFormTitle>
        <CalendarPanel
          value={zi}
          max={azi}
          onChange={(iso) => {
            setZi(iso)
            setVedere('pas')
          }}
          shortcuts={[
            { label: 'Azi', value: azi },
            { label: 'Ieri', value: addDaysIso(azi, -1) },
            { label: 'Alaltăieri', value: addDaysIso(azi, -2) },
          ]}
        />
      </div>
    )
  } else if (vedere === 'nota') {
    content = (
      <NotaChoice
        nota={nota}
        onDone={(text) => {
          setNota(text)
          setVedere('pas')
        }}
      />
    )
  } else if (form.stepKey === 'motiv') {
    content = (
      <div className="space-y-4">
        <StepFormTitle eyebrow={eticheta}>Ce s-a întâmplat?</StepFormTitle>
        <TileGroup type="single" value={motiv} onValueChange={() => undefined} aria-label="Motivul pierderii">
          {MOTIVE_PIERDERE.map((valoare) => (
            <Tile
              key={valoare}
              value={valoare}
              leading={ICON_MOTIV[valoare]}
              title={ETICHETA_MOTIV_PIERDERE[valoare]}
              onClick={() => {
                setMotiv(valoare)
                setSaveError(null)
                if (valoare !== 'altul') form.next()
              }}
            />
          ))}
        </TileGroup>
        {motiv === 'altul' ? (
          <BigInput
            label="Ce s-a întâmplat?"
            value={textAltul}
            onChange={(event) => setTextAltul(event.target.value)}
            autoComplete="off"
            enterKeyHint="next"
            maxLength={120}
            placeholder="ex. grindină, furat"
            autoFocus
          />
        ) : null}
        <p className={cn('text-fg-muted', kitText.secondary)}>Nu e venit și nu e cheltuială: scade doar din stoc.</p>
      </div>
    )
  } else {
    content = (
      <div className="space-y-2.5">
        <StepFormTitle eyebrow={motiv ? ETICHETA_MOTIV_PIERDERE[motiv] : undefined}>Câte kg s-au pierdut?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.secondary)}>
          {eticheta} acum: {formatKg(disponibilKg)}
        </p>
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <KgField label="Cantitatea" value={fields.values.kg} active onActivate={() => undefined} />
        <ListRow
          avatar={false}
          leading={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
              <CalendarDays />
            </span>
          }
          title={eAzi ? `Azi, ${ZiCuDataRo(zi).split(' ')[1]}` : ZiCuDataRo(zi)}
          detail="Ziua"
          onClick={() => setVedere('zi')}
        />
        <Button
          type="button"
          variant="quiet"
          size="touch"
          className="w-full min-w-0 px-2"
          aria-label={nota.trim() ? `Nota: ${nota.trim()}. Schimbă` : 'Adaugă o notă (opțional)'}
          onClick={() => setVedere('nota')}
        >
          <NotebookPen aria-hidden />
          <span className="truncate">{nota.trim() || 'Notă (opțional)'}</span>
        </Button>
      </div>
    )
  }

  const footer =
    form.stepKey === 'motiv' && vedere === 'pas' && motiv === 'altul'
      ? { primary: { label: 'Continuă', onClick: () => form.next(), disabled: !textAltul.trim() } }
      : peKg
        ? {
            primary: {
              label: saving ? 'Se salvează…' : kg ? `Salvează ${deltaKgText(-round2(kg))}` : 'Salvează',
              onClick: () => void save(false),
              loading: saving,
              disabled: Boolean(problema) || saving,
            },
          }
        : null

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Pierdere"
      description="Alegi motivul, apoi scrii kilogramele."
      stepLabel={vedere === 'renunt' ? 'Nesalvat' : vedere === 'nota' ? 'Notă' : vedere === 'zi' ? 'Ziua' : vedere === 'sub-zero' ? 'Confirmă' : undefined}
      onBack={handleBack}
      dock={peKg ? <NumericKeypad onKey={(key) => fields.press(key)} disabled={saving} aria-label="Tastatură pentru kilograme" /> : undefined}
      footer={footer}
      success={
        saved ? (
          <SuccessScreen
            title="Pierdere notată"
            description={`${ETICHETA_MOTIV_PIERDERE[saved.motiv]} · ${deltaKgText(saved.delta)}`}
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
        placeholder="ex. mucegăite după ploaie"
        autoFocus
      />
      {/* Sub câmp, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full">
        Gata
      </Button>
    </form>
  )
}
