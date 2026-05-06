'use client'

import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { queryKeys } from '@/lib/query-keys'
import type { Cultura } from '@/lib/supabase/queries/culturi'
import {
  createParcelaStadiuCanonic,
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  getOrdineInGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'

const schema = z.object({
  stadiu: z.string().min(1, 'Stadiul este obligatoriu'),
  cohort: z.enum(['floricane', 'primocane']).optional(),
  data: z.string().min(1, 'Data este obligatorie'),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

interface AddStadiuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cultura: Cultura | null
  parcelaId: string | null
  onUpdated: () => void
}

function formatStageLabel(
  value: string | null | undefined,
  grupBiologic?: GrupBiologic | null,
  cohort?: string | null
): string {
  if (!value?.trim()) return 'Stadiu nedefinit'
  const cod = normalizeStadiu(value)
  if (cod) return getLabelPentruGrup(cod, grupBiologic, { cohort })
  const normalized = value.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getStadiuOrder(cod: StadiuCod, grupBiologic: GrupBiologic | null): number {
  if (grupBiologic) {
    const indexInGroup = getOrdineInGrup(cod, grupBiologic)
    if (indexInGroup >= 0) return indexInGroup
  }
  return getOrdine(cod) + 100
}

function getCurrentCanonicalStage(
  stages: ParcelaStadiuCanonic[],
  grupBiologic: GrupBiologic | null
): ParcelaStadiuCanonic | null {
  if (stages.length === 0) return null

  return [...stages].sort((a, b) => {
    const codA = normalizeStadiu(a.stadiu)
    const codB = normalizeStadiu(b.stadiu)
    const orderA = codA ? getStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderB = codB ? getStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderDiff = orderB - orderA
    if (orderDiff !== 0) return orderDiff

    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

export function AddStadiuDialog({
  open,
  onOpenChange,
  cultura,
  parcelaId,
  onUpdated,
}: AddStadiuDialogProps) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const currentSezon = getCurrentSezon()
  const cropCod = useMemo(() => normalizeCropCod(cultura?.tip_planta), [cultura?.tip_planta])
  const grupBiologic = useMemo(() => getGrupBiologicForCropCod(cropCod), [cropCod])
  const stageValues = useMemo(
    () => (grupBiologic ? listStadiiPentruGrup(grupBiologic) : listAllStadiiCanonice()),
    [grupBiologic]
  )
  const defaultStadiu = stageValues[0] ?? 'repaus_vegetativ'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { stadiu: defaultStadiu, cohort: undefined, data: today, observatii: '' },
  })

  const { data: canonicalStages = [] } = useQuery({
    queryKey: queryKeys.parcelaCultureStages(parcelaId ?? ''),
    queryFn: () => getStadiiCanoniceParcela(parcelaId!, currentSezon, 50),
    enabled: open && Boolean(parcelaId),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: seasonConfig = null } = useQuery({
    queryKey: queryKeys.parcelaSeasonConfig(parcelaId ?? '', currentSezon),
    queryFn: () => getConfigurareSezonParcela(parcelaId!, currentSezon),
    enabled: open && Boolean(parcelaId),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const currentCanonicalStage = useMemo(
    () => getCurrentCanonicalStage(canonicalStages, grupBiologic),
    [canonicalStages, grupBiologic]
  )
  const hasCanonicalCohorts = canonicalStages.some((stage) => stage.cohort === 'floricane' || stage.cohort === 'primocane')
  const isRubusMixt =
    grupBiologic === 'rubus' &&
    (seasonConfig?.sistem_conducere === 'mixt_floricane_primocane' || hasCanonicalCohorts)
  const legacyStageLabel = cultura?.stadiu ? formatStageLabel(cultura.stadiu, grupBiologic) : null

  useEffect(() => {
    if (open) {
      form.reset({ stadiu: defaultStadiu, cohort: undefined, data: today, observatii: '' })
    }
  }, [defaultStadiu, open, form, today])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!cultura) throw new Error('Cultură nedefinită')
      if (!parcelaId) throw new Error('Solar nedefinit')
      if (isRubusMixt && !values.cohort) throw new Error('Selectează cohorta')

      await createParcelaStadiuCanonic({
        parcela_id: parcelaId,
        an: currentSezon,
        stadiu: values.stadiu,
        cohort: isRubusMixt ? values.cohort ?? null : null,
        data_observata: values.data,
        observatii: values.observatii || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Stadiu actualizat')
      if (parcelaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
      }
      onOpenChange(false)
      onUpdated()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stadiuValue = useWatch({ control: form.control, name: 'stadiu' }) || ''
  const cohortValue = useWatch({ control: form.control, name: 'cohort' }) || undefined
  const stageOptions = useMemo(
    () =>
      stageValues.map((cod) => ({
        value: cod,
        label: getLabelPentruGrup(cod, grupBiologic, { cohort: cohortValue }),
      })),
    [cohortValue, grupBiologic, stageValues]
  )

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ stadiu: defaultStadiu, cohort: undefined, data: today, observatii: '' })
        onOpenChange(next)
      }}
      title="Adaugă stadiu cultură"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((v) => mutation.mutate(v))}
          saving={mutation.isPending}
          saveLabel="Salvează"
          cancelLabel="Anulează"
        />
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        {cultura ? (
          <div
            style={{
              background: 'rgba(61,122,95,0.07)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
            color: '#3D7A5F',
            }}
          >
            <div>{[cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ')}</div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 500, color: 'var(--agri-text-muted)' }}>
              {currentCanonicalStage
                ? `Stadiu curent: ${formatStageLabel(currentCanonicalStage.stadiu, grupBiologic, currentCanonicalStage.cohort)}`
                : legacyStageLabel
                  ? `Stadiu vechi: ${legacyStageLabel}`
                  : 'Fără stadiu înregistrat'}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Stadiu *</Label>
          <Select
            value={stadiuValue}
            onValueChange={(value) => form.setValue('stadiu', value, { shouldValidate: true })}
          >
            <SelectTrigger className="agri-control h-12 w-full px-3 text-base">
              <SelectValue placeholder="Alege stadiul" />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.stadiu ? (
            <p className="text-xs text-red-600">{form.formState.errors.stadiu.message}</p>
          ) : null}
        </div>

        {isRubusMixt ? (
          <div className="space-y-2">
            <Label>Coortă *</Label>
            <Select
              value={cohortValue}
              onValueChange={(value) => form.setValue('cohort', value as Cohorta, { shouldValidate: true })}
            >
              <SelectTrigger className="agri-control h-12 w-full px-3 text-base">
                <SelectValue placeholder="Alege cohorta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="floricane">Floricane</SelectItem>
                <SelectItem value="primocane">Primocane</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.cohort ? (
              <p className="text-xs text-red-600">{form.formState.errors.cohort.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="data_stadiu">Data *</Label>
          <Input
            id="data_stadiu"
            type="date"
            className="agri-control h-12"
            {...form.register('data')}
          />
          {form.formState.errors.data ? (
            <p className="text-xs text-red-600">{form.formState.errors.data.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="observatii_stadiu">Observații (opțional)</Label>
          <Textarea
            id="observatii_stadiu"
            rows={2}
            className="agri-control w-full px-3 py-2 text-base"
            placeholder="Ex: Primele flori apărute, Atac de afide..."
            {...form.register('observatii')}
          />
        </div>
      </form>
    </AppDialog>
  )
}
