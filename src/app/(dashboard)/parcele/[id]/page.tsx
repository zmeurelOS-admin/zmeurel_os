'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Droplets, Leaf, ListChecks, Thermometer } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { queryKeys } from '@/lib/query-keys'
import { getParcelaById } from '@/lib/supabase/queries/parcele'
import {
  createCultureStageLog,
  createSolarClimateLog,
  getCultureStageLogs,
  getSolarClimateLogs,
} from '@/lib/supabase/queries/solar-tracking'
import { toast } from '@/lib/ui/toast'

const climateSchema = z.object({
  temperatura: z
    .string()
    .trim()
    .min(1, 'Temperatura este obligatorie')
    .refine((value) => Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Temperatura trebuie să fie un număr valid.',
    }),
  umiditate: z
    .string()
    .trim()
    .min(1, 'Umiditatea este obligatorie')
    .refine((value) => {
      const parsed = Number(value.replace(',', '.'))
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    }, {
      message: 'Umiditatea trebuie să fie între 0 și 100.',
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
  { value: 'prima_recolta', label: 'Prima recoltă' },
  { value: '__custom__', label: 'Etapă personalizată' },
]

function toDateLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

function toCompactDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toFullDateTimeLabel(value: string | null | undefined): string {
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
      toast.success('Înregistrarea de climat a fost salvată.')
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
      toast.success('Etapa culturii a fost salvată.')
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

  const sectionClasses = useMemo(
    () => ({
      base: 'rounded-2xl bg-white p-4 shadow-sm',
      title: 'mb-3 text-sm font-semibold text-[var(--agri-text)]',
      label: 'text-xs text-[var(--agri-text-muted)]',
      value: 'text-sm font-medium text-[var(--agri-text)]',
    }),
    []
  )

  const onClimateSubmit = (values: ClimateFormValues) => {
    createClimateMutation.mutate({
      unitate_id: parcelaId,
      temperatura: Number(values.temperatura.replace(',', '.')),
      umiditate: Number(values.umiditate.replace(',', '.')),
      observatii: values.observatii?.trim() || undefined,
    })
  }

  const onStageSubmit = (values: StageFormValues) => {
    const etapa =
      values.etapa === '__custom__' ? values.etapa_custom?.trim() || '' : values.etapa

    if (!etapa) {
      stageForm.setError('etapa_custom', { message: 'Completează etapa personalizată.' })
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
      <AppShell header={<PageHeader title="Detaliu teren" subtitle="Se încarcă..." rightSlot={<Leaf className="h-5 w-5" />} />}>
        <div className="mt-4">
          <LoadingState label="Se încarcă detaliile terenului..." />
        </div>
      </AppShell>
    )
  }

  if (parcelaQuery.isError) {
    return (
      <AppShell header={<PageHeader title="Detaliu teren" subtitle="Eroare" rightSlot={<Leaf className="h-5 w-5" />} />}>
        <div className="mt-4">
          <ErrorState
            title="Nu am putut încărca terenul."
            message={(parcelaQuery.error as Error).message}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcela(parcelaId) })}
          />
        </div>
      </AppShell>
    )
  }

  if (!parcela) {
    return (
      <AppShell header={<PageHeader title="Detaliu teren" subtitle="Teren lipsă" rightSlot={<Leaf className="h-5 w-5" />} />}>
        <div className="mx-auto mt-3 w-full max-w-3xl px-0 py-3 sm:px-3">
          <div className={sectionClasses.base}>
            <p className={sectionClasses.value}>Terenul nu a fost găsit.</p>
            <button
              type="button"
              onClick={() => router.push('/parcele')}
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white"
            >
              Înapoi la terenuri
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
          subtitle={isSolar ? 'Detaliu unitate · solar' : 'Detaliu unitate'}
          rightSlot={<Leaf className="h-5 w-5" />}
        />
      }
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 px-0 py-3 sm:px-3">
        <div className={sectionClasses.base}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={sectionClasses.title}>Date unitate</h2>
            <button
              type="button"
              onClick={() => router.push('/parcele')}
              className="inline-flex h-9 items-center rounded-xl border border-[var(--agri-border)] px-3 text-xs font-semibold text-[var(--agri-text)]"
            >
              Înapoi
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Unitate', parcela.nume_parcela || '-'],
              ['Tip unitate', parcela.tip_unitate || 'câmp'],
              ['Cultură', parcela.cultura || parcela.tip_fruct || '-'],
              ['Soi', parcela.soi || parcela.soi_plantat || '-'],
              ['Suprafață', `${Number(parcela.suprafata_m2 || 0).toFixed(0)} mp`],
              ['Număr rânduri', parcela.nr_randuri ?? '-'],
              ['Număr plante', parcela.nr_plante ?? '-'],
              ['Sistem irigare', parcela.sistem_irigare || '-'],
              ['Data plantării', toDateLabel(parcela.data_plantarii)],
              ['Zile de la plantare', sincePlanting !== null ? String(sincePlanting) : '-'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-1">
                <p className={sectionClasses.label}>{label}</p>
                <p className={`${sectionClasses.value} break-words`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <>
            <div className={sectionClasses.base}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={sectionClasses.title}>{isSolar ? 'Climat și observații' : 'Condiții și observații'}</h2>
                <button
                  type="button"
                  onClick={() => setClimateOpen(true)}
                  className="inline-flex h-9 items-center rounded-xl bg-[var(--agri-primary)] px-3 text-xs font-semibold text-white"
                >
                  Adaugă climat
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--agri-border)] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-rose-600" />
                    <p className={sectionClasses.label}>Temperatură</p>
                  </div>
                  <p className={sectionClasses.value}>
                    {latestClimate ? `${Number(latestClimate.temperatura).toFixed(1)}°C` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--agri-border)] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-sky-600" />
                    <p className={sectionClasses.label}>Umiditate</p>
                  </div>
                  <p className={sectionClasses.value}>
                    {latestClimate ? `${Number(latestClimate.umiditate).toFixed(0)}%` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--agri-border)] p-3">
                  <p className={sectionClasses.label}>Ultima actualizare</p>
                  <p className={sectionClasses.value}>{toCompactDateTimeLabel(latestClimate?.created_at)}</p>
                </div>
              </div>
            </div>

            <div className={sectionClasses.base}>
              <h2 className={sectionClasses.title}>Istoric climat</h2>
              {climateQuery.isLoading ? (
                <p className={sectionClasses.label}>Se încarcă istoricul de climat...</p>
              ) : null}
              {!climateQuery.isLoading && (climateQuery.data?.length ?? 0) === 0 ? (
                <p className={sectionClasses.label}>Nu există încă înregistrări de climat.</p>
              ) : null}
              <div className="space-y-2">
                {(climateQuery.data ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--agri-border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={sectionClasses.value}>{toFullDateTimeLabel(entry.created_at)}</p>
                        <p className={`${sectionClasses.label} mt-1`}>
                          {Number(entry.temperatura).toFixed(1)}°C · {Number(entry.umiditate).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    {entry.observatii ? (
                      <p className="mt-2 text-xs text-[var(--agri-text-muted)]">{entry.observatii}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className={sectionClasses.base}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={sectionClasses.title}>Etape de cultură</h2>
                <button
                  type="button"
                  onClick={() => setStageOpen(true)}
                  className="inline-flex h-9 items-center rounded-xl bg-[var(--agri-primary)] px-3 text-xs font-semibold text-white"
                >
                  Adaugă etapă
                </button>
              </div>

              {(stageQuery.data?.length ?? 0) === 0 ? (
                <p className={sectionClasses.label}>Nu există încă etape înregistrate.</p>
              ) : null}
              <div className="space-y-2">
                {(stageQuery.data ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--agri-border)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-emerald-700" />
                        <p className={sectionClasses.value}>{entry.etapa}</p>
                      </div>
                      <p className={sectionClasses.label}>{toDateLabel(entry.data)}</p>
                    </div>
                    {entry.observatii ? (
                      <p className="mt-2 text-xs text-[var(--agri-text-muted)]">{entry.observatii}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </>
      </div>

      <AppDialog
        open={climateOpen}
        onOpenChange={setClimateOpen}
        title="Adaugă climat"
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
            <Label htmlFor="climat_temperatura">Temperatură (°C)</Label>
            <Input id="climat_temperatura" className="agri-control h-12" inputMode="decimal" {...climateForm.register('temperatura')} />
            {climateForm.formState.errors.temperatura ? (
              <p className="text-xs text-red-600">{climateForm.formState.errors.temperatura.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="climat_umiditate">Umiditate (%)</Label>
            <Input id="climat_umiditate" className="agri-control h-12" inputMode="decimal" {...climateForm.register('umiditate')} />
            {climateForm.formState.errors.umiditate ? (
              <p className="text-xs text-red-600">{climateForm.formState.errors.umiditate.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="climat_observatii">Observații de teren</Label>
            <Textarea id="climat_observatii" rows={3} className="agri-control w-full px-3 py-2 text-base" {...climateForm.register('observatii')} />
          </div>
        </form>
      </AppDialog>

      <AppDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        title="Adaugă etapă de cultură"
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
            <Label htmlFor="etapa_select">Etapă</Label>
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
              <Label htmlFor="etapa_custom">Etapă personalizată</Label>
              <Input id="etapa_custom" className="agri-control h-12" {...stageForm.register('etapa_custom')} />
              {stageForm.formState.errors.etapa_custom ? (
                <p className="text-xs text-red-600">{stageForm.formState.errors.etapa_custom.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="etapa_data">Data</Label>
            <Input id="etapa_data" type="date" className="agri-control h-12" {...stageForm.register('data')} />
            {stageForm.formState.errors.data ? (
              <p className="text-xs text-red-600">{stageForm.formState.errors.data.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="etapa_observatii">Observații</Label>
            <Textarea id="etapa_observatii" rows={3} className="agri-control w-full px-3 py-2 text-base" {...stageForm.register('observatii')} />
          </div>
        </form>
      </AppDialog>
    </AppShell>
  )
}
