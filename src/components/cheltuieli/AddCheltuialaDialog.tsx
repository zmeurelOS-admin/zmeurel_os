'use client'

import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CheltuialaFormSummary } from '@/components/cheltuieli/CheltuialaFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCategoryCheltuieliOptions, CHELTUIELI_CATEGORY_EMOJI } from '@/lib/ui/app-select-maps'
import { Textarea } from '@/components/ui/textarea'
import { generateClientId } from '@/lib/offline/generateClientId'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { hapticError } from '@/lib/utils/haptic'
import { CATEGORII_CHELTUIELI, resolveCheltuialaCategorie } from '@/lib/financial/categories'
import { queryKeys } from '@/lib/query-keys'
import { getFrequentCheltuieliSuppliers } from '@/lib/supabase/queries/cheltuieli'

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

function formatCompactDate(value: string): string {
  if (!value) return 'Selectează data'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  const now = new Date()
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const prefix = value === today ? 'Azi · ' : ''
  return `${prefix}${parsed.toLocaleDateString('ro-RO')}`
}

export function AddCheltuialaDialog({ open, onOpenChange, onSubmit, initialValues }: AddCheltuialaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mobileDescriptionOpen, setMobileDescriptionOpen] = useState(false)
  const [mobileSupplierInputOpen, setMobileSupplierInputOpen] = useState(false)
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
  const { data: frequentSuppliers = [] } = useQuery({
    queryKey: queryKeys.cheltuieliFrequentSuppliers,
    queryFn: () => getFrequentCheltuieliSuppliers(4),
    enabled: open,
    staleTime: 0,
  })
  const primaryCategories = CATEGORII_CHELTUIELI.slice(0, 8)
  const selectedOtherCategory =
    watchedCategorie && !primaryCategories.includes(watchedCategorie as (typeof primaryCategories)[number])
      ? watchedCategorie
      : ''

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
      setMobileDescriptionOpen(false)
      setMobileSupplierInputOpen(Boolean(initialValues?.furnizor))
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
          <FormDialogSection className="md:hidden">
            <div className="space-y-3">
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {formatCompactDate(watchedData ?? '')}
                </span>
                <button
                  type="button"
                  className="min-h-11 shrink-0 text-sm font-semibold text-[var(--primary)]"
                  onClick={() => document.getElementById('chelt_data_mobile')?.click()}
                >
                  Schimbă
                </button>
              </div>
              <div className="absolute h-px w-px overflow-hidden">
                <AppDatePicker
                  id="chelt_data_mobile"
                  value={watchedData ?? ''}
                  onChange={(nextValue) =>
                    form.setValue('data', nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                  error={form.formState.errors.data?.message}
                />
              </div>

              <div className="space-y-2">
                <Label>Categorie</Label>
                <div className="grid grid-cols-3 gap-2">
                  {primaryCategories.map((category) => {
                    const selected = category === watchedCategorie
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          form.setValue('categorie', category, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          selected
                            ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="block text-base" aria-hidden>
                          {CHELTUIELI_CATEGORY_EMOJI[category]}
                        </span>
                        <span className="block leading-tight">{category}</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    aria-pressed={Boolean(selectedOtherCategory)}
                    onClick={() => document.getElementById('chelt_categorie_mobile_more')?.click()}
                    className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      selectedOtherCategory
                        ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <MoreHorizontal className="mx-auto h-4 w-4" aria-hidden />
                    <span className="block leading-tight">Altele</span>
                  </button>
                </div>
                <div className="absolute h-px w-px overflow-hidden">
                  <AppSelect
                    id="chelt_categorie_mobile_more"
                    label="Selectează categoria"
                    value={watchedCategorie ?? ''}
                    options={buildCategoryCheltuieliOptions()}
                    showSearchThreshold={0}
                    searchPlaceholder="Caută categoria..."
                    onChange={(nextValue) =>
                      form.setValue('categorie', nextValue, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
                {selectedOtherCategory ? (
                  <p className="text-xs font-medium text-[var(--primary)]">
                    Selectată: {selectedOtherCategory}
                  </p>
                ) : null}
                {form.formState.errors.categorie ? (
                  <p className="text-xs text-[var(--danger-text)]">
                    {form.formState.errors.categorie.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="chelt_suma_mobile">Sumă (lei)</Label>
                <Input
                  id="chelt_suma_mobile"
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  step="0.01"
                  min="0"
                  className="agri-control h-12 border-[var(--primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
                  placeholder="Ex: 150.50"
                  {...form.register('suma_lei')}
                />
                {form.formState.errors.suma_lei ? (
                  <p className="text-xs text-[var(--danger-text)]">
                    {form.formState.errors.suma_lei.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Furnizor / Magazin</Label>
                {frequentSuppliers.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {frequentSuppliers.map((supplier) => {
                      const selected = supplier === watchedFurnizor
                      return (
                        <button
                          key={supplier}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            form.setValue('furnizor', supplier, { shouldDirty: true })
                            setMobileSupplierInputOpen(false)
                          }}
                          className={`min-h-11 truncate rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                            selected
                              ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                              : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {supplier}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSupplierInputOpen(true)
                        window.requestAnimationFrame(() =>
                          document.getElementById('chelt_furnizor_mobile')?.focus()
                        )
                      }}
                      className="min-h-11 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-2 py-2 text-xs font-semibold text-[var(--text-secondary)] transition"
                    >
                      + Alt furnizor
                    </button>
                  </div>
                ) : null}
                {frequentSuppliers.length === 0 || mobileSupplierInputOpen ? (
                  <Input
                    id="chelt_furnizor_mobile"
                    className="agri-control h-12"
                    placeholder="Ex: Lidl, Dedeman, Petrom"
                    {...form.register('furnizor')}
                  />
                ) : null}
              </div>

              <Collapsible open={mobileDescriptionOpen} onOpenChange={setMobileDescriptionOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--text-primary)]"
                  >
                    Descriere (opțional)
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mobileDescriptionOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-2">
                  <Textarea
                    id="chelt_descriere_mobile"
                    rows={3}
                    className="agri-control w-full px-3 py-2 text-base"
                    placeholder="Ex: Electricitate pompa, factura 12345"
                    {...form.register('descriere')}
                  />
                  <p className="text-xs text-[var(--agri-text-muted)]">
                    Detalii suplimentare (factura, observații etc.)
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </FormDialogSection>

          <FormDialogSection label="Înregistrare" className="hidden md:block">
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

          <FormDialogSection label="Detalii" className="hidden md:block">
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

