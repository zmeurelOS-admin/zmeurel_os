'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { BigInput, BigTextarea, Button, FilterPills, Notice, StepForm, StepFormTitle, SuccessScreen, kitText, useStepForm } from '@/components/kit'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { getCulturaFieldConfig, getCulturiOptions, getSoiPlaceholder, getTipPlantaPlaceholder } from '@/lib/parcele/culturi'
import { numarRo } from '@/lib/parcele/formular-parcela'
import { queryKeys } from '@/lib/query-keys'
import { createCultura } from '@/lib/supabase/queries/culturi'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface CulturaStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId: string
  parcelaNume: string
  tipUnitate: string | null | undefined
}

const STEPS = ['cultura'] as const
const ALTA = '__alta__'

type Draft = {
  tip: string
  manual: boolean
  soi: string
  suprafata: string
  plante: string
  randuri: string
  distanta: string
  irigare: string
  dataPlantarii: string
  interval: string
  observatii: string
}

const GOL: Draft = { tip: '', manual: false, soi: '', suprafata: '', plante: '', randuri: '', distanta: '', irigare: '', dataPlantarii: '', interval: '14', observatii: '' }

/** O cultură nouă într-un solar (tabelul `culturi`), cu aceleași câmpuri ca formularul de dinainte. */
export function CulturaStepForm({ open, onOpenChange, parcelaId, parcelaNume, tipUnitate }: CulturaStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: false })
  const config = getCulturaFieldConfig(tipUnitate)
  const optiuni = getCulturiOptions(tipUnitate).filter((value) => value !== 'Altele')
  const [draft, setDraft] = useState<Draft>(GOL)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setDraft(GOL)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }))
  const intreg = (value: string) => {
    const n = numarRo(value)
    return n === null ? null : Number.isInteger(n) && n > 0 ? n : Number.NaN
  }
  const pozitiv = (value: string) => {
    const n = numarRo(value)
    return n === null ? null : Number.isFinite(n) && n > 0 ? n : Number.NaN
  }
  const valori = {
    suprafata: pozitiv(draft.suprafata),
    plante: intreg(draft.plante),
    randuri: intreg(draft.randuri),
    distanta: pozitiv(draft.distanta),
    interval: intreg(draft.interval),
  }
  const invalid = Object.values(valori).some((value) => value !== null && Number.isNaN(value))
  const canSave = draft.tip.trim().length > 0 && !invalid && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      await createCultura({
        solar_id: parcelaId,
        tip_planta: draft.tip.trim(),
        soi: draft.soi.trim() || undefined,
        suprafata_ocupata: valori.suprafata ?? undefined,
        nr_plante: valori.plante ?? undefined,
        nr_randuri: config.showRowCount ? (valori.randuri ?? undefined) : undefined,
        distanta_intre_randuri: config.showRowSpacing ? (valori.distanta ?? undefined) : undefined,
        sistem_irigare: draft.irigare.trim() || undefined,
        data_plantarii: draft.dataPlantarii || undefined,
        interval_tratament_zile: valori.interval ?? undefined,
        observatii: draft.observatii.trim() || undefined,
      })
      trackEvent({ eventName: 'entity_created', moduleName: 'culturi', status: 'success', metadata: { entity: 'cultura', source: 'CulturaStepForm' } })
      void queryClient.invalidateQueries({ queryKey: queryKeys.culturi(parcelaId) })
      void queryClient.invalidateQueries({ queryKey: ['culturi-counts'] })
      hapticSuccess()
      setSaved([draft.tip.trim(), draft.soi.trim()].filter(Boolean).join(' · '))
      form.markSuccess()
    } catch (error) {
      hapticError()
      setSaveError(error instanceof Error && error.message ? error.message : 'Cultura nu s-a salvat. Încearcă din nou.')
      form.markFailed()
    } finally {
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)
  const eroare = (value: number | null, text: string) => (value !== null && Number.isNaN(value) ? text : undefined)

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      title="Cultură nouă"
      description="O cultură în solar: plantă, soi, plante, suprafață."
      stepLabel="Cultură nouă"
      success={saved ? <SuccessScreen title="Cultură adăugată" description={saved} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <StepFormTitle eyebrow={parcelaNume}>Cultură nouă</StepFormTitle>
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}

        <div className="space-y-2.5">
          <p className={cn('font-bold text-fg', kitText.base)}>Planta</p>
          <FilterPills
            wrap
            aria-label="Planta"
            options={[...optiuni.map((value) => ({ value, label: value })), { value: ALTA, label: 'Alta' }]}
            value={draft.manual ? ALTA : draft.tip}
            onValueChange={(value) => setDraft((previous) => (value === ALTA ? { ...previous, manual: true, tip: '' } : { ...previous, manual: false, tip: value }))}
          />
          {draft.manual ? (
            <BigInput aria-label="Planta, scrisă de tine" value={draft.tip} onChange={(event) => set('tip', event.target.value)} placeholder={getTipPlantaPlaceholder(tipUnitate)} autoComplete="off" maxLength={60} />
          ) : null}
        </div>

        <BigInput label="Soi" value={draft.soi} onChange={(event) => set('soi', event.target.value)} placeholder={getSoiPlaceholder(draft.tip) || 'ex. Siriana F1'} autoComplete="off" maxLength={60} />

        <div className="grid grid-cols-2 gap-3">
          <BigInput label={config.plantCountLabel} value={draft.plante} onChange={(event) => set('plante', event.target.value)} inputMode="numeric" autoComplete="off" error={eroare(valori.plante, 'Un număr întreg.')} />
          <BigInput label="Suprafață (m²)" value={draft.suprafata} onChange={(event) => set('suprafata', event.target.value)} inputMode="decimal" autoComplete="off" error={eroare(valori.suprafata, 'Un număr pozitiv.')} />
        </div>

        {config.showRowCount || config.showRowSpacing ? (
          <div className="grid grid-cols-2 gap-3">
            {config.showRowCount ? (
              <BigInput label={config.rowCountLabel} value={draft.randuri} onChange={(event) => set('randuri', event.target.value)} inputMode="numeric" autoComplete="off" error={eroare(valori.randuri, 'Un număr întreg.')} />
            ) : null}
            {config.showRowSpacing ? (
              <BigInput label={config.rowSpacingLabel} value={draft.distanta} onChange={(event) => set('distanta', event.target.value)} inputMode="decimal" autoComplete="off" error={eroare(valori.distanta, 'Un număr pozitiv.')} />
            ) : null}
          </div>
        ) : null}

        <BigInput label="Irigare" value={draft.irigare} onChange={(event) => set('irigare', event.target.value)} placeholder="ex. picurare" autoComplete="off" maxLength={80} />
        <div className="grid grid-cols-2 gap-3">
          <BigInput label="Data plantării" type="date" value={draft.dataPlantarii} onChange={(event) => set('dataPlantarii', event.target.value)} />
          <BigInput label="Tratament la (zile)" value={draft.interval} onChange={(event) => set('interval', event.target.value)} inputMode="numeric" autoComplete="off" error={eroare(valori.interval, 'Un număr întreg.')} />
        </div>
        <BigTextarea label="Observații" value={draft.observatii} onChange={(event) => set('observatii', event.target.value)} rows={2} maxLength={500} />

        <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={!canSave} loading={saving}>
          {saving ? 'Se salvează…' : 'Salvează cultura'}
        </Button>
      </form>
    </StepForm>
  )
}
