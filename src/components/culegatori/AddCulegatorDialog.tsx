'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const culegatorSchema = z.object({
  nume_prenume: z.string().trim().min(2, 'Numele trebuie sa aiba minim 2 caractere'),
  telefon: z.string().optional(),
  tip_angajare: z.string().min(1, 'Selecteaza tipul de angajare'),
  tarif_lei_kg: z.string().optional(),
  data_angajare: z.string().optional(),
  status_activ: z.boolean().optional(),
  observatii: z.string().optional(),
})

type CulegatorFormData = z.infer<typeof culegatorSchema>

interface AddCulegatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CulegatorFormData) => Promise<void>
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

export function AddCulegatorDialog({ open, onOpenChange, onSubmit }: AddCulegatorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CulegatorFormData>({
    resolver: zodResolver(culegatorSchema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (!open) form.reset(defaults())
  }, [open, form])

  const handleSubmit = async (data: CulegatorFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă culegător nou"
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
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="culegator_nume">Nume și prenume</Label>
          <Input id="culegator_nume" className="agri-control h-12" placeholder="Popescu Ion" {...form.register('nume_prenume')} />
          {form.formState.errors.nume_prenume ? <p className="text-xs text-red-600">{form.formState.errors.nume_prenume.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="culegator_telefon">Telefon</Label>
          <Input id="culegator_telefon" type="tel" className="agri-control h-12" placeholder="0740123456" {...form.register('telefon')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="culegator_tip">Tip angajare</Label>
          <select id="culegator_tip" className="agri-control h-12 w-full px-3 text-base" {...form.register('tip_angajare')}>
            <option value="Sezonier">Sezonier</option>
            <option value="Permanent">Permanent</option>
            <option value="Zilier">Zilier</option>
            <option value="Colaborator">Colaborator</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="culegator_tarif">Tarif (lei/kg)</Label>
          <Input
            id="culegator_tarif"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="agri-control h-12"
            placeholder="0"
            {...form.register('tarif_lei_kg')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="culegator_data">Data angajare</Label>
          <Input id="culegator_data" type="date" className="agri-control h-12" {...form.register('data_angajare')} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="culegator_activ"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={Boolean(form.watch('status_activ'))}
            onChange={(event) => form.setValue('status_activ', event.target.checked, { shouldDirty: true })}
          />
          <Label htmlFor="culegator_activ" className="cursor-pointer text-sm font-normal">
            Culegător activ
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="culegator_obs">Observații</Label>
          <Textarea id="culegator_obs" rows={4} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii')} />
        </div>
      </form>
    </AppDrawer>
  )
}
