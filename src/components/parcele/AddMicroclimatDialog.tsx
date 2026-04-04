'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getConditiiMediuLabel, getConditiiMediuLabelLower } from '@/lib/parcele/culturi'
import { createSolarClimateLog } from '@/lib/supabase/queries/solar-tracking'
import { toast } from '@/lib/ui/toast'

const toNum = (v: string) => Number(v.replace(',', '.').trim())

const schema = z.object({
  temperatura: z
    .string()
    .trim()
    .min(1, 'Temperatura este obligatorie')
    .refine((v) => Number.isFinite(toNum(v)), 'Temperatură invalidă'),
  umiditate: z
    .string()
    .trim()
    .min(1, 'Umiditatea este obligatorie')
    .refine((v) => {
      const n = toNum(v)
      return Number.isFinite(n) && n >= 0 && n <= 100
    }, 'Umiditate invalidă (0–100)'),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

const defaultValues: FormValues = { temperatura: '', umiditate: '', observatii: '' }

interface AddMicroclimatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId: string | null
  tipUnitate?: string | null
  onCreated: () => void
}

export function AddMicroclimatDialog({
  open,
  onOpenChange,
  parcelaId,
  tipUnitate,
  onCreated,
}: AddMicroclimatDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const conditiiLabel = getConditiiMediuLabel(tipUnitate)
  const conditiiLabelLower = getConditiiMediuLabelLower(tipUnitate)
  const successMessage =
    conditiiLabel === 'Microclimat'
      ? 'Date actualizate — recomandările sunt mai precise'
      : 'Condiții de mediu salvate'

  useEffect(() => {
    if (open) form.reset(defaultValues)
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!parcelaId) throw new Error('Teren nedefinit')
      return createSolarClimateLog({
        unitate_id: parcelaId,
        temperatura: toNum(values.temperatura),
        umiditate: toNum(values.umiditate),
        observatii: values.observatii || undefined,
      })
    },
    onSuccess: () => {
      toast.success(successMessage)
      onOpenChange(false)
      onCreated()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(defaultValues)
        onOpenChange(next)
      }}
      title={`Adaugă ${conditiiLabelLower}`}
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
        <div className="space-y-2">
          <Label htmlFor="temperatura">Temperatură (°C) *</Label>
          <input
            id="temperatura"
            type="number"
            inputMode="decimal"
            step="0.1"
            className="agri-control h-12 w-full px-3 text-base"
            placeholder="Ex: 22.5"
            {...form.register('temperatura')}
          />
          {form.formState.errors.temperatura ? (
            <p className="text-xs text-red-600">{form.formState.errors.temperatura.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="umiditate">Umiditate (%) *</Label>
          <input
            id="umiditate"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="100"
            className="agri-control h-12 w-full px-3 text-base"
            placeholder="Ex: 75"
            {...form.register('umiditate')}
          />
          {form.formState.errors.umiditate ? (
            <p className="text-xs text-red-600">{form.formState.errors.umiditate.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="observatii_clima">Observații (opțional)</Label>
          <Textarea
            id="observatii_clima"
            rows={2}
            className="agri-control w-full px-3 py-2 text-base"
            placeholder={
              conditiiLabel === 'Microclimat'
                ? 'Ex: Ventilatoare pornite, Ferestre deschise...'
                : 'Ex: Vânt puternic, umezeală crescută, sol uscat...'
            }
            {...form.register('observatii')}
          />
        </div>
      </form>
    </AppDialog>
  )
}
