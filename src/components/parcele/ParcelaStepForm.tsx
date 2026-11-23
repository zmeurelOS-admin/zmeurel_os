'use client'

import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LocateFixed } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  Button,
  FilterPills,
  Notice,
  Segments,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  ToggleRow,
  kitText,
  useStepForm,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { ETICHETA_TIP_UNITATE, ORDINE_TIP_UNITATE } from '@/lib/parcele/card'
import { SCOP_LABELS, type ParcelaScop, type StatusOperational } from '@/lib/parcele/dashboard-relevance'
import {
  draftDinParcela,
  draftParcelaNoua,
  eroriParcela,
  implicitePentruScop,
  payloadParcela,
  type ParcelaDraft,
} from '@/lib/parcele/formular-parcela'
import { getCulturiOptionsForTip, getParcelStatusOperationalOptions, getParcelStatusOptions, getSoiOptionsForCultura, MANUAL_CULTURE_OPTION_VALUE, MANUAL_VARIETY_OPTION_VALUE } from '@/lib/parcele/parcel-form-options'
import type { UnitateTip } from '@/lib/parcele/unitate'
import { queryKeys } from '@/lib/query-keys'
import { useSchemaFeatures } from '@/lib/schema-features'
import { createParcela, updateParcela, type Parcela } from '@/lib/supabase/queries/parcele'
import { asiguraProdusCultura } from '@/lib/supabase/queries/produse-cultura'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface ParcelaStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editare: parcela, cu volumul de soluție (din `getVolumeParcele`). */
  editing?: (Parcela & { volum_solutie_l?: number | null }) | null
  /** După salvare (id-ul parcelei). */
  onSaved?: (parcelaId: string) => void
}

const STEPS = ['parcela'] as const
const generateParcelCode = () => `PAR-${Date.now().toString().slice(-6)}`

function mesajEroare(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = (error as { code?: string } | null)?.code
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)) return 'Nu există conexiune la internet. Verifică și apasă din nou „Salvează”.'
  if (code === '42501' || /row-level security/i.test(message)) return 'Nu ai drept de scriere pe parcele. Cere-i proprietarului fermei acces.'
  return message || 'Parcela nu s-a salvat. Încearcă din nou.'
}

/**
 * Parcelă nouă sau editare, pe un singur ecran: nume, tip, cultură + soi, plante, suprafață, volumul de soluție
 * la o stropire, „Pentru: Comercial / Personal”. Câmpurile rar folosite stau sub „Mai multe detalii”.
 */
