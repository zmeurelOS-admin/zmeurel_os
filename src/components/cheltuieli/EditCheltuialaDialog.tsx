'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { CheltuialaFormSummary } from '@/components/cheltuieli/CheltuialaFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCategoryCheltuieliOptions } from '@/lib/ui/app-select-maps'
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

  const watchedData = useWatch({ control: form.control, name: 'data' })
  const watchedCategorie = useWatch({ control: form.control, name: 'categorie' })
  const watchedSuma = useWatch({ control: form.control, name: 'suma_lei' })
  const watchedFurnizor = useWatch({ control: form.control, name: 'furnizor' })
  const watchedDescriere = useWatch({ control: form.control, name: 'descriere' })

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
      contentClassName="lg:max-w-[min(94vw,60rem)] xl:max-w-[min(92vw,64rem)]"
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
        <DesktopFormGrid
          aside={
            <CheltuialaFormSummary
              amount={watchedSuma}
              category={watchedCategorie}
              date={watchedData}
              supplier={watchedFurnizor}
              description={watchedDescriere}
              mode="edit"
            />
          }
        >
          <FormDialogSection label="Înregistrare">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <AppDatePicker
                id="edit_chelt_data"
                label="Data"
                placeholder="Selectează data"
                value={watchedData ?? ''}
                triggerClassName="h-12 md:h-11"
                onChange={(nextValue) =>
                  form.setValue('data', nextValue, { shouldDirty: true, shouldValidate: true })
                }
                error={form.formState.errors.data?.message}
              />

              <AppSelect
                id="edit_chelt_categorie"
                label="Categorie"
                placeholder="Selectează categoria"
                value={watchedCategorie ?? ''}
                options={buildCategoryCheltuieliOptions()}
                showSearchThreshold={12}
                triggerClassName="h-12 md:h-11"
                onChange={(nextValue) =>
                  form.setValue('categorie', nextValue, { shouldDirty: true, shouldValidate: true })
                }
                error={form.formState.errors.categorie?.message}
              />

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
                  <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.suma_lei.message}</p>
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
        </DesktopFormGrid>
      </form>
    </AppDialog>
  )
}

