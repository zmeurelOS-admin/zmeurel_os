'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  Button,
  CalendarPanel,
  FilterPills,
  ListRow,
  Notice,
  Segments,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  addDaysIso,
  kitText,
  useStepForm,
} from '@/components/kit'
import { ICON_LUCRARE } from '@/components/lucrari/TipLucrareIcon'
import { useCineOptiuni } from '@/components/lucrari/useCineOptiuni'
import { generateClientId } from '@/lib/offline/generateClientId'
import {
  CIORNA_GOALA,
  ceLipsesteLucrare,
  dataAplicare,
  randuriLucrareDeSalvat,
  type CandLucrare,
  type CiornaLucrare,
} from '@/lib/lucrari/formular'
import type { RandLucrare } from '@/lib/lucrari/jurnal'
import { ETICHETA_LUCRARE, TIPURI_LUCRARE, VALOARE_LUCRARE_DB, type TipLucrare } from '@/lib/lucrari/tipuri'
import { queryKeys } from '@/lib/query-keys'
import { useSchemaFeatures } from '@/lib/schema-features'
import { creeazaLucrari, modificaLucrare } from '@/lib/supabase/queries/lucrari'
import { textParcele } from '@/lib/tratamente/jurnal'
import { ZiCuDataRo, ziCuDataRo } from '@/lib/tratamente/zile'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface ParcelaLucrare {
  id: string
  nume_parcela: string | null
  rol?: string | null
}

/** Ce vine gata completat: din fișa parcelei (parcela) sau din chatul AI (tip, parcelă, zi, notă). */
export interface PrecompletareLucrare {
  tip?: TipLucrare | null
  parcelaIds?: string[]
  nota?: string
  /** Ziua (ISO). Trecut = „altă zi”, viitor = „planifică” (dacă se poate), azi = „azi”. */
  zi?: string | null
}

export interface LucrareStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcele: readonly ParcelaLucrare[]
  todayIso: string
  /** Editare: rândul din jurnal (toate parcelele lucrării). */
  editing?: RandLucrare | null
  precompletare?: PrecompletareLucrare | null
}

type CandTip = CandLucrare['tip']

