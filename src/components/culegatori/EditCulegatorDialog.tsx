'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Culegator } from '@/lib/supabase/queries/culegatori'

const culegatorSchema = z.object({
  nume_prenume: z.string().trim().min(2, 'Numele trebuie să aibă minimum 2 caractere'),
  telefon: z.string().optional(),
  tip_angajare: z.string().min(1, 'Selectează tipul de angajare'),
  tarif_lei_kg: z.string().optional(),
  data_angajare: z.string().optional(),
  status_activ: z.boolean(),
  observatii: z.string().optional(),
})

type CulegatorFormData = z.infer<typeof culegatorSchema>

interface EditCulegatorDialogProps {
  culegator: Culegator | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: CulegatorFormData) => Promise<void>
}

const defaults = (): CulegatorFormData => ({
  nume_prenume: '',
  telefon: '',
  tip_angajare: 'Sezonier',
  tarif_lei_kg: '0',
  data_angajare: '',
  status_activ: true,
  observatii: '',
})

export function EditCulegatorDialog({ culegator, open, onOpenChange, onSubmit }: EditCulegatorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CulegatorFormData>({
    resolver: zodResolver(culegatorSchema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (!culegator || !open) return
    form.reset({
      nume_prenume: culegator.nume_prenume || '',
      telefon: culegator.telefon || '',
      tip_angajare: culegator.tip_angajare || 'Sezonier',
      tarif_lei_kg: String(culegator.tarif_lei_kg ?? 0),
      data_angajare: culegator.data_angajare || '',
      status_activ: Boolean(culegator.status_activ),
      observatii: culegator.observatii || '',
    })
  }, [culegator, open, form])

  const handleSubmit = async (data: CulegatorFormData) => {
    if (!culegator) return
    setIsSubmitting(true)
    try {
      await onSubmit(culegator.id, data)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!culegator) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează culegător"
      contentClassName="md:max-w-xl"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(handleSubmit)}
          saving={isSubmitting}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit_culegator_nume">Nume și prenume</Label>
            <Input id="edit_culegator_nume" className="agri-control h-12" {...form.register('nume_prenume')} />
            {form.formState.errors.nume_prenume ? <p className="text-xs text-red-600">{form.formState.errors.nume_prenume.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_culegator_telefon">Telefon</Label>
            <Input id="edit_culegator_telefon" type="tel" className="agri-control h-12" {...form.register('telefon')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_culegator_tip">Tip angajare</Label>
            <select id="edit_culegator_tip" className="agri-control h-12 w-full px-3 text-base" {...form.register('tip_angajare')}>
              <option value="Sezonier">Sezonier</option>
              <option value="Permanent">Permanent</option>
              <option value="Zilier">Zilier</option>
              <option value="Colaborator">Colaborator</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_culegator_tarif">Tarif (lei/kg)</Label>
            <Input
              id="edit_culegator_tarif"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="agri-control h-12"
              {...form.register('tarif_lei_kg')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_culegator_data">Data angajare</Label>
            <Input id="edit_culegator_data" type="date" className="agri-control h-12" {...form.register('data_angajare')} />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="edit_culegator_activ"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
              checked={Boolean(form.watch('status_activ'))}
              onChange={(event) => form.setValue('status_activ', event.target.checked, { shouldDirty: true })}
            />
            <Label htmlFor="edit_culegator_activ" className="cursor-pointer text-sm font-normal">
              Culegător activ
            </Label>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit_culegator_obs">Observații</Label>
            <Textarea id="edit_culegator_obs" rows={3} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii')} />
          </div>
        </div>
      </form>
    </AppDialog>
  )
}
