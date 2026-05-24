'use client'

import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CheltuialaFormSummary } from '@/components/cheltuieli/CheltuialaFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCategoryCheltuieliOptions } from '@/lib/ui/app-select-maps'
import { Textarea } from '@/components/ui/textarea'
import { generateClientId } from '@/lib/offline/generateClientId'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { hapticError } from '@/lib/utils/haptic'
import { CATEGORII_CHELTUIELI, resolveCheltuialaCategorie } from '@/lib/financial/categories'

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
  initialValues?: Partial<Pick<CheltuialaFormData, 'data' | 'suma_lei' | 'descriere' | 'categorie' | 'furnizor'>>
}

const defaultValues = (): CheltuialaFormData => ({
  client_sync_id: undefined,
  data: new Date().toISOString().split('T')[0],
  categorie: '',
  suma_lei: '',
  furnizor: '',
  descriere: '',
})

export function AddCheltuialaDialog({ open, onOpenChange, onSubmit, initialValues }: AddCheltuialaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)

  const form = useForm<CheltuialaFormData>({
    resolver: zodResolver(cheltuialaSchema),
    defaultValues: defaultValues(),
  })

  const watchedData = useWatch({ control: form.control, name: 'data' })
  const watchedCategorie = useWatch({ control: form.control, name: 'categorie' })
  const watchedSuma = useWatch({ control: form.control, name: 'suma_lei' })
  const watchedFurnizor = useWatch({ control: form.control, name: 'furnizor' })
  const watchedDescriere = useWatch({ control: form.control, name: 'descriere' })

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true
      submittedRef.current = false
      form.reset({
        ...defaultValues(),
        ...(initialValues?.data ? { data: initialValues.data } : {}),
        ...(initialValues?.suma_lei != null ? { suma_lei: String(initialValues.suma_lei) } : {}),
        ...(initialValues?.categorie ? { categorie: resolveCheltuialaCategorie(initialValues.categorie) } : {}),
        ...(initialValues?.furnizor ? { furnizor: initialValues.furnizor } : {}),
        ...(initialValues?.descriere ? { descriere: initialValues.descriere } : {}),
      })
      trackEvent({ eventName: 'open_create_form', moduleName: 'cheltuieli', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'cheltuieli', status: 'abandoned' })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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
        categorie: resolveCheltuialaCategorie(data.categorie),
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
              mode="create"
            />
          }
        >
          <FormDialogSection label="Înregistrare">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <AppDatePicker
                id="chelt_data"
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
                id="chelt_categorie"
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
                <Label htmlFor="chelt_suma">Sumă (lei)</Label>
                <Input
                  id="chelt_suma"
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
                <Label htmlFor="chelt_furnizor">Furnizor / Magazin</Label>
                <Input
                  id="chelt_furnizor"
                  className="agri-control h-12 md:h-11"
                  placeholder="Ex: Lidl, Dedeman, Petrom"
                  {...form.register('furnizor')}
                />
              </div>
            </div>
          </FormDialogSection>

          <FormDialogSection label="Detalii">
            <div className="space-y-2">
              <Label htmlFor="chelt_descriere">Descriere</Label>
              <Textarea
                id="chelt_descriere"
                rows={3}
                className="agri-control w-full px-3 py-2 text-base md:min-h-[7.5rem]"
                placeholder="Ex: Electricitate pompa, factura 12345"
                {...form.register('descriere')}
              />
              <p className="text-xs text-[var(--agri-text-muted)]">
                Detalii suplimentare (factura, observații etc.)
              </p>
            </div>
          </FormDialogSection>
        </DesktopFormGrid>
      </form>
    </AppDrawer>
  )
}