const STEPS = ['tip', 'detalii'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

function mesajEroare(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = (error as { code?: string } | null)?.code
  if (NETWORK_ERROR.test(message)) return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: lucrarea nu se dublează.'
  if (code === '42501' || /row-level security/i.test(message)) return 'Nu ai drept de scriere pe lucrări. Cere-i proprietarului fermei acces.'
  return message || 'Lucrarea nu s-a salvat. Încearcă din nou.'
}

function startFrom(editing: RandLucrare | null | undefined, precompletare: PrecompletareLucrare | null | undefined, todayIso: string, planificare: boolean) {
  if (editing) {
    const zi = editing.zi ?? todayIso
    const cand: CandTip = editing.stare === 'planificata' ? 'planifica' : zi === todayIso ? 'azi' : 'alta_zi'
    return {
      ciorna: { tip: editing.tip, parcelaIds: [...editing.parcelaIds], cine: editing.cine ?? '', nota: editing.nota ?? '' } satisfies CiornaLucrare,
      cand,
      zi: cand === 'azi' ? null : zi,
    }
  }
  const zi = precompletare?.zi ?? null
  const cand: CandTip = !zi || zi === todayIso ? 'azi' : zi < todayIso ? 'alta_zi' : planificare ? 'planifica' : 'azi'
  return {
    ciorna: {
      ...CIORNA_GOALA,
      tip: precompletare?.tip ?? null,
      parcelaIds: precompletare?.parcelaIds ?? [],
      nota: precompletare?.nota ?? '',
    } satisfies CiornaLucrare,
    cand,
    zi: cand === 'azi' ? null : zi,
  }
}

/**
 * Lucrare nouă (sau editare), în 2 pași: (1) ce lucrare, pe plăci; (2) unde (una sau mai multe parcele),
 * când (azi / altă zi / planifică), cine (opțional), notă. Pe mai multe parcele: un rând pe parcelă,
 * fiecare cu cheia lui (aceeași la reîncercare), toate cu același lot = cheia formularului.
 */
export function LucrareStepForm({ open, onOpenChange, parcele, todayIso, editing = null, precompletare = null }: LucrareStepFormProps) {
  const queryClient = useQueryClient()
  const { lucrariPlanificate } = useSchemaFeatures()
  const { optiuni: cineOptiuni } = useCineOptiuni(open)
  const mode = editing ? 'edit' : 'create'
  const sariPesteTip = Boolean(editing || precompletare?.tip)
  const form = useStepForm({
    steps: STEPS,
    open,
    mode,
    initialStep: sariPesteTip ? 'detalii' : undefined,
    analytics: { moduleName: 'activitati' },
  })

  const [ciorna, setCiorna] = useState<CiornaLucrare>(CIORNA_GOALA)
  const [initialJson, setInitialJson] = useState('')
  const [cand, setCand] = useState<CandTip>('azi')
  const [zi, setZi] = useState<string | null>(null)
  const [vedere, setVedere] = useState<null | 'calendar' | 'renunta'>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ titlu: string; detaliu: string } | null>(null)
  const chei = useRef(new Map<string, string>())

  // Reset la o cheie nouă (aceleași intrări → același rezultat, chiar dacă rulează de două ori).
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    const start = startFrom(editing, precompletare, todayIso, lucrariPlanificate)
    setCiorna(start.ciorna)
    setInitialJson(JSON.stringify(start))
    setCand(start.cand)
    setZi(start.zi)
    setVedere(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
    // Cheile parcelelor sunt ale acestei deschideri; la următoarea, altele.
    chei.current = new Map()
  }, [open, form.clientSyncId])

  const cheiePentru = (parcelaId: string) => {
    const existenta = chei.current.get(parcelaId)
    if (existenta) return existenta
    const noua = generateClientId()
    chei.current.set(parcelaId, noua)
    return noua
  }

  const parceleSortate = useMemo(
    () => [...parcele].sort((a, b) => Number(b.rol !== 'personal') - Number(a.rol !== 'personal') || (a.nume_parcela ?? '').localeCompare(b.nume_parcela ?? '', 'ro')),
    [parcele],
  )
  const numeParcele = useMemo(() => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), [parcele])
  const lipsa = ceLipsesteLucrare(ciorna)
  const candObj: CandLucrare | null = cand === 'azi' ? { tip: 'azi' } : zi ? (cand === 'alta_zi' ? { tip: 'alta_zi', zi } : { tip: 'planifica', zi }) : null
  const planificareBlocata = cand === 'planifica' && !lucrariPlanificate
  const canSave = lipsa === null && candObj !== null && !planificareBlocata && !saving
  const dirty = JSON.stringify({ ciorna, cand, zi }) !== initialJson

  const save = async () => {
    if (!canSave || !candObj || !ciorna.tip) return
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        const lotId = editing.lotId ?? key
        const existente = new Set(editing.randuri.map((rand) => rand.parcela_id))
        const randuriNoi = randuriLucrareDeSalvat({
          ciorna: { ...ciorna, parcelaIds: ciorna.parcelaIds.filter((id) => !existente.has(id)) },
          cand: candObj,
          chei: new Map(ciorna.parcelaIds.map((id) => [id, cheiePentru(id)])),
          lotId,
          cuMigrare: lucrariPlanificate,
        })
        await modificaLucrare({
          randuri: editing.randuri,
          patch: {
            tip_activitate: VALOARE_LUCRARE_DB[ciorna.tip],
            operator: ciorna.cine.trim() || null,
            observatii: ciorna.nota.trim() || null,
            data_aplicare: dataAplicare(candObj),
            ...(lucrariPlanificate ? { status: candObj.tip === 'planifica' ? 'planificata' : null, lot_id: lotId } : {}),
          },
          parcelaIds: ciorna.parcelaIds,
          randuriNoi,
        })
      } else {
        const rows = randuriLucrareDeSalvat({
          ciorna,
          cand: candObj,
          chei: new Map(ciorna.parcelaIds.map((id) => [id, cheiePentru(id)])),
          lotId: key,
          cuMigrare: lucrariPlanificate,
        })
        await creeazaLucrari(rows)
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.lucrari })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      const unde = textParcele(ciorna.parcelaIds, numeParcele)
      setSaved(
        candObj.tip === 'planifica'
          ? { titlu: 'Planificată', detaliu: `${ETICHETA_LUCRARE[ciorna.tip]} ${ziCuDataRo(candObj.zi)} · ${unde}. Apare în Acasă în ziua ei.` }
          : { titlu: editing ? 'Modificată' : 'Salvată', detaliu: `${ETICHETA_LUCRARE[ciorna.tip]} · ${unde}` },
      )
      form.markSuccess({ tip: ciorna.tip, parcele: ciorna.parcelaIds.length, cand: candObj.tip, cine: Boolean(ciorna.cine.trim()) })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaveError(mesajEroare(error))
      form.markFailed()
    }
  }

  const close = () => onOpenChange(false)
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setVedere('renunta')
    return true
  }
  const handleBack = () => {
    if (vedere) {
      setVedere(null)
      return true
    }
    return false
  }

  const alegeCand = (next: CandTip) => {
    setCand(next)
    if (next === 'azi') return
    setZi((previous) => {
      if (next === 'alta_zi') return previous && previous < todayIso ? previous : addDaysIso(todayIso, -1)
      return previous && previous >= todayIso ? previous : addDaysIso(todayIso, 1)
    })
  }

  const cineAles = cineOptiuni.some((optiune) => optiune.value === ciorna.cine.trim()) ? ciorna.cine.trim() : ''

  let content: React.ReactNode = null
  let stepLabel: string | undefined
  if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>{editing ? 'Renunți la modificări?' : 'Renunți la lucrare?'}</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>{editing ? 'Lucrarea rămâne cum era salvată.' : 'Ce ai ales nu a fost salvat.'}</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere(null)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'calendar') {
    stepLabel = 'Ziua'
    content = (
      <div className="space-y-4">
        <StepFormTitle>{cand === 'planifica' ? 'Ce zi o faci?' : 'Ce zi ai făcut-o?'}</StepFormTitle>
        <CalendarPanel
          value={zi}
          onChange={(iso) => {
            setZi(iso)
            setVedere(null)
          }}
          min={cand === 'planifica' ? todayIso : undefined}
          max={cand === 'alta_zi' ? todayIso : undefined}
          shortcuts={
            cand === 'planifica'
              ? [
                  { label: 'Azi', value: todayIso },
                  { label: 'Mâine', value: addDaysIso(todayIso, 1) },
                  { label: 'Poimâine', value: addDaysIso(todayIso, 2) },
                ]
              : [
                  { label: 'Ieri', value: addDaysIso(todayIso, -1) },
                  { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
                ]
          }
        />
      </div>
    )
  } else if (form.stepKey === 'tip') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Ce lucrare?</StepFormTitle>
        <TileGroup
          type="single"
          aria-label="Lucrarea"
          value={ciorna.tip}
          onValueChange={(value) => setCiorna((previous) => ({ ...previous, tip: (value as TipLucrare | null) ?? null }))}
        >
          {TIPURI_LUCRARE.map((tip) => (
            <Tile key={tip} value={tip} size="sm" leading={ICON_LUCRARE[tip]} title={ETICHETA_LUCRARE[tip]} />
          ))}
        </TileGroup>
        <p className={cn('text-fg-muted', kitText.helper)}>Stropirile și fertirigarea se notează în Tratamente.</p>
      </div>
    )
  } else {
    content = (
      <div className="space-y-5">
        <StepFormTitle eyebrow={ciorna.tip ? ETICHETA_LUCRARE[ciorna.tip] : undefined}>Unde și când?</StepFormTitle>

        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}

        <section className="space-y-2.5" aria-labelledby="lucrare-unde">
          <h3 id="lucrare-unde" className={cn('font-bold text-fg', kitText.base)}>
            Parcelele
          </h3>
          {parceleSortate.length > 0 ? (
            <FilterPills
              multiple
              wrap
              aria-label="Parcelele lucrate"
              options={parceleSortate.map((parcela) => ({ value: parcela.id, label: parcela.nume_parcela?.trim() || 'Parcelă fără nume' }))}
              value={ciorna.parcelaIds}
              onValueChange={(parcelaIds) => setCiorna((previous) => ({ ...previous, parcelaIds }))}
            />
          ) : (
            <Notice tone="info" title="Nicio parcelă">
              Adaugă întâi o parcelă din Parcele.
            </Notice>
          )}
          {parceleSortate.length > 1 ? (
            <Button
              type="button"
              variant="quiet"
              size="touch"
              onClick={() =>
                setCiorna((previous) => ({
                  ...previous,
                  parcelaIds: previous.parcelaIds.length === parceleSortate.length ? [] : parceleSortate.map((parcela) => parcela.id),
                }))
              }
            >
              {ciorna.parcelaIds.length === parceleSortate.length ? 'Niciuna' : 'Toate parcelele'}
            </Button>
          ) : null}
        </section>

        <section className="space-y-2.5" aria-labelledby="lucrare-cand">
          <h3 id="lucrare-cand" className={cn('font-bold text-fg', kitText.base)}>
            Când
          </h3>
          <Segments
            aria-label="Când"
            options={[
              { value: 'azi', label: 'Azi' },
              { value: 'alta_zi', label: 'Altă zi' },
              { value: 'planifica', label: 'Planifică' },
            ]}
            value={cand}
            onValueChange={alegeCand}
          />
          {cand !== 'azi' ? (
            <ListRow
              avatar={false}
              leading={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
                  <CalendarDays />
                </span>
              }
              title={zi ? ZiCuDataRo(zi) : 'Alege ziua'}
              detail={cand === 'planifica' ? 'Ziua în care o faci' : 'Ziua în care ai făcut-o'}
              onClick={() => setVedere('calendar')}
            />
          ) : null}
          {planificareBlocata ? (
            <Notice tone="info" title="Planificarea nu e încă pornită">
              Se activează după actualizarea bazei de date. Până atunci poți nota lucrările făcute.
            </Notice>
          ) : cand === 'planifica' ? (
            <p className={cn('text-fg-muted', kitText.helper)}>Apare în Acasă la „De făcut azi” în ziua ei, cu „Marchează făcut”.</p>
          ) : null}
        </section>

        <section className="space-y-2.5" aria-labelledby="lucrare-cine">
          <h3 id="lucrare-cine" className={cn('font-bold text-fg', kitText.base)}>
            Cine <span className="font-normal text-fg-muted">(opțional)</span>
          </h3>
          {cineOptiuni.length > 0 ? (
            <FilterPills
              wrap
              aria-label="Cine a lucrat"
              options={[{ value: '', label: 'Nimeni ales' }, ...cineOptiuni.map((optiune) => ({ value: optiune.value, label: optiune.label }))]}
              value={cineAles}
              onValueChange={(value) => setCiorna((previous) => ({ ...previous, cine: value }))}
            />
          ) : null}
          <BigInput
            label="Alt nume"
            value={cineAles ? '' : ciorna.cine}
            onChange={(event) => setCiorna((previous) => ({ ...previous, cine: event.target.value }))}
            placeholder="ex. Ion Popescu"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={80}
          />
        </section>

        <BigTextarea
          label="Notă (opțional)"
          value={ciorna.nota}
          onChange={(event) => setCiorna((previous) => ({ ...previous, nota: event.target.value }))}
          placeholder="ex. rândurile 1–4, 20 min"
          rows={3}
          maxLength={500}
        />
      </div>
    )
  }

  const saveLabel = saving ? 'Se salvează…' : editing ? 'Salvează modificările' : cand === 'planifica' ? 'Planifică lucrarea' : 'Salvează lucrarea'

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? 'Editează lucrarea' : 'Lucrare nouă'}
      description="Tăiere, palisare, prășit, irigație și celelalte lucrări din fermă."
      stepLabel={stepLabel}
      onBack={handleBack}
      footer={
        vedere !== null
          ? null
          : form.stepKey === 'tip'
            ? { primary: { label: 'Continuă', onClick: () => form.next(), disabled: !ciorna.tip } }
            : { primary: { label: saveLabel, onClick: () => void save(), loading: saving, disabled: !canSave } }
      }
      success={saved ? <SuccessScreen title={saved.titlu} description={saved.detaliu} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}
