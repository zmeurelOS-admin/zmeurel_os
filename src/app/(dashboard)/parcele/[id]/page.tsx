'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Leaf, Thermometer, Droplets, ListChecks } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { queryKeys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getParcelaById } from '@/lib/supabase/queries/parcele'
import {
  createCultureStageLog,
  createSolarClimateLog,
  getCultureStageLogs,
  getSolarClimateLogs,
} from '@/lib/supabase/queries/solar-tracking'

const climateSchema = z.object({
  temperatura: z
    .string()
    .trim()
    .min(1, 'Temperatura este obligatorie')
    .refine((value) => Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Temperatura trebuie sa fie un numar valid',
    }),
  umiditate: z
    .string()
    .trim()
    .min(1, 'Umiditatea este obligatorie')
    .refine((value) => {
      const parsed = Number(value.replace(',', '.'))
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    }, {
      message: 'Umiditatea trebuie sa fie intre 0 ți 100',
    }),
  observatii: z.string().optional(),
})

const stageSchema = z.object({
  etapa: z.string().min(1, 'Etapa este obligatorie'),
  etapa_custom: z.string().optional(),
  data: z.string().min(1, 'Data este obligatorie'),
  observatii: z.string().optional(),
})

type ClimateFormValues = z.infer<typeof climateSchema>
type StageFormValues = z.infer<typeof stageSchema>

const STAGE_OPTIONS = [
  { value: 'plantare', label: 'Plantare' },
  { value: '2_frunze', label: '2 frunze' },
  { value: 'primele_flori', label: 'Primele flori' },
  { value: 'prima_recolta', label: 'Prima recolta' },
  { value: '__custom__', label: 'Etapa personalizata' },
]

function toDateLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

function toDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function daysSincePlanting(plantingDate: string | null | undefined): number | null {
  if (!plantingDate) return null
  const start = new Date(plantingDate)
  if (Number.isNaN(start.getTime())) return null

  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export default function ParcelaDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const parcelaId = Array.isArray(params.id) ? params.id[0] : params.id
  const [climateOpen, setClimateOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)

  const climateForm = useForm<ClimateFormValues>({
    resolver: zodResolver(climateSchema),
    defaultValues: {
      temperatura: '',
      umiditate: '',
      observatii: '',
    },
  })

  const stageForm = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      etapa: 'plantare',
      etapa_custom: '',
      data: new Date().toISOString().slice(0, 10),
      observatii: '',
    },
  })

  const parcelaQuery = useQuery({
    queryKey: queryKeys.parcela(parcelaId),
    queryFn: () => getParcelaById(parcelaId),
    enabled: Boolean(parcelaId),
  })

  const climateQuery = useQuery({
    queryKey: queryKeys.parcelaSolarClimate(parcelaId),
    queryFn: () => getSolarClimateLogs(parcelaId, 20),
    enabled: Boolean(parcelaId),
  })

  const stageQuery = useQuery({
    queryKey: queryKeys.parcelaCultureStages(parcelaId),
    queryFn: () => getCultureStageLogs(parcelaId, 30),
    enabled: Boolean(parcelaId),
  })

  const createClimateMutation = useMutation({
    mutationFn: createSolarClimateLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parcelaSolarClimate(parcelaId) })
      toast.success('Inregistrare climat salvata')
      setClimateOpen(false)
      climateForm.reset({ temperatura: '', umiditate: '', observatii: '' })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const createStageMutation = useMutation({
    mutationFn: createCultureStageLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
      toast.success('Etapa culturii a fost salvata')
      setStageOpen(false)
      stageForm.reset({
        etapa: 'plantare',
        etapa_custom: '',
        data: new Date().toISOString().slice(0, 10),
        observatii: '',
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const parcela = parcelaQuery.data
  const isSolar = (parcela?.tip_unitate ?? 'camp') === 'solar'
  const latestClimate = climateQuery.data?.[0] ?? null
  const sincePlanting = daysSincePlanting(parcela?.data_plantarii)
  const selectedStageOption = stageForm.watch('etapa')
  const requiresCustomStage = selectedStageOption === '__custom__'

  const sectionCards = useMemo(() => ({
    base: 'rounded-2xl bg-white p-4 shadow-sm',
    title: 'mb-3 text-sm font-semibold text-[var(--agri-text,#1f2937)]',
    label: 'text-xs text-[var(--agri-text-muted,#6b7280)]',
    value: 'text-sm font-medium text-[var(--agri-text,#111827)]',
  }), [])

  const onClimateSubmit = (values: ClimateFormValues) => {
    createClimateMutation.mutate({
      unitate_id: parcelaId,
      temperatura: Number(values.temperatura.replace(',', '.')),
      umiditate: Number(values.umiditate.replace(',', '.')),
      observatii: values.observatii?.trim() || undefined,
    })
  }

  const onStageSubmit = (values: StageFormValues) => {
    const etapa = values.etapa === '__custom__'
      ? values.etapa_custom?.trim() || ''
      : values.etapa

    if (!etapa) {
      stageForm.setError('etapa_custom', { message: 'Completeaza etapa personalizata' })
      return
    }

    createStageMutation.mutate({
      unitate_id: parcelaId,
      etapa,
      data: values.data,
      observatii: values.observatii?.trim() || undefined,
    })
  }

  if (parcelaQuery.isLoading) {
    return (
      <AppShell
        header={<PageHeader title="Detaliu teren" subtitle="Se încarcă..." rightSlot={<Leaf className="h-5 w-5" />} />}
      >
        <div className="mt-4">
          <LoadingState label="Se încarcă detaliile terenului..." />
        </div>
      </AppShell>
    )
  }

  if (parcelaQuery.isError) {
    return (
      <AppShell
        header={<PageHeader title="Detaliu teren" subtitle="Eroare" rightSlot={<Leaf className="h-5 w-5" />} />}
      >
        <div className="mt-4">
          <ErrorState
            title="Nu am putut încărca terenul"
            message={(parcelaQuery.error as Error).message}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcela(parcelaId) })}
          />
        </div>
      </AppShell>
    )
  }

  if (!parcela) {
    return (
      <AppShell
        header={<PageHeader title="Detaliu teren" subtitle="Teren lipsa" rightSlot={<Leaf className="h-5 w-5" />} />}
      >
        <div className="mx-auto mt-4 w-full max-w-3xl px-0 py-3 sm:px-3">
          <div className={sectionCards.base}>
            <p className={sectionCards.value}>Terenul nu a fost gasit.</p>
            <button
              type="button"
              onClick={() => router.push('/parcele')}
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-[var(--agri-primary,#15803d)] px-4 text-sm font-semibold text-white"
            >
              Inapoi la terenuri
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title={parcela.nume_parcela || 'Detaliu teren'}
          subtitle={isSolar ? 'Detaliu solar' : 'Detaliu unitate'}
          rightSlot={<Leaf className="h-5 w-5" />}
        />
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 px-0 py-3 sm:px-3">
        <div className={sectionCards.base}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={sectionCards.title}>Date unitate</h2>
            <button
              type="button"
              onClick={() => router.push('/parcele')}
              className="inline-flex h-9 items-center rounded-xl border border-[var(--agri-border,#e5e7eb)] px-3 text-xs font-semibold text-[var(--agri-text,#111827)]"
            >
              Inapoi
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={sectionCards.label}>Unitate</p>
              <p className={sectionCards.value}>{parcela.nume_parcela || '-'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Tip unitate</p>
              <p className={sectionCards.value}>{parcela.tip_unitate || 'camp'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Cultura</p>
              <p className={sectionCards.value}>{parcela.cultura || parcela.tip_fruct || '-'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Soi</p>
              <p className={sectionCards.value}>{parcela.soi || parcela.soi_plantat || '-'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Suprafata</p>
              <p className={sectionCards.value}>{Number(parcela.suprafata_m2 || 0).toFixed(0)} mp</p>
            </div>
            <div>
              <p className={sectionCards.label}>Numar randuri</p>
              <p className={sectionCards.value}>{parcela.nr_randuri ?? '-'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Numar plante</p>
              <p className={sectionCards.value}>{parcela.nr_plante ?? '-'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Sistem irigare</p>
              <p className={sectionCards.value}>{parcela.sistem_irigare || '-'}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Data plantarii</p>
              <p className={sectionCards.value}>{toDateLabel(parcela.data_plantarii)}</p>
            </div>
            <div>
              <p className={sectionCards.label}>Zile de la plantare</p>
              <p className={sectionCards.value}>{sincePlanting !== null ? sincePlanting : '-'}</p>
            </div>
          </div>
        </div>

        {isSolar ? (
          <>
            <div className={sectionCards.base}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className={sectionCards.title}>Climat solar</h2>
                <button
                  type="button"
                  onClick={() => setClimateOpen(true)}
                  className="inline-flex h-9 items-center rounded-xl bg-[var(--agri-primary,#15803d)] px-3 text-xs font-semibold text-white"
                >
                  Adauga climat
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--agri-border,#e5e7eb)] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-rose-600" />
                    <p className={sectionCards.label}>Temperatura</p>
                  </div>
                  <p className={sectionCards.value}>
                    {latestClimate ? `${Number(latestClimate.temperatura).toFixed(1)}°C` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--agri-border,#e5e7eb)] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-sky-600" />
                    <p className={sectionCards.label}>Umiditate</p>
                  </div>
                  <p className={sectionCards.value}>
                    {latestClimate ? `${Number(latestClimate.umiditate).toFixed(0)}%` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--agri-border,#e5e7eb)] p-3">
                  <p className={sectionCards.label}>Ultima actualizare</p>
                  <p className={sectionCards.value}>{toDateTimeLabel(latestClimate?.created_at)}</p>
                </div>
              </div>
            </div>

            <div className={sectionCards.base}>
              <h2 className={sectionCards.title}>Istoric climat</h2>
              {climateQuery.isLoading ? (
                <p className={sectionCards.label}>Se încarcă istoricul climat...</p>
              ) : null}
              {!climateQuery.isLoading && (climateQuery.data?.length ?? 0) === 0 ? (
                <p className={sectionCards.label}>Nu exist? înregistrări de climat.</p>
              ) : null}
              <div className="space-y-2">
                {(climateQuery.data ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--agri-border,#e5e7eb)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className={sectionCards.value}>{toDateTimeLabel(entry.created_at)}</p>
                      <p className={sectionCards.label}>
                        {Number(entry.temperatura).toFixed(1)}°C / {Number(entry.umiditate).toFixed(0)}%
                      </p>
                    </div>
                    {entry.observatii ? <p className="mt-1 text-xs text-[var(--agri-text-muted,#6b7280)]">{entry.observatii}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className={sectionCards.base}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className={sectionCards.title}>Etape cultura</h2>
                <button
                  type="button"
                  onClick={() => setStageOpen(true)}
                  className="inline-flex h-9 items-center rounded-xl bg-[var(--agri-primary,#15803d)] px-3 text-xs font-semibold text-white"
                >
                  Adauga etapa
                </button>
              </div>

              {(stageQuery.data?.length ?? 0) === 0 ? (
                <p className={sectionCards.label}>Nu exist? etape înregistrate.</p>
              ) : null}
              <div className="space-y-2">
                {(stageQuery.data ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--agri-border,#e5e7eb)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-emerald-700" />
                        <p className={sectionCards.value}>{entry.etapa}</p>
                      </div>
                      <p className={sectionCards.label}>{toDateLabel(entry.data)}</p>
                    </div>
                    {entry.observatii ? <p className="mt-1 text-xs text-[var(--agri-text-muted,#6b7280)]">{entry.observatii}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={sectionCards.base}>
            <p className={sectionCards.value}>
              Jurnalul de climat ți etape cultura este disponibil pentru unitatile de tip solar.
            </p>
          </div>
        )}
      </div>

      <AppDialog
        open={climateOpen}
        onOpenChange={setClimateOpen}
        title="Adauga climat solar"
        footer={
          <DialogFormActions
            onCancel={() => setClimateOpen(false)}
            onSave={climateForm.handleSubmit(onClimateSubmit)}
            saving={createClimateMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-4" onSubmit={climateForm.handleSubmit(onClimateSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="climat_temperatura">Temperatura (°C)</Label>
            <Input id="climat_temperatura" className="agri-control h-12" inputMode="decimal" {...climateForm.register('temperatura')} />
            {climateForm.formState.errors.temperatura ? <p className="text-xs text-red-600">{climateForm.formState.errors.temperatura.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="climat_umiditate">Umiditate (%)</Label>
            <Input id="climat_umiditate" className="agri-control h-12" inputMode="decimal" {...climateForm.register('umiditate')} />
            {climateForm.formState.errors.umiditate ? <p className="text-xs text-red-600">{climateForm.formState.errors.umiditate.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="climat_observatii">Observatii</Label>
            <Textarea id="climat_observatii" rows={3} className="agri-control w-full px-3 py-2 text-base" {...climateForm.register('observatii')} />
          </div>
        </form>
      </AppDialog>

      <AppDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        title="Adauga etapa cultura"
        footer={
          <DialogFormActions
            onCancel={() => setStageOpen(false)}
            onSave={stageForm.handleSubmit(onStageSubmit)}
            saving={createStageMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-4" onSubmit={stageForm.handleSubmit(onStageSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="etapa_select">Etapa</Label>
            <select id="etapa_select" className="agri-control h-12 w-full px-3 text-base" {...stageForm.register('etapa')}>
              {STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {requiresCustomStage ? (
            <div className="space-y-2">
              <Label htmlFor="etapa_custom">Etapa personalizata</Label>
              <Input id="etapa_custom" className="agri-control h-12" {...stageForm.register('etapa_custom')} />
              {stageForm.formState.errors.etapa_custom ? <p className="text-xs text-red-600">{stageForm.formState.errors.etapa_custom.message}</p> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="etapa_data">Data</Label>
            <Input id="etapa_data" type="date" className="agri-control h-12" {...stageForm.register('data')} />
            {stageForm.formState.errors.data ? <p className="text-xs text-red-600">{stageForm.formState.errors.data.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="etapa_observatii">Observatii</Label>
            <Textarea id="etapa_observatii" rows={3} className="agri-control w-full px-3 py-2 text-base" {...stageForm.register('observatii')} />
          </div>
        </form>
      </AppDialog>
    </AppShell>
  )
}
