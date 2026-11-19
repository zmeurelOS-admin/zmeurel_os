'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, NotebookPen, Tag } from 'lucide-react'

import {
  BigInput,
  Button,
  CalendarPanel,
  KgField,
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
import { track } from '@/lib/analytics/track'
import {
  CATEGORII_CHELTUIELI,
  CATEGORII_INVESTITII,
  resolveCheltuialaCategorie,
  resolveInvestitieCategorie,
} from '@/lib/financial/categories'
import { formatLei, relativeDayRo, round2 } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import {
  createCheltuiala,
  getFrequentCheltuieliSuppliers,
  updateCheltuiala,
  type Cheltuiala,
} from '@/lib/supabase/queries/cheltuieli'
import { createInvestitie, updateInvestitie, type Investitie } from '@/lib/supabase/queries/investitii'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { CategorieIcon } from './CategorieIcon'

export type FinancialKind = 'cheltuiala' | 'investitie'

/** Ce vine prin URL din chatul AI (`?openForm=1&suma=…&data=…&categorie=…&descriere=…`). Text, posibil gol. */
export interface FinancialPrefill {
  suma: string
  data: string
  categorie: string
  descriere: string
}

export interface CheltuialaStepFormProps {
  kind: FinancialKind
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  todayIso: string
  /** Parcelele, pentru „+ Parcelă” la investiții. */
  parcele: ReadonlyArray<{ id: string; nume_parcela: string | null }>
  /** Se aplică o singură dată, la deschidere. */
  prefill?: FinancialPrefill | null
  /** Rândul editat. Formularul pornește pe sumă, cu valorile salvate. */
  editing?: Cheltuiala | Investitie | null
}

const STEPS = ['categorie', 'suma'] as const
const FIELDS = ['suma'] as const
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

type Choice = 'data' | 'detalii' | 'parcela'

const CHOICE_LABEL: Record<Choice, string> = { data: 'Data', detalii: 'Detalii', parcela: 'Parcela' }

interface Draft {
  categorie: string | null
  /** `null` = azi. */
  date: string | null
  furnizor: string
  descriere: string
  parcelaId: string | null
  sumaFromChat: boolean
}

const EMPTY_DRAFT: Draft = { categorie: null, date: null, furnizor: '', descriere: '', parcelaId: null, sumaFromChat: false }

const dayOnly = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

function errorMessage(cause: unknown, mode: 'create' | 'edit'): string {
  const message = (cause as { userMessage?: string } | null)?.userMessage || (cause instanceof Error ? cause.message : '')
  if (NETWORK_ERROR.test(message)) {
    return mode === 'create'
      ? 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: nu se dublează.'
      : 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează modificările”.'
  }
  return message || 'Nu s-a salvat. Verifică internetul și încearcă din nou.'
}

/**
 * Adaugă sau editează o cheltuială ori o investiție, în 2 pași: pe ce ai dat banii (plăci), apoi cât
 * (tastatura din aplicație), cu data, furnizorul și, la investiții, parcela. Salvează direct din pasul 2.
 */
export function CheltuialaStepForm({
  kind,
  open,
  onOpenChange,
  todayIso,
  parcele,
  prefill = null,
  editing = null,
}: CheltuialaStepFormProps) {
  const queryClient = useQueryClient()
  const isInvestitie = kind === 'investitie'
  const mode = editing ? 'edit' : 'create'
  const categorii: readonly string[] = isInvestitie ? CATEGORII_INVESTITII : CATEGORII_CHELTUIELI
  const resolve = isInvestitie ? resolveInvestitieCategorie : resolveCheltuialaCategorie
  const prefillCategorie = prefill?.categorie.trim() ? resolve(prefill.categorie) : null

  const form = useStepForm({
    steps: STEPS,
    open,
    mode,
    initialStep: editing || prefillCategorie ? 'suma' : undefined,
    analytics: { moduleName: isInvestitie ? 'investitii' : 'cheltuieli' },
  })
  // Sume până la 9.999.999,99 lei.
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 7 })

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ suma: number; categorie: string } | null>(null)

  // ─── O cheie de formular nouă înseamnă o înregistrare nouă ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const [restarted, setRestarted] = useState(false)
  if (!open && sessionKey !== null) {
    setSessionKey(null)
    setRestarted(false)
  }
  if (open && sessionKey !== form.clientSyncId) {
    // Poate rula de două ori pentru aceeași deschidere: aceleași intrări dau același rezultat.
    setSessionKey(form.clientSyncId)
    fields.reset()

    if (editing) {
      setDraft({
        categorie: resolve(editing.categorie),
        date: dayOnly(editing.data) || null,
        furnizor: editing.furnizor ?? '',
        descriere: editing.descriere ?? '',
        parcelaId: 'parcela_id' in editing ? editing.parcela_id : null,
        sumaFromChat: false,
      })
      fields.setValue('suma', Number(editing.suma_lei) > 0 ? Number(editing.suma_lei) : null)
    } else if (prefill && !restarted) {
      const suma = Number(String(prefill.suma).replace(',', '.'))
      const hasSuma = Number.isFinite(suma) && suma > 0
      setDraft({
        ...EMPTY_DRAFT,
        categorie: prefillCategorie,
        date: ISO_DAY.test(prefill.data) && prefill.data <= todayIso ? prefill.data : null,
        descriere: prefill.descriere,
        sumaFromChat: hasSuma,
      })
      if (hasSuma) fields.setValue('suma', suma)
    } else {
      setDraft(EMPTY_DRAFT)
    }

    setChoice(null)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const { data: frequentSuppliers = [] } = useQuery({
    queryKey: queryKeys.cheltuieliFrequentSuppliers,
    queryFn: () => getFrequentCheltuieliSuppliers(4),
    enabled: open && !isInvestitie,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const date = draft.date ?? todayIso
  const suma = fields.numbers.suma ?? 0
  const parcela = parcele.find((item) => item.id === draft.parcelaId) ?? null
  const detailsText = [draft.furnizor.trim(), draft.descriere.trim()].filter(Boolean).join(' · ')

  const dirty = editing
    ? round2(suma) !== round2(Number(editing.suma_lei)) ||
      draft.categorie !== resolve(editing.categorie) ||
      date !== dayOnly(editing.data) ||
      draft.furnizor.trim() !== (editing.furnizor ?? '').trim() ||
      draft.descriere.trim() !== (editing.descriere ?? '').trim() ||
      (isInvestitie && draft.parcelaId !== ('parcela_id' in editing ? editing.parcela_id : null))
    : suma > 0 || draft.categorie !== null

  // ─── Salvarea ───
  const inFlight = useRef(false)
  const sentKeys = useRef(new Set<string>())
  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const canSave = draft.categorie !== null && suma > 0 && !saving

  const save = async () => {
    if (!canSave || draft.categorie === null || inFlight.current) return
    const key = form.clientSyncId
    const categorie = draft.categorie

    // Investițiile nu au cheie de idempotență în bază: o cheie de formular se trimite o singură dată.
    if (!editing && isInvestitie && sentKeys.current.has(key)) {
      setSaved({ suma, categorie })
      form.markSuccess()
      return
    }

    inFlight.current = true
    setSaving(true)
    setSaveError(null)

    const furnizor = draft.furnizor.trim()
    const descriere = draft.descriere.trim()

    try {
      if (isInvestitie) {
        if (editing) {
          await updateInvestitie(editing.id, {
            data: date,
            suma_lei: suma,
            furnizor,
            descriere,
            parcela_id: draft.parcelaId,
            // Categoria se rescrie doar dacă a fost schimbată: un rând vechi își păstrează numele din bază.
            ...(categorie !== resolveInvestitieCategorie(editing.categorie) ? { categorie } : {}),
          })
          track('investitie_edit', { id: editing.id })
        } else {
          await createInvestitie({
            data: date,
            categorie,
            suma_lei: suma,
            furnizor: furnizor || undefined,
            descriere: descriere || undefined,
            parcela_id: draft.parcelaId ?? undefined,
          })
          sentKeys.current.add(key)
          track('investitie_add', { suma, categorie })
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
      } else {
        if (editing) {
          await updateCheltuiala(editing.id, {
            data: date,
            suma_lei: suma,
            furnizor,
            descriere,
            ...(categorie !== resolveCheltuialaCategorie(editing.categorie) ? { categorie } : {}),
          })
          track('cheltuiala_edit', { id: editing.id })
        } else {
          // Cheia formularului pleacă spre server ca `client_sync_id`: o reîncercare nu dublează cheltuiala.
          await createCheltuiala({
            client_sync_id: key,
            data: date,
            categorie,
            suma_lei: suma,
            furnizor: furnizor || undefined,
            descriere: descriere || undefined,
          })
          track('cheltuiala_add', { suma, categorie })
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      hapticSuccess()
      if (liveKeyRef.current === key) {
        setSaved({ suma, categorie })
        form.markSuccess()
      }
    } catch (cause) {
      hapticError()
      if (liveKeyRef.current === key) {
        setSaveError(errorMessage(cause, mode))
        form.markFailed()
      }
    } finally {
      inFlight.current = false
      if (liveKeyRef.current === key) setSaving(false)
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

  const handleBack = () => {
    if (confirmingClose) {
      setConfirmingClose(false)
      return true
    }
    if (choice) {
      setChoice(null)
      return true
    }
    return false
  }

  const onSuma = form.stepKey === 'suma'
  const showChoice = onSuma && choice !== null && !confirmingClose
  const showKeypad = onSuma && !showChoice && !confirmingClose
  const noun = isInvestitie ? 'investiție' : 'cheltuială'

  let content: React.ReactNode
  if (confirmingClose) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>{editing ? 'Renunți la modificări?' : suma > 0 ? `Renunți la ${formatLei(suma)}?` : `Renunți la ${noun}?`}</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>{editing ? 'Rămâne cum era salvată.' : 'Ce ai scris nu a fost salvat.'}</p>
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
  } else if (form.stepKey === 'categorie') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>{isInvestitie ? 'În ce ai investit?' : 'Pe ce ai dat banii?'}</StepFormTitle>
        <TileGroup type="single" value={draft.categorie} onValueChange={() => undefined} aria-label="Categorie">
          {categorii.map((categorie) => (
            <Tile
              key={categorie}
              value={categorie}
              leading={<CategorieIcon kind={kind} categorie={categorie} />}
              title={categorie}
              // Și placa deja aleasă trebuie să ducă mai departe, de aceea `onClick`.
              onClick={() => {
                setDraft((previous) => ({ ...previous, categorie }))
                form.next()
              }}
            />
          ))}
        </TileGroup>
      </div>
    )
  } else if (showChoice && choice === 'data') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Ce zi?</StepFormTitle>
        <CalendarPanel
          value={date}
          onChange={(iso) => {
            setDraft((previous) => ({ ...previous, date: iso }))
            setChoice(null)
          }}
          max={todayIso}
          shortcuts={[
            { label: 'Azi', value: todayIso },
            { label: 'Ieri', value: addDaysIso(todayIso, -1) },
            { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
          ]}
        />
      </div>
    )
  } else if (showChoice && choice === 'parcela') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Pe ce parcelă?</StepFormTitle>
        <TileGroup type="single" value={draft.parcelaId ?? 'fara'} onValueChange={() => undefined} aria-label="Parcelă">
          <Tile
            value="fara"
            title="Toată ferma"
            subtitle="Fără parcelă"
            onClick={() => {
              setDraft((previous) => ({ ...previous, parcelaId: null }))
              setChoice(null)
            }}
          />
          {parcele.map((item) => (
            <Tile
              key={item.id}
              value={item.id}
              title={item.nume_parcela?.trim() || 'Parcelă fără nume'}
              onClick={() => {
                setDraft((previous) => ({ ...previous, parcelaId: item.id }))
                setChoice(null)
              }}
            />
          ))}
        </TileGroup>
      </div>
    )
  } else if (showChoice && choice === 'detalii') {
    content = (
      <DetaliiChoice
        furnizor={draft.furnizor}
        descriere={draft.descriere}
        suppliers={frequentSuppliers}
        onDone={(furnizor, descriere) => {
          setDraft((previous) => ({ ...previous, furnizor, descriere }))
          setChoice(null)
        }}
      />
    )
  } else {
    content = (
      <div className="space-y-2">
        <StepFormTitle>{isInvestitie ? 'Cât ai investit?' : 'Cât ai dat?'}</StepFormTitle>

        {/* Sus, nu sub câmpuri: la 390×800 zona de sub sumă e sub marginea ecranului. */}
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Pastila
            icon={<Tag aria-hidden />}
            label="Categoria"
            value={draft.categorie}
            placeholder="Alege categoria"
            onClick={() => form.goTo('categorie')}
          />
          <Pastila icon={<CalendarDays aria-hidden />} label="Data" value={relativeDayRo(date, todayIso)} onClick={() => setChoice('data')} />
        </div>

        <KgField label="Suma" unit="lei" value={fields.values.suma} active onActivate={() => undefined} />
        {draft.sumaFromChat ? (
          <p className={cn('text-center font-semibold text-info-text', kitText.secondary)}>Din chat — verifică suma</p>
        ) : null}

        <div className={cn('grid gap-2', isInvestitie ? 'grid-cols-2' : 'grid-cols-1')}>
          <Button
            type="button"
            variant="quiet"
            size="touch"
            className="min-w-0 px-2"
            aria-label={detailsText ? `Furnizor și descriere: ${detailsText}. Schimbă` : 'Adaugă furnizorul sau ce ai cumpărat'}
            onClick={() => setChoice('detalii')}
          >
            <NotebookPen aria-hidden />
            <span className="truncate">{detailsText || 'Furnizor / ce ai cumpărat'}</span>
          </Button>
          {isInvestitie ? (
            <Button
              type="button"
              variant="quiet"
              size="touch"
              className="min-w-0 px-2"
              aria-label={parcela ? `Parcela: ${parcela.nume_parcela ?? 'fără nume'}. Schimbă` : 'Adaugă parcela'}
              onClick={() => setChoice('parcela')}
            >
              <MapPin aria-hidden />
              <span className="truncate">{parcela ? parcela.nume_parcela?.trim() || 'Parcelă fără nume' : 'Parcelă'}</span>
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? `Editează: ${noun}` : isInvestitie ? 'Investiție nouă' : 'Cheltuială nouă'}
      description="Alegi categoria, apoi scrii suma."
      stepLabel={confirmingClose ? 'Nesalvat' : showChoice && choice ? CHOICE_LABEL[choice] : undefined}
      onBack={handleBack}
      dock={
        showKeypad ? (
          <NumericKeypad
            onKey={(keypadKey) => {
              if (draft.sumaFromChat) setDraft((previous) => ({ ...previous, sumaFromChat: false }))
              fields.press(keypadKey)
            }}
            disabled={saving}
            aria-label="Tastatură pentru sumă"
          />
        ) : undefined
      }
      footer={
        showKeypad
          ? {
              primary: {
                label: saving
                  ? 'Se salvează…'
                  : editing
                    ? 'Salvează modificările'
                    : suma > 0
                      ? `Salvează ${formatLei(suma)}`
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
            title={editing ? 'Modificat' : 'Salvat'}
            description={`${saved.categorie} · ${formatLei(saved.suma)}`}
            primaryAction={{ label: 'Gata', onClick: close }}
            secondaryAction={
              editing
                ? undefined
                : {
                    label: isInvestitie ? 'Încă o investiție' : 'Încă o cheltuială',
                    onClick: () => {
                      setRestarted(true)
                      form.restart()
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

function DetaliiChoice({
  furnizor,
  descriere,
  suppliers,
  onDone,
}: {
  furnizor: string
  descriere: string
  suppliers: readonly string[]
  onDone: (furnizor: string, descriere: string) => void
}) {
  const [furnizorText, setFurnizorText] = useState(furnizor)
  const [descriereText, setDescriereText] = useState(descriere)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(furnizorText.trim(), descriereText.trim())
      }}
    >
      <StepFormTitle>De la cine și ce?</StepFormTitle>
      <BigInput
        label="Furnizor (opțional)"
        value={furnizorText}
        onChange={(event) => setFurnizorText(event.target.value)}
        autoComplete="off"
        enterKeyHint="next"
        maxLength={120}
        placeholder="ex. Agro Suceava"
      />
      {suppliers.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Furnizori folosiți des">
          {suppliers.map((supplier) => (
            <Button key={supplier} type="button" variant="neutral" size="touch" onClick={() => setFurnizorText(supplier)}>
              {supplier}
            </Button>
          ))}
        </div>
      ) : null}
      <BigInput
        label="Ce ai cumpărat (opțional)"
        value={descriereText}
        onChange={(event) => setDescriereText(event.target.value)}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={200}
        placeholder="ex. 200 de caserole"
      />
      {/* Sub câmpuri, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full">
        Gata
      </Button>
    </form>
  )
}
