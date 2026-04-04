'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import { CATEGORII_CHELTUIELI, resolveCheltuialaCategorie } from '@/lib/financial/categories'

const cheltuialaSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  categorie: z.string().min(1, 'Selecteaza categoria'),
  suma_lei: z.string().min(1, 'Suma este obligatorie'),
  furnizor: z.string().optional(),
  descriere: z.string().optional(),
})

export type EditCheltuialaFormData = z.infer<typeof cheltuialaSchema>

interface EditCheltuialaDialogProps {
  cheltuiala: Cheltuiala | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: EditCheltuialaFormData) => Promise<void>
}

export function EditCheltuialaDialog({ cheltuiala, open, onOpenChange, onSubmit }: EditCheltuialaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EditCheltuialaFormData>({
    resolver: zodResolver(cheltuialaSchema),
    defaultValues: {
      data: '',
      categorie: '',
      suma_lei: '',
      furnizor: '',
      descriere: '',
    },
  })

  useEffect(() => {
    if (cheltuiala && open) {
      form.reset({
        data: cheltuiala.data,
        categorie: resolveCheltuialaCategorie(cheltuiala.categorie),
        suma_lei: String(cheltuiala.suma_lei ?? ''),
        furnizor: cheltuiala.furnizor ?? '',
        descriere: cheltuiala.descriere ?? '',
      })
    }
  }, [cheltuiala, open, form])

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
  }

  const handleSubmit = async (data: EditCheltuialaFormData) => {
    if (!cheltuiala || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(cheltuiala.id, {
        ...data,
        categorie: resolveCheltuialaCategorie(data.categorie),
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating cheltuiala:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!cheltuiala) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează cheltuială"
      desktopFormWide
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={handleClose}
          onSave={form.handleSubmit(handleSubmit)}
          saving={isSubmitting}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="space-y-6 md:space-y-8">
          <FormDialogSection label="Înregistrare">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <div className="space-y-2">
                <Label htmlFor="edit_chelt_data">Data</Label>
                <Input
                  id="edit_chelt_data"
                  type="date"
                  className="agri-control h-12 md:h-11"
                  {...form.register('data')}
                />
                {form.formState.errors.data ? (
                  <p className="text-xs text-red-600">{form.formState.errors.data.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_chelt_categorie">Categorie</Label>
                <select
                  id="edit_chelt_categorie"
                  className="agri-control h-12 w-full px-3 text-base md:h-11"
                  {...form.register('categorie')}
                >
                  <option value="">Selectează categoria</option>
                  {CATEGORII_CHELTUIELI.map((categorie) => (
                    <option key={categorie} value={categorie}>
                      {categorie}
                    </option>
                  ))}
                </select>
                {form.formState.errors.categorie ? (
                  <p className="text-xs text-red-600">{form.formState.errors.categorie.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_chelt_suma">Suma (lei)</Label>
                <Input
                  id="edit_chelt_suma"
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  step="0.01"
                  min="0"
                  className="agri-control h-12 md:h-11"
                  placeholder="Ex: 150.50"
                  {...form.register('suma_lei')}
                />
                {form.formState.errors.suma_lei ? (
                  <p className="text-xs text-red-600">{form.formState.errors.suma_lei.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_chelt_furnizor">Furnizor / Magazin</Label>
                <Input
                  id="edit_chelt_furnizor"
                  className="agri-control h-12 md:h-11"
                  placeholder="Ex: Lidl, Dedeman, Petrom"
                  {...form.register('furnizor')}
                />
              </div>
            </div>
          </FormDialogSection>

          <FormDialogSection label="Detalii">
            <div className="space-y-2">
              <Label htmlFor="edit_chelt_descriere">Descriere</Label>
              <Textarea
                id="edit_chelt_descriere"
                rows={4}
                className="agri-control w-full px-3 py-2 text-base md:min-h-[7.5rem]"
                placeholder="Detalii suplimentare"
                {...form.register('descriere')}
              />
            </div>
          </FormDialogSection>
        </div>
      </form>
    </AppDialog>
  )
}

