'use client'

import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateClientId } from '@/lib/offline/generateClientId'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { hapticError } from '@/lib/utils/haptic'

const CATEGORII_CHELTUIELI = [
  'Electricitate',
  'Motorina Transport',
  'Ambalaje',
  'Etichete',
  'Reparatii Utilaje',
  'Scule',
  'Fertilizare',
  'Pesticide',
  'Intretinere Curenta',
  'Cules',
  'Manoperă cules',
  'Material Saditor',
  'Sistem Sustinere',
  'Sistem Irigatie',
  'Altele',
]

const cheltuialaSchema = z.object({
  client_sync_id: z.string().optional(),
  data: z.string().min(1, 'Data este obligatorie'),
  categorie: z.string().min(1, 'Selecteaza categoria'),
  suma_lei: z
    .string()
    .min(1, 'Suma este obligatorie')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'Suma trebuie să fie pozitivă',
    }),
  furnizor: z.string().optional(),
  descriere: z.string().optional(),
})

export type CheltuialaFormData = z.infer<typeof cheltuialaSchema>

interface AddCheltuialaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CheltuialaFormData) => Promise<void>
}

const defaultValues = (): CheltuialaFormData => ({
  client_sync_id: undefined,
  data: new Date().toISOString().split('T')[0],
  categorie: '',
  suma_lei: '',
  furnizor: '',
  descriere: '',
})

export function AddCheltuialaDialog({ open, onOpenChange, onSubmit }: AddCheltuialaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true
      submittedRef.current = false
      trackEvent({ eventName: 'open_create_form', moduleName: 'cheltuieli', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'cheltuieli', status: 'abandoned' })
    }
  }, [open])

  const form = useForm<CheltuialaFormData>({
    resolver: zodResolver(cheltuialaSchema),
    defaultValues: defaultValues(),
  })

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
  }

  const handleSubmit = async (data: CheltuialaFormData) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        ...data,
        client_sync_id: data.client_sync_id ?? generateClientId(),
      })
      submittedRef.current = true
      trackEvent({ eventName: 'create_success', moduleName: 'cheltuieli', status: 'success' })
      form.reset(defaultValues())
      onOpenChange(false)
    } catch (error: unknown) {
      const maybeError = error as { status?: number; code?: string }
      const conflict = maybeError?.status === 409 || maybeError?.code === '23505'
      if (conflict) {
        submittedRef.current = true
        toast.info('Inregistrarea era deja sincronizat?.')
        onOpenChange(false)
        return
      }

      trackEvent({ eventName: 'create_failed', moduleName: 'cheltuieli', status: 'failed' })
      console.error('Error creating cheltuiala:', error)
      hapticError()
      toast.error('Eroare la salvare.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă cheltuială"
      footer={
        <DialogFormActions
          onCancel={handleClose}
          onSave={form.handleSubmit(handleSubmit)}
          saving={isSubmitting}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="chelt_data">Data</Label>
          <Input id="chelt_data" type="date" className="agri-control h-12" {...form.register('data')} />
          {form.formState.errors.data ? <p className="text-xs text-red-600">{form.formState.errors.data.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="chelt_categorie">Categorie</Label>
          <select id="chelt_categorie" className="agri-control h-12 w-full px-3 text-base" {...form.register('categorie')}>
            <option value="">Selectează categoria</option>
            {CATEGORII_CHELTUIELI.map((categorie) => (
              <option key={categorie} value={categorie}>
                {categorie}
              </option>
            ))}
          </select>
          {form.formState.errors.categorie ? <p className="text-xs text-red-600">{form.formState.errors.categorie.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="chelt_suma">Suma (lei)</Label>
          <Input
            id="chelt_suma"
            type="number"
            inputMode="decimal"
            pattern="[0-9]*"
            step="0.01"
            min="0"
            className="agri-control h-12"
            placeholder="Ex: 150.50"
            {...form.register('suma_lei')}
          />
          {form.formState.errors.suma_lei ? <p className="text-xs text-red-600">{form.formState.errors.suma_lei.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="chelt_furnizor">Furnizor / Magazin</Label>
          <Input id="chelt_furnizor" className="agri-control h-12" placeholder="Ex: Lidl, Dedeman, Petrom" {...form.register('furnizor')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chelt_descriere">Descriere</Label>
          <Textarea
            id="chelt_descriere"
            rows={4}
            className="agri-control w-full px-3 py-2 text-base"
            placeholder="Ex: Electricitate pompa, factura 12345"
            {...form.register('descriere')}
          />
          <p className="text-xs text-[var(--agri-text-muted)]">Detalii suplimentare (factura, observații etc.)</p>
        </div>
      </form>
    </AppDrawer>
  )
}

