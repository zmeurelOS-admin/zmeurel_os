'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'

import {
  BigTextarea,
  CalendarPanel,
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
import { getCohortaLabel, type Cohorta } from '@/lib/parcele/configurare-sezon'
import { getLabelPentruGrup, listStadiiPentruGrup, type GrupBiologic, type StadiuCod } from '@/lib/parcele/stadii-canonic'
import { queryKeys } from '@/lib/query-keys'
import { createParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { ZiCuDataRo } from '@/lib/tratamente/zile'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface StadiuStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId: string
  parcelaNume: string
  grup: GrupBiologic | null
  /** Soi remontant (floricane + primocane): stadiul se notează pe cohortă. */
  mixt: boolean
  an: number
  todayIso: string
}

const STEPS = ['stadiu'] as const

/**
 * „Actualizează stadiul”: la soiurile remontante întâi cohorta (floricane / primocane), apoi stadiul din lista
 * canonică a culturii, pe plăci; data azi, implicit. Se salvează în `stadii_fenologice_parcela` (cu `cohort`),
 * prin aceeași funcție ca până acum.
 */
export function StadiuStepForm({ open, onOpenChange, parcelaId, parcelaNume, grup, mixt, an, todayIso }: StadiuStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: false })
  const [cohort, setCohort] = useState<Cohorta>('floricane')
  const [stadiu, setStadiu] = useState<StadiuCod | null>(null)
  const [zi, setZi] = useState(todayIso)
  const [nota, setNota] = useState('')
  const [calendar, setCalendar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setCohort('floricane')
    setStadiu(null)
    setZi(todayIso)
    setNota('')
    setCalendar(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const stadii = useMemo(() => listStadiiPentruGrup(grup), [grup])
  const eticheta = (cod: StadiuCod) => getLabelPentruGrup(cod, grup, { cohort: mixt ? cohort : null })

  const save = async () => {
    if (!stadiu || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await createParcelaStadiuCanonic({
        parcela_id: parcelaId,
        an,
        stadiu,
        cohort: mixt ? cohort : null,
        data_observata: zi,
        observatii: nota.trim() || undefined,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stadiiFerma(an) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
      hapticSuccess()
      const nume = eticheta(stadiu)
      const cuCohorta = mixt && !nume.toLocaleLowerCase('ro-RO').includes(cohort) ? `${getCohortaLabel(cohort)}: ${nume}` : nume
      setSaved(`${cuCohorta} · ${ZiCuDataRo(zi)}`)
      form.markSuccess()
    } catch (error) {
      hapticError()
      const message = error instanceof Error ? error.message : ''
      setSaveError(/row-level security|42501/i.test(message) ? 'Nu ai drept de scriere pe parcele.' : message || 'Stadiul nu s-a salvat. Încearcă din nou.')
      form.markFailed()
    } finally {
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)

  const content = calendar ? (
    <div className="space-y-4">
      <StepFormTitle>Ce zi?</StepFormTitle>
      <CalendarPanel
        value={zi}
        max={todayIso}
        onChange={(iso) => {
          setZi(iso)
          setCalendar(false)
        }}
        shortcuts={[
          { label: 'Azi', value: todayIso },
          { label: 'Ieri', value: addDaysIso(todayIso, -1) },
          { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
        ]}
      />
    </div>
  ) : (
    <div className="space-y-5">
      <StepFormTitle eyebrow={parcelaNume}>Stadiul de acum</StepFormTitle>

      {saveError ? (
        <Notice tone="danger" title="Nu s-a salvat">
          {saveError}
        </Notice>
      ) : null}

      {mixt ? (
        <div className="space-y-2.5">
          <p className={cn('font-bold text-fg', kitText.base)}>Pentru</p>
          <Segments
            aria-label="Cohorta"
            options={[
              { value: 'floricane', label: 'Floricane' },
              { value: 'primocane', label: 'Primocane' },
            ]}
            value={cohort}
            onValueChange={setCohort}
          />
        </div>
      ) : null}

      <TileGroup type="single" aria-label="Stadiul" value={stadiu} onValueChange={(value) => setStadiu((value as StadiuCod | null) ?? null)}>
        {stadii.map((cod) => (
          <Tile key={cod} value={cod} size="sm" title={eticheta(cod)} />
        ))}
      </TileGroup>

      <ListRow
        avatar={false}
        leading={
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
            <CalendarDays />
          </span>
        }
        title={zi === todayIso ? `Azi, ${ZiCuDataRo(zi).split(' ')[1]}` : ZiCuDataRo(zi)}
        detail="Data"
        onClick={() => setCalendar(true)}
      />

      <BigTextarea label="Notă (opțional)" value={nota} onChange={(event) => setNota(event.target.value)} rows={2} maxLength={300} />
    </div>
  )

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      title={`Stadiul · ${parcelaNume}`}
      description="Stadiul de acum al parcelei, din lista culturii."
      stepLabel={calendar ? 'Ziua' : 'Stadiul'}
      onBack={() => {
        if (!calendar) return false
        setCalendar(false)
        return true
      }}
      footer={calendar ? null : { primary: { label: saving ? 'Se salvează…' : 'Salvează stadiul', onClick: () => void save(), loading: saving, disabled: !stadiu || saving } }}
      success={saved ? <SuccessScreen title="Stadiu salvat" description={saved} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}