export function ParcelaStepForm({ open, onOpenChange, editing = null, onSaved }: ParcelaStepFormProps) {
  const queryClient = useQueryClient()
  const { tratamenteLot: cuVolum } = useSchemaFeatures()
  const mode = editing ? 'edit' : 'create'
  const form = useStepForm({ steps: STEPS, open, mode, analytics: { moduleName: 'parcele' } })
  const an = new Date().getFullYear()

  const [draft, setDraft] = useState<ParcelaDraft>(() => draftParcelaNoua(an))
  const [initialJson, setInitialJson] = useState('')
  const [maiMulte, setMaiMulte] = useState(false)
  const [culturaManuala, setCulturaManuala] = useState(false)
  const [soiManual, setSoiManual] = useState(false)
  const [atins, setAtins] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [geo, setGeo] = useState<'idle' | 'loading' | 'error'>('idle')
  const inFlight = useRef(false)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    const next = editing ? draftDinParcela(editing, an) : draftParcelaNoua(an)
    setDraft(next)
    setInitialJson(JSON.stringify(next))
    const culturiCunoscute = getCulturiOptionsForTip(next.tip).map((option) => option.value)
    setCulturaManuala(Boolean(next.cultura) && !culturiCunoscute.includes(next.cultura))
    const soiuriCunoscute = getSoiOptionsForCultura(next.cultura).map((option) => option.value)
    setSoiManual(Boolean(next.soi) && !soiuriCunoscute.includes(next.soi))
    setMaiMulte(false)
    setAtins(false)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
    setGeo('idle')
  }

  const set = <K extends keyof ParcelaDraft>(key: K, value: ParcelaDraft[K]) => setDraft((previous) => ({ ...previous, [key]: value }))
  const erori = eroriParcela(draft)
  const areErori = Object.keys(erori).length > 0
  const dirty = JSON.stringify(draft) !== initialJson
  const solar = draft.tip === 'solar'

  const culturaOptiuni = useMemo(() => getCulturiOptionsForTip(draft.tip).filter((option) => option.value !== MANUAL_CULTURE_OPTION_VALUE), [draft.tip])
  const soiOptiuni = useMemo(() => getSoiOptionsForCultura(draft.cultura).filter((option) => option.value !== MANUAL_VARIETY_OPTION_VALUE), [draft.cultura])
  const scopOptiuni: Array<{ value: ParcelaScop; label: string }> = [
    { value: 'comercial', label: 'Comercial' },
    { value: 'personal', label: 'Personal' },
    ...(draft.rol === 'experimental' || draft.rol === 'inactiv' ? [{ value: draft.rol, label: draft.rol === 'experimental' ? 'Experimental' : 'Inactiv' }] : []),
  ]

  const save = async () => {
    setAtins(true)
    if (areErori || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const payload = payloadParcela(draft, { cuVolum, observatiiVechi: editing?.observatii ?? null })
      const parcela = editing
        ? await updateParcela(editing.id, payload)
        : await createParcela({ ...payload, id_parcela: generateParcelCode(), nume_parcela: payload.nume_parcela ?? draft.nume.trim(), suprafata_m2: payload.suprafata_m2 ?? 0, an_plantare: payload.an_plantare ?? an })
      void queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
      void queryClient.invalidateQueries({ queryKey: queryKeys.volumeParcele })
      // Prima parcelă dintr-o cultură: produsul „<Cultură> proaspătă” al fermei, pentru comenzi (nefatal, idempotent).
      void asiguraProdusCultura(parcela.cultura ?? draft.cultura).then((id) => {
        if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.produse })
      })
      if (!editing) track('parcela_add', { suprafata: payload.suprafata_m2 ?? 0, tip_unitate: draft.tip })
      hapticSuccess()
      setSaved(parcela.nume_parcela ?? draft.nume.trim())
      form.markSuccess({ tip_unitate: draft.tip, rol: draft.rol })
      onSaved?.(parcela.id)
    } catch (error) {
      hapticError()
      setSaveError(mesajEroare(error))
      form.markFailed()
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const alegeTip = (tip: UnitateTip) => {
    setDraft((previous) => {
      const culturiCunoscute = getCulturiOptionsForTip(tip).map((option) => option.value)
      const pastreaza = tip !== 'solar' && (culturaManuala || culturiCunoscute.includes(previous.cultura))
      return { ...previous, tip, cultura: pastreaza ? previous.cultura : '', soi: pastreaza ? previous.soi : '' }
    })
    if (tip === 'solar') {
      setCulturaManuala(false)
      setSoiManual(false)
    }
  }

  const alegeScop = (rol: ParcelaScop) => {
    const implicite = implicitePentruScop(rol)
    setDraft((previous) => ({ ...previous, rol, ...implicite }))
  }

  const folosesteLocatia = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo('error')
      return
    }
    setGeo('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((previous) => ({ ...previous, latitudine: String(position.coords.latitude), longitudine: String(position.coords.longitude) }))
        setGeo('idle')
      },
      () => setGeo('error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const close = () => onOpenChange(false)
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setConfirmingClose(true)
    return true
  }

  const arata = (camp: keyof typeof erori) => (atins || draft[camp as keyof ParcelaDraft] !== '' ? erori[camp] : undefined)

  const content = confirmingClose ? (
    <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
      <StepFormTitle>{editing ? 'Renunți la modificări?' : 'Renunți la parcelă?'}</StepFormTitle>
      <p className={cn('text-fg-muted', kitText.base)}>{editing ? 'Parcela rămâne cum era salvată.' : 'Ce ai scris nu a fost salvat.'}</p>
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
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <StepFormTitle>{editing ? 'Editează parcela' : 'Parcelă nouă'}</StepFormTitle>

      {saveError ? (
        <Notice tone="danger" title="Parcela nu s-a salvat">
          {saveError}
        </Notice>
      ) : null}

      <BigInput
        label="Nume"
        value={draft.nume}
        onChange={(event) => set('nume', event.target.value)}
        placeholder="ex. Maravilla 1"
        autoComplete="off"
        autoCapitalize="sentences"
        maxLength={80}
        error={arata('nume')}
      />

      <Field label="Tip">
        <FilterPills
          wrap
          aria-label="Tipul parcelei"
          options={ORDINE_TIP_UNITATE.map((tip) => ({ value: tip, label: ETICHETA_TIP_UNITATE[tip] }))}
          value={draft.tip}
          onValueChange={alegeTip}
        />
      </Field>

      {solar ? (
        <p className={cn('rounded-box bg-surface-muted px-4 py-3 text-fg-muted', kitText.secondary)}>
          La solarii, culturile (roșii, castraveți …) se adaugă din fișa parcelei, după salvare.
        </p>
      ) : (
        <>
          <Field label="Cultură">
            <FilterPills
              wrap
              aria-label="Cultura"
              options={[...culturaOptiuni.map((option) => ({ value: option.value, label: option.label })), { value: MANUAL_CULTURE_OPTION_VALUE, label: 'Alta' }]}
              value={culturaManuala ? MANUAL_CULTURE_OPTION_VALUE : draft.cultura}
              onValueChange={(value) => {
                if (value === MANUAL_CULTURE_OPTION_VALUE) {
                  setCulturaManuala(true)
                  setSoiManual(true)
                  setDraft((previous) => ({ ...previous, cultura: '', soi: '' }))
                  return
                }
                setCulturaManuala(false)
                setSoiManual(false)
                setDraft((previous) => ({ ...previous, cultura: value, soi: '' }))
              }}
            />
            {culturaManuala ? (
              <BigInput aria-label="Cultura, scrisă de tine" value={draft.cultura} onChange={(event) => set('cultura', event.target.value)} placeholder="ex. Aronia" autoComplete="off" maxLength={60} />
            ) : null}
          </Field>

          {draft.cultura.trim() ? (
            <Field label="Soi">
              {!culturaManuala && soiOptiuni.length > 0 ? (
                <FilterPills
                  wrap
                  aria-label="Soiul"
                  options={[...soiOptiuni.map((option) => ({ value: option.value, label: option.label })), { value: MANUAL_VARIETY_OPTION_VALUE, label: 'Alt soi' }]}
                  value={soiManual ? MANUAL_VARIETY_OPTION_VALUE : draft.soi}
                  onValueChange={(value) => {
                    if (value === MANUAL_VARIETY_OPTION_VALUE) {
                      setSoiManual(true)
                      set('soi', '')
                      return
                    }
                    setSoiManual(false)
                    set('soi', value)
                  }}
                />
              ) : null}
              {soiManual || culturaManuala || soiOptiuni.length === 0 ? (
                <BigInput aria-label="Soiul, scris de tine" value={draft.soi} onChange={(event) => set('soi', event.target.value)} placeholder="ex. Maravilla" autoComplete="off" maxLength={60} />
              ) : null}
            </Field>
          ) : null}
        </>
      )}

      <div className={cn('grid gap-3', solar ? 'grid-cols-1' : 'grid-cols-2')}>
        {!solar ? (
          <BigInput
            label={draft.tip === 'livada' ? 'Pomi' : 'Plante'}
            value={draft.plante}
            onChange={(event) => set('plante', event.target.value)}
            inputMode="numeric"
            placeholder="ex. 500"
            autoComplete="off"
            error={arata('plante')}
          />
        ) : null}
        <BigInput
          label="Suprafață (m²)"
          value={draft.suprafata}
          onChange={(event) => set('suprafata', event.target.value)}
          inputMode="decimal"
          placeholder="ex. 700"
          autoComplete="off"
          error={arata('suprafata')}
        />
      </div>

      {cuVolum ? (
        <BigInput
          label="Volum de soluție la o stropire (l)"
          hint="Se propune singur la tratamente. Gol = se învață la prima stropire."
          value={draft.volum}
          onChange={(event) => set('volum', event.target.value)}
          inputMode="decimal"
          placeholder="ex. 60"
          autoComplete="off"
          error={arata('volum')}
        />
      ) : null}

      <Field label="Pentru">
        <Segments aria-label="Pentru" options={scopOptiuni} value={draft.rol} onValueChange={alegeScop} />
        <p className={cn('text-fg-muted', kitText.helper)}>
          {draft.rol === 'comercial'
            ? 'Intră în kg vândute, venit și stoc.'
            : draft.rol === 'personal'
              ? '„Personal” scoate parcela din kg vândute, venit și stoc, dar o păstrează la tratamente și lucrări.'
              : SCOP_LABELS[draft.rol]}
        </p>
      </Field>

      <Button type="button" variant="quiet" size="touch" className="w-full justify-between" aria-expanded={maiMulte} onClick={() => setMaiMulte((value) => !value)}>
        Mai multe detalii
        <ChevronDown className={cn('transition-transform', maiMulte && 'rotate-180')} aria-hidden />
      </Button>

      {maiMulte ? (
        <div className="space-y-5">
          <Field label="Situația">
            <FilterPills
              wrap
              aria-label="Situația operațională"
              options={getParcelStatusOperationalOptions().map((option) => ({ value: option.value as StatusOperational, label: option.label }))}
              value={draft.statusOperational}
              onValueChange={(value) => set('statusOperational', value)}
            />
          </Field>
          <Field label="Status">
            <FilterPills
              wrap
              aria-label="Statusul parcelei"
              options={getParcelStatusOptions().map((option) => ({ value: option.value, label: option.label }))}
              value={draft.status}
              onValueChange={(value) => set('status', value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <BigInput label="An plantare" value={draft.anPlantare} onChange={(event) => set('anPlantare', event.target.value)} inputMode="numeric" autoComplete="off" error={arata('anPlantare')} />
            <BigInput label="Data plantării" type="date" value={draft.dataPlantarii} onChange={(event) => set('dataPlantarii', event.target.value)} error={arata('dataPlantarii')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BigInput label="Rânduri" value={draft.randuri} onChange={(event) => set('randuri', event.target.value)} inputMode="numeric" autoComplete="off" error={arata('randuri')} />
            <BigInput label="Între rânduri (m)" value={draft.distanta} onChange={(event) => set('distanta', event.target.value)} inputMode="decimal" autoComplete="off" error={arata('distanta')} />
          </div>
          <BigInput label="Irigare" value={draft.irigare} onChange={(event) => set('irigare', event.target.value)} placeholder="ex. picurare" autoComplete="off" maxLength={80} />
          <ToggleRow
            title="Apare în Acasă"
            subtitle="Pe pagina principală, la recoltare și tratamente"
            checked={draft.apareInDashboard}
            disabled={draft.rol !== 'comercial'}
            onCheckedChange={(value) => set('apareInDashboard', value)}
          />
          <ToggleRow
            title="Contribuie la producție și vânzări"
            subtitle="Intră în rapoartele comerciale"
            checked={draft.contribuieLaProductie}
            disabled={draft.rol !== 'comercial'}
            onCheckedChange={(value) => set('contribuieLaProductie', value)}
          />
          <Field label="Locația (pentru vreme)">
            <div className="grid grid-cols-2 gap-3">
              <BigInput aria-label="Latitudine" placeholder="Latitudine" value={draft.latitudine} onChange={(event) => set('latitudine', event.target.value)} inputMode="decimal" autoComplete="off" error={arata('latitudine')} />
              <BigInput aria-label="Longitudine" placeholder="Longitudine" value={draft.longitudine} onChange={(event) => set('longitudine', event.target.value)} inputMode="decimal" autoComplete="off" error={arata('longitudine')} />
            </div>
            <Button type="button" variant="neutral" size="touch" className="w-full" loading={geo === 'loading'} onClick={folosesteLocatia}>
              <LocateFixed aria-hidden />
              Folosește locația de acum
            </Button>
            {geo === 'error' ? <p className={cn('text-warning-text', kitText.helper)}>Locația nu e disponibilă. Poți scrie coordonatele de mână.</p> : null}
          </Field>
          <BigTextarea label="Observații" value={draft.observatii} onChange={(event) => set('observatii', event.target.value)} rows={3} maxLength={1000} />
        </div>
      ) : null}

      {/* Sub câmpuri, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={saving || (atins && areErori)} loading={saving}>
        {saving ? 'Se salvează…' : 'Salvează'}
      </Button>
    </form>
  )

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? 'Editează parcela' : 'Parcelă nouă'}
      description="Nume, tip, cultură, plante, suprafață, volumul de soluție și scopul parcelei."
      stepLabel={confirmingClose ? 'Nesalvat' : editing ? 'Editare' : 'Parcelă'}
      onBack={() => {
        if (!confirmingClose) return false
        setConfirmingClose(false)
        return true
      }}
      success={saved ? <SuccessScreen title={editing ? 'Modificată' : 'Parcelă salvată'} description={saved} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className={cn('font-bold text-fg', kitText.base)}>{label}</p>
      {children}
    </div>
  )
}
