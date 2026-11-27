'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Camera, NotebookPen, Package } from 'lucide-react'

import {
  BigInput,
  Button,
  CalendarPanel,
  KgField,
  Notice,
  NumericKeypad,
  Segments,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  ToggleRow,
  addDaysIso,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import { AlegeProdus, ProdusNou, type ProdusRecent } from '@/components/tratamente/AlegeProdus'
import { BON_UNREADABLE_MESSAGE, prepareBonImage } from '@/lib/bonuri'
import { formatLei, relativeDayRo } from '@/lib/format-ro'
import { categorieCheltuiala, cheieDerivata, pretPeUnitate, textPretPeUnitate } from '@/lib/magazie/bani'
import { formatCantitateStoc, UNITATI_STOC, type UnitateStoc } from '@/lib/magazie/unitati'
import { cereConfirmare } from '@/lib/magazie/praguri'
import { queryKeys } from '@/lib/query-keys'
import { inregistreazaIntrare, type StocMagazie } from '@/lib/supabase/queries/magazie'
import { creeazaProdusFerma, type TipProdusNou } from '@/lib/supabase/queries/tratamente'
import type { ProdusCatalog } from '@/lib/tratamente/model'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

const STEPS = ['produs', 'cantitate'] as const
const FIELDS = ['cantitate', 'pret'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

type Vedere = null | 'produs-nou' | 'data' | 'furnizor' | 'renunta' | 'sigur'
type Bon = { blob: Blob; previewUrl: string } | null

function mesajEroare(error: unknown): string {
  const message = (error as { userMessage?: string } | null)?.userMessage || (error instanceof Error ? error.message : String(error ?? ''))
  if (NETWORK_ERROR.test(message)) return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: nu se dublează.'
  return message || 'Nu s-a salvat. Încearcă din nou.'
}

const unitateImplicita = (produs: Pick<ProdusCatalog, 'tip'> | null): UnitateStoc =>
  produs && ['fungicid', 'insecticid', 'acaricid', 'erbicid', 'bioregulator', 'foliar'].includes(produs.tip) ? 'l' : 'kg'

export interface AmCumparatStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todayIso: string
  catalog: readonly ProdusCatalog[]
  /** Stocul de acum: produsele deja în magazie își păstrează unitatea și apar sus. */
  stoc: readonly StocMagazie[]
  esteProprietar: boolean
  /** Din fișa produsului: formularul pornește direct la cantitate. */
  produsInitial?: string | null
}

/**
 * „+ Am cumpărat”: produsul (cu „Produs nou”, unde se pune și pauza), apoi cantitatea, unitatea, prețul total,
 * data, furnizorul, poza bonului și „Trece și la cheltuieli”. Operatorul nu vede prețul, bonul și comutatorul.
 * Cheia formularului e `client_sync_id` al mișcării; cheltuiala are cheia ei, aceeași cât e deschis formularul.
 */
export function AmCumparatStepForm({ open, onOpenChange, todayIso, catalog, stoc, esteProprietar, produsInitial = null }: AmCumparatStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, initialStep: produsInitial ? 'cantitate' : undefined, analytics: { moduleName: 'magazie' } })
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 6 })

  const catalogPeId = useMemo(() => new Map(catalog.map((produs) => [produs.id, produs])), [catalog])
  const stocPeProdus = useMemo(() => new Map(stoc.map((rand) => [rand.produs_id, rand])), [stoc])

  const [produs, setProdus] = useState<ProdusCatalog | null>(null)
  const [unitate, setUnitate] = useState<UnitateStoc>('kg')
  const [data, setData] = useState<string | null>(null)
  const [furnizor, setFurnizor] = useState('')
  const [treceLaCheltuieli, setTreceLaCheltuieli] = useState(true)
  const [bon, setBon] = useState<Bon>(null)
  const [bonPreparing, setBonPreparing] = useState(false)
  const [bonReadError, setBonReadError] = useState(false)
  const [vedere, setVedere] = useState<Vedere>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ titlu: string; detaliu: string } | null>(null)
  const bonInputRef = useRef<HTMLInputElement>(null)

  // ─── Reset la o cheie nouă (aceleași intrări → același rezultat, chiar dacă rulează de două ori) ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    fields.reset()
    const initial = produsInitial ? (catalogPeId.get(produsInitial) ?? null) : null
    setProdus(initial)
    const dinStoc = produsInitial ? stocPeProdus.get(produsInitial) : undefined
    setUnitate(dinStoc?.unitate ?? unitateImplicita(initial))
    setData(null)
    setFurnizor('')
    setTreceLaCheltuieli(true)
    setBon(null)
    setBonPreparing(false)
    setBonReadError(false)
    setVedere(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const previewUrl = bon?.previewUrl ?? null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const dinMagazie = produs ? stocPeProdus.get(produs.id) : undefined
  const unitateFixa = dinMagazie?.unitate ?? null
  const unitateEfectiva = unitateFixa ?? unitate
  const cantitate = fields.numbers.cantitate
  const pret = esteProprietar ? fields.numbers.pret : null
  const pretUnitar = pretPeUnitate(pret, cantitate)
  const zi = data ?? todayIso
  const canSave = Boolean(produs) && (cantitate ?? 0) > 0 && !saving && !bonPreparing

  const recente: ProdusRecent[] = useMemo(
    () =>
      stoc
        .map((rand) => ({ produs: catalogPeId.get(rand.produs_id) ?? null, rand }))
        .filter((item): item is { produs: ProdusCatalog; rand: StocMagazie } => item.produs !== null)
        .slice(0, 6)
        .map(({ produs: item, rand }) => ({ produs: item, nume: item.nume_comercial, ultima: `În magazie: ${formatCantitateStoc(rand.stoc, rand.unitate)}` })),
    [catalogPeId, stoc],
  )

  const alegeProdus = (ales: ProdusCatalog | null) => {
    if (!ales) return
    setProdus(ales)
    setUnitate(stocPeProdus.get(ales.id)?.unitate ?? unitateImplicita(ales))
    setVedere(null)
    if (form.stepKey === 'produs') form.next()
  }

  const salveazaProdusNou = async (input: { nume: string; tip: TipProdusNou; phiZile: number | null }) => {
    try {
      const nou = await creeazaProdusFerma(input)
      void queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
      alegeProdus(nou)
      return null
    } catch (error) {
      return mesajEroare(error)
    }
  }

  const onBonChosen = async (file: File | undefined) => {
    if (!file) return
    const key = form.clientSyncId
    setBonPreparing(true)
    setBonReadError(false)
    try {
      const blob = await prepareBonImage(file)
      if (liveKeyRef.current !== key) return
      setBon({ blob, previewUrl: URL.createObjectURL(blob) })
    } catch {
      if (liveKeyRef.current === key) setBonReadError(true)
    } finally {
      if (liveKeyRef.current === key) setBonPreparing(false)
    }
  }

  const save = async (confirmat = false) => {
    if (!canSave || !produs || cantitate === null) return
    // Promptul 34, §9: peste prag (kg > 2.000, l > 500, buc > 500), întâi „Sigur?”.
    if (!confirmat && cereConfirmare(cantitate, unitateEfectiva)) {
      setVedere('sigur')
      return
    }
    setVedere(null)
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      const rezultat = await inregistreazaIntrare({
        clientSyncId: key,
        // A doua cheie, pentru cheltuială: derivată din cheia formularului, deci aceeași la reîncercare.
        cheltuialaClientSyncId: cheieDerivata(key),
        produs: { id: produs.id, nume: produs.nume_comercial, tip: produs.tip },
        cantitate,
        unitate: unitateEfectiva,
        data: zi,
        pretTotal: pret,
        furnizor: furnizor.trim() || null,
        bon: esteProprietar ? (bon?.blob ?? null) : null,
        treceLaCheltuieli: esteProprietar && treceLaCheltuieli,
        esteProprietar,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.magazie })
      if (rezultat.cheltuialaCreata) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      }
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaved({
        titlu: 'Intrat în magazie',
        detaliu: [
          `${produs.nume_comercial} ${formatCantitateStoc(cantitate, unitateEfectiva, true)}`,
          rezultat.cheltuialaCreata && pret !== null ? `trecut la cheltuieli (${formatLei(pret)}, ${categorieCheltuiala(produs.tip)})` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })
      form.markSuccess({ unitate: unitateEfectiva, cu_pret: pret !== null, cheltuiala: rezultat.cheltuialaCreata, bon: rezultat.bonSalvat })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaveError(mesajEroare(error))
      form.markFailed()
    }
  }

  const close = () => onOpenChange(false)
  const dirty = Boolean(produs) || (cantitate ?? 0) > 0 || bon !== null
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

  let content: React.ReactNode = null
  let stepLabel: string | undefined
  if (vedere === 'sigur' && produs && cantitate !== null) {
    stepLabel = 'Verifică'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Sigur?</StepFormTitle>
        <p className={cn('break-words text-fg', kitText.base)}>
          {`${formatCantitateStoc(cantitate, unitateEfectiva, true)} de ${produs.nume_comercial}`}
        </p>
        <p className={cn('text-fg-muted', kitText.secondary)}>E mai mult decât se cumpără de obicei. Verifică cifra înainte să intre în magazie.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={saving} onClick={() => void save(true)}>
            Da, salvez
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setVedere(null)}>
            Corectez
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la cumpărătură?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Ce ai scris nu a fost salvat.</p>
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
  } else if (vedere === 'produs-nou') {
    stepLabel = 'Produs nou'
    content = <ProdusNou tipImplicit="ingrasamant" onSalveaza={salveazaProdusNou} />
  } else if (vedere === 'data') {
    stepLabel = 'Data'
    content = (
      <div className="space-y-4">
        <StepFormTitle>Ce zi ai cumpărat?</StepFormTitle>
        <CalendarPanel
          value={zi}
          onChange={(iso) => {
            setData(iso)
            setVedere(null)
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
  } else if (vedere === 'furnizor') {
    stepLabel = 'Furnizor'
    content = (
      <FurnizorChoice
        value={furnizor}
        onDone={(value) => {
          setFurnizor(value)
          setVedere(null)
        }}
      />
    )
  } else if (form.stepKey === 'produs') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Ce ai cumpărat?</StepFormTitle>
        <AlegeProdus catalog={catalog} recente={recente} doarZmeur={false} dejaAlese={new Set()} onAlege={alegeProdus} onProdusNou={() => setVedere('produs-nou')} />
      </div>
    )
  } else {
    const activ = fields.active
    content = (
      <div className="space-y-2.5">
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
          aria-label={produs ? `Produs: ${produs.nume_comercial}. Schimbă` : 'Alege produsul'}
          onClick={() => form.goTo('produs')}
        >
          <Package aria-hidden />
          <span className="truncate">{produs?.nume_comercial ?? 'Alege produsul'}</span>
        </Button>

        {unitateFixa ? (
          <p className={cn('px-1 text-fg-muted', kitText.secondary)}>
            În magazie: {formatCantitateStoc(dinMagazie?.stoc ?? 0, unitateFixa)} · se ține în {unitateFixa}
          </p>
        ) : (
          <Segments
            aria-label="Unitatea"
            options={UNITATI_STOC.map((value) => ({ value, label: value === 'buc' ? 'bucăți' : value }))}
            value={unitate}
            onValueChange={setUnitate}
          />
        )}

        <div className={cn('grid gap-2', esteProprietar ? 'grid-cols-2' : 'grid-cols-1')}>
          <KgField
            label="Cantitate"
            unit={unitateEfectiva}
            value={fields.values.cantitate}
            active={activ === 'cantitate'}
            onActivate={() => fields.setActive('cantitate')}
            size="md"
          />
          {esteProprietar ? (
            <KgField label="Preț total" unit="lei" value={fields.values.pret} active={activ === 'pret'} onActivate={() => fields.setActive('pret')} size="md" />
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="quiet" size="touch" className="min-w-0 px-2" aria-label={`Data: ${relativeDayRo(zi, todayIso)}. Schimbă`} onClick={() => setVedere('data')}>
            <CalendarDays aria-hidden />
            <span className="truncate">{relativeDayRo(zi, todayIso)}</span>
          </Button>
          <Button type="button" variant="quiet" size="touch" className="min-w-0 px-2" aria-label={furnizor ? `Furnizor: ${furnizor}. Schimbă` : 'Adaugă furnizorul (opțional)'} onClick={() => setVedere('furnizor')}>
            <NotebookPen aria-hidden />
            <span className="truncate">{furnizor || 'Furnizor'}</span>
          </Button>
        </div>

        {esteProprietar ? (
          <>
            <BonRand bon={bon} preparing={bonPreparing} disabled={saving} onPick={() => bonInputRef.current?.click()} onRemove={() => setBon(null)} />
            {bonReadError ? <Notice tone="danger" title={BON_UNREADABLE_MESSAGE} /> : null}
            <ToggleRow
              title="Trece și la cheltuieli"
              subtitle={
                pret && pret > 0
                  ? `categoria „${categorieCheltuiala(produs?.tip)}”, ${formatLei(pret)}`
                  : `categoria „${categorieCheltuiala(produs?.tip)}”, când scrii prețul`
              }
              checked={treceLaCheltuieli}
              onCheckedChange={setTreceLaCheltuieli}
            />
            <input
              ref={bonInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void onBonChosen(file)
              }}
            />
          </>
        ) : null}
      </div>
    )
  }

  const showKeypad = form.stepKey === 'cantitate' && vedere === null

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Am cumpărat"
      description="Produsul, cantitatea și, dacă vrei, prețul și bonul."
      stepLabel={stepLabel}
      onBack={handleBack}
      dock={showKeypad ? <NumericKeypad onKey={fields.press} disabled={saving} aria-label="Tastatură pentru cantitate și preț" /> : undefined}
      footer={
        showKeypad
          ? {
              primary: {
                label: saving ? 'Se salvează…' : pretUnitar !== null ? `Salvează · ${textPretPeUnitate(pretUnitar, unitateEfectiva)}` : 'Salvează',
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
            title={saved.titlu}
            description={saved.detaliu}
            primaryAction={{ label: 'Gata', onClick: close }}
            secondaryAction={{ label: 'Încă o cumpărătură', onClick: () => form.restart() }}
          />
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}

function BonRand({ bon, preparing, disabled, onPick, onRemove }: { bon: Bon; preparing: boolean; disabled: boolean; onPick: () => void; onRemove: () => void }) {
  if (!bon) {
    return (
      <Button type="button" variant="quiet" size="touch" className="w-full" loading={preparing} disabled={disabled} aria-label="Adaugă poza bonului (opțional)" onClick={onPick}>
        {preparing ? null : <Camera aria-hidden />}
        {preparing ? 'Se pregătește poza…' : '+ Poza bonului'}
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Poza bonului">
      <span className="flex size-touch shrink-0 items-center justify-center overflow-hidden rounded-box border border-border bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatură din `blob:` */}
        <img src={bon.previewUrl} alt="Poza bonului" className="size-full object-cover" />
      </span>
      <Button type="button" variant="neutral" size="touch" className="min-w-0 flex-1 px-3" disabled={disabled} onClick={onPick}>
        Schimbă
      </Button>
      <Button type="button" variant="quiet" size="touch" className="min-w-0 flex-1 px-3" disabled={disabled} onClick={onRemove}>
        Scoate
      </Button>
    </div>
  )
}

function FurnizorChoice({ value, onDone }: { value: string; onDone: (value: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(text.trim())
      }}
    >
      <StepFormTitle>De la cine ai cumpărat?</StepFormTitle>
      <BigInput label="Furnizor (opțional)" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" maxLength={120} placeholder="ex. Agrosem Suceava" autoFocus />
      <Button type="submit" variant="primary" size="touch-lg" className="w-full">
        Gata
      </Button>
    </form>
  )
}
