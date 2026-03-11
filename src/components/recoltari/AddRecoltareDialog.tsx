'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { formatUnitateDisplayName, getUnitateTipLabel } from '@/lib/parcele/unitate'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { createRecoltare } from '@/lib/supabase/queries/recoltari'
import { getActivitatiAgricole, calculatePauseStatus, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

const schema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().min(1, 'Parcela este obligatorie'),
  culegator_id: z.string().min(1, 'Culegatorul este obligatoriu'),
  kg_cal1: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Kg Cal 1 trebuie sa fie >= 0',
    }),
  kg_cal2: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Kg Cal 2 trebuie sa fie >= 0',
    }),
  observatii: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface AddRecoltareDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

const defaultValues = (): FormData => ({
  data: new Date().toISOString().split('T')[0],
  parcela_id: '',
  culegator_id: '',
  kg_cal1: '',
  kg_cal2: '',
  observatii: '',
})

function toNumber(value: string | undefined): number {
  if (!value || value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function AddRecoltareDialog({ open, onOpenChange, hideTrigger = false }: AddRecoltareDialogProps) {
  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!dialogOpen) {
      form.reset(defaultValues())
    }
  }, [dialogOpen, form])

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const { data: culegatori = [] } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
  })

  const { data: activitati = [] } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
  })

  const mutation = useMutation({
    mutationFn: createRecoltare,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recoltari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      trackEvent('create_recoltare', 'recoltari', { source: 'AddRecoltareDialog' })
      track('recoltare_add', {
        kg: Number(variables.kg_cal1 || 0) + Number(variables.kg_cal2 || 0),
        parcela_id: variables.parcela_id ?? null,
      })
      hapticSuccess()
      toast.success('Recoltare adaugata')
      setDialogOpen(false)
    },
    onError: (error: unknown) => {
      const maybeError = error as { status?: number; code?: string; message?: string }
      const conflict = maybeError?.status === 409 || maybeError?.code === '23505'
      if (conflict) {
        toast.info('Inregistrarea era deja sincronizat?.')
        setDialogOpen(false)
        return
      }
      hapticError()
      toast.error(maybeError?.message || 'Eroare la salvare')
    },
  })

  const selectedParcelaId = form.watch('parcela_id')
  const selectedCulegatorId = form.watch('culegator_id')
  const kgCal1 = toNumber(form.watch('kg_cal1'))
  const kgCal2 = toNumber(form.watch('kg_cal2'))
  const totalKg = kgCal1 + kgCal2
  const selectedCulegator = culegatori.find((culegator) => culegator.id === selectedCulegatorId)
  const tarifLeiKg = Number(selectedCulegator?.tarif_lei_kg ?? 0)
  const hasValidTarif = Number.isFinite(tarifLeiKg) && tarifLeiKg > 0
  const valoareMunca = hasValidTarif ? totalKg * tarifLeiKg : null

  // Check for active treatment pause
  const activePauseWarning = useMemo(() => {
    if (!selectedParcelaId) return null

    const parcelaActivitati = activitati.filter((act) => act.parcela_id === selectedParcelaId)
    if (parcelaActivitati.length === 0) return null

    for (const activitate of parcelaActivitati) {
      const { dataRecoltarePermisa, status } = calculatePauseStatus(
        activitate.data_aplicare,
        activitate.timp_pauza_zile
      )
      
      if (status === 'Pauza') {
        const selectedParcela = parcele.find((p) => p.id === selectedParcelaId)
        const parcelaName = formatUnitateDisplayName(selectedParcela?.nume_parcela, selectedParcela?.tip_unitate, 'Parcela selectata')
        const dataAplicare = new Date(activitate.data_aplicare).toLocaleDateString('ro-RO')
        const dataPermisa = new Date(dataRecoltarePermisa).toLocaleDateString('ro-RO')
        
        return {
          message: `⚠️ Parcelă ${parcelaName} are tratament activ (${activitate.produs_utilizat || 'produs necunoscut'}, aplicat ${dataAplicare}). Recoltare permisă de la ${dataPermisa}.`
        }
      }
    }
    
    return null
  }, [selectedParcelaId, activitati, parcele])

  const onSubmit = (data: FormData) => {
    if (mutation.isPending) return
    if (!hasValidTarif) {
      hapticError()
      toast.error('Culegatorul nu are tarif setat in profil')
      return
    }

    mutation.mutate({
      data: data.data,
      parcela_id: data.parcela_id,
      culegator_id: data.culegator_id,
      kg_cal1: toNumber(data.kg_cal1),
      kg_cal2: toNumber(data.kg_cal2),
      observatii: data.observatii?.trim() || undefined,
    })
  }

  return (
    <>
      <AppDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Adaugă recoltare"
        footer={
          <DialogFormActions
            onCancel={() => setDialogOpen(false)}
            onSave={form.handleSubmit(onSubmit)}
            saving={mutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="recoltare_data">Data</Label>
            <Input id="recoltare_data" type="date" className="agri-control h-12" {...form.register('data')} />
            {form.formState.errors.data ? (
              <p className="text-xs text-red-600">{form.formState.errors.data.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recoltare_parcela">Parcelă</Label>
            <Select
              value={form.watch('parcela_id') || '__none'}
              onValueChange={(value) => form.setValue('parcela_id', value === '__none' ? '' : value, { shouldDirty: true, shouldValidate: true })}
            >
              <SelectTrigger id="recoltare_parcela" className="agri-control h-12">
                <SelectValue placeholder="Selectează parcelă" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Selectează parcelă</SelectItem>
                {parcele.map((parcela) => (
                  <SelectItem key={parcela.id} value={parcela.id}>
                    {parcela.nume_parcela || 'Parcela'} ({getUnitateTipLabel(parcela.tip_unitate)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.parcela_id ? (
              <p className="text-xs text-red-600">{form.formState.errors.parcela_id.message}</p>
            ) : null}
            {activePauseWarning ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {activePauseWarning.message}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recoltare_culegator">Culegator</Label>
            <Select
              value={form.watch('culegator_id') || '__none'}
              onValueChange={(value) => form.setValue('culegator_id', value === '__none' ? '' : value, { shouldDirty: true, shouldValidate: true })}
            >
              <SelectTrigger id="recoltare_culegator" className="agri-control h-12">
                <SelectValue placeholder="Selectează culegator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Selectează culegator</SelectItem>
                {culegatori.map((culegator) => (
                  <SelectItem key={culegator.id} value={culegator.id}>
                    {culegator.nume_prenume || 'Culegator'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.culegator_id ? (
              <p className="text-xs text-red-600">{form.formState.errors.culegator_id.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="recoltare_kg_cal1">Kg Calitatea 1</Label>
              <Input
                id="recoltare_kg_cal1"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="agri-control h-12"
                {...form.register('kg_cal1')}
              />
              {form.formState.errors.kg_cal1 ? (
                <p className="text-xs text-red-600">{form.formState.errors.kg_cal1.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="recoltare_kg_cal2">Kg Calitatea 2</Label>
              <Input
                id="recoltare_kg_cal2"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="agri-control h-12"
                {...form.register('kg_cal2')}
              />
              {form.formState.errors.kg_cal2 ? (
                <p className="text-xs text-red-600">{form.formState.errors.kg_cal2.message}</p>
              ) : null}
            </div>
          </div>

          <Card className="rounded-2xl border border-emerald-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rezumat plata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Total kg: <span className="font-semibold">{totalKg.toFixed(2)} kg</span></p>
              {selectedCulegator ? (
                <>
                  <p>
                    Tarif:{' '}
                    <span className="font-semibold">
                      {hasValidTarif ? `${tarifLeiKg.toFixed(2)} lei/kg` : '—'}
                    </span>{' '}
                    <span className="text-xs text-[var(--agri-text-muted)]">(din profil culegator)</span>
                  </p>
                  <p>
                    De plata:{' '}
                    <span className="font-semibold">
                      {valoareMunca !== null ? `${valoareMunca.toFixed(2)} lei` : '—'}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[var(--agri-text-muted)]">Selectează culegatorul ca sa calculez plata</p>
                  <p>De plata: <span className="font-semibold">—</span></p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="recoltare_observatii">Observații</Label>
            <Textarea
              id="recoltare_observatii"
              rows={4}
              placeholder="Detalii suplimentare"
              className="agri-control w-full px-3 py-2 text-base"
              {...form.register('observatii')}
            />
          </div>
        </form>
      </AppDrawer>
    </>
  )
}

