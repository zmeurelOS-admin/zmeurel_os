'use client'

import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { InvestitieFormSummary } from '@/components/investitii/InvestitieFormSummary'
import { Button } from '@/components/ui/button'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCategoryInvestitiiOptions, INVESTITII_CATEGORY_EMOJI } from '@/lib/ui/app-select-maps'
import { Textarea } from '@/components/ui/textarea'
import { getFinancialMutationError, logFinancialMutationError } from '@/lib/financial/save-errors'
import { decimalAmountSchema } from '@/lib/financial/decimal-amount-schema'
import { resolveInvestitieCategorie } from '@/lib/financial/categories'
import { createInvestitie, CATEGORII_INVESTITII } from '@/lib/supabase/queries/investitii'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

const investitieSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().optional(),
  categorie: z.string().min(1, 'Categoria este obligatorie'),
  furnizor: z.string().optional(),
  descriere: z.string().optional(),
  suma_lei: decimalAmountSchema(),
})

type InvestitieFormData = z.infer<typeof investitieSchema>

interface AddInvestitieDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  initialValues?: Partial<Pick<InvestitieFormData, 'data' | 'suma_lei' | 'categorie' | 'descriere'>>
}

const defaultValues = (): InvestitieFormData => ({
  data: new Date().toISOString().split('T')[0],
  parcela_id: '',
  categorie: '',
  furnizor: '',
  descriere: '',
  suma_lei: '',
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

export function AddInvestitieDialog({ open, onOpenChange, hideTrigger = false, initialValues }: AddInvestitieDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const queryClient = useQueryClient()

  const { data: parcele = [], isLoading: isLoadingParcele } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const isInitialDataLoading = dialogOpen && isLoadingParcele && parcele.length === 0

  const form = useForm<InvestitieFormData>({
    resolver: zodResolver(investitieSchema),
    defaultValues: defaultValues(),
  })

  const watchedData = useWatch({ control: form.control, name: 'data' })
  const watchedParcelaId = useWatch({ control: form.control, name: 'parcela_id' })
  const watchedCategorie = useWatch({ control: form.control, name: 'categorie' })
  const watchedFurnizor = useWatch({ control: form.control, name: 'furnizor' })
  const watchedDescriere = useWatch({ control: form.control, name: 'descriere' })
  const watchedSuma = useWatch({ control: form.control, name: 'suma_lei' })
  const selectedParcelaName = watchedParcelaId
    ? parcele.find((parcela) => parcela.id === watchedParcelaId)?.nume_parcela
    : null
  const mobileParcele = parcele.slice(0, 1 + parcele.length <= 6 ? parcele.length : 4)
  const hiddenParceleCount = Math.max(parcele.length - mobileParcele.length, 0)
  const selectedParcelaIsHidden =
    Boolean(watchedParcelaId) &&
    !mobileParcele.some((parcela) => parcela.id === watchedParcelaId)

  useEffect(() => {
    if (dialogOpen) {
      form.reset({
        ...defaultValues(),
        ...(initialValues?.data ? { data: initialValues.data } : {}),
        ...(initialValues?.suma_lei != null ? { suma_lei: String(initialValues.suma_lei) } : {}),
        ...(initialValues?.categorie ? { categorie: resolveInvestitieCategorie(initialValues.categorie) } : {}),
        ...(initialValues?.descriere ? { descriere: initialValues.descriere } : {}),
      })
    } else {
      form.reset(defaultValues())
    }
  }, [dialogOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: createInvestitie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
      hapticSuccess()
      toast.success('Investitie adaugata')
      setDialogOpen(false)
    },
    onError: (error: unknown) => {
      const resolvedError = getFinancialMutationError(error, {
        fallbackMessage: 'Nu am putut salva investiția.',
        module: 'investitii',
        operation: 'insert',
        tableOrRpc: 'public.investitii',
      })
      logFinancialMutationError(resolvedError)
      hapticError()
      toast.error(resolvedError.userMessage)
    },
  })

  const handleClose = () => {
    if (createMutation.isPending) return
    setDialogOpen(false)
  }

  const onSubmit = (data: InvestitieFormData) => {
    if (createMutation.isPending) return

    createMutation.mutate({
      data: data.data,
      parcela_id: data.parcela_id || undefined,
      categorie: resolveInvestitieCategorie(data.categorie),
      furnizor: data.furnizor || undefined,
      descriere: data.descriere || undefined,
      suma_lei: Number(data.suma_lei),
    })
  }

  return (
    <>
      {!hideTrigger ? (
        <Button type="button" className="h-14 w-full rounded-xl font-semibold" onClick={() => setDialogOpen(true)}>
          + Investitie
        </Button>
      ) : null}

      <AppDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Adaugă investitie (CAPEX)"
        desktopFormWide
        contentClassName="lg:max-w-[min(94vw,60rem)] xl:max-w-[min(92vw,64rem)]"
        footer={
          <DialogFormActions
            className="w-full"
            onCancel={handleClose}
            onSave={form.handleSubmit(onSubmit)}
            saving={createMutation.isPending}
            disabled={isInitialDataLoading}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        {isInitialDataLoading ? <DialogInitialDataSkeleton compact /> : (
        <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
          <DesktopFormGrid
            aside={
              <InvestitieFormSummary
                amount={watchedSuma}
                category={watchedCategorie}
                date={watchedData}
                parcelaName={selectedParcelaName}
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
                    onClick={() => document.getElementById('inv_data_mobile')?.click()}
                  >
                    Schimbă
                  </button>
                </div>
                <div className="absolute h-px w-px overflow-hidden">
                  <AppDatePicker
                    id="inv_data_mobile"
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
                    {CATEGORII_INVESTITII.map((category) => {
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
                            {INVESTITII_CATEGORY_EMOJI[category]}
                          </span>
                          <span className="block leading-tight">{category}</span>
                        </button>
                      )
                    })}
                  </div>
                  {form.formState.errors.categorie ? (
                    <p className="text-xs text-[var(--danger-text)]">
                      {form.formState.errors.categorie.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Parcelă</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      aria-pressed={!watchedParcelaId}
                      onClick={() =>
                        form.setValue('parcela_id', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                        !watchedParcelaId
                          ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                          : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Fără legătură cu parcelă
                    </button>
                    {mobileParcele.map((parcela) => {
                      const selected = parcela.id === watchedParcelaId
                      return (
                        <button
                          key={parcela.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            form.setValue('parcela_id', parcela.id, {
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
                          {parcela.nume_parcela || 'Parcela'}
                        </button>
                      )
                    })}
                    {hiddenParceleCount > 0 ? (
                      <button
                        type="button"
                        aria-pressed={selectedParcelaIsHidden}
                        onClick={() => document.getElementById('inv_parcela_mobile_more')?.click()}
                        className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          selectedParcelaIsHidden
                            ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                        }`}
                      >
                        +{hiddenParceleCount} alți
                      </button>
                    ) : null}
                  </div>
                  {hiddenParceleCount > 0 ? (
                    <div className="absolute h-px w-px overflow-hidden">
                      <AppSelect
                        id="inv_parcela_mobile_more"
                        label="Selectează parcela"
                        value={watchedParcelaId ?? ''}
                        options={[
                          { value: '', label: 'Fără legătură cu parcelă' },
                          ...parcele.map((parcela) => ({
                            value: parcela.id,
                            label: parcela.nume_parcela || 'Parcela',
                          })),
                        ]}
                        showSearchThreshold={0}
                        searchPlaceholder="Caută parcelă..."
                        onChange={(nextValue) =>
                          form.setValue('parcela_id', nextValue, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inv_suma_lei_mobile">Suma investită (lei)</Label>
                  <Input
                    id="inv_suma_lei_mobile"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]+([.,][0-9]+)?"
                    className="agri-control h-12 border-[var(--primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    placeholder="Ex: 1500,00"
                    {...form.register('suma_lei')}
                  />
                  {form.formState.errors.suma_lei ? (
                    <p className="text-xs text-[var(--danger-text)]">
                      {form.formState.errors.suma_lei.message}
                    </p>
                  ) : null}
                </div>

                <Collapsible open={mobileDetailsOpen} onOpenChange={setMobileDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Detalii suplimentare (opțional)
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${mobileDetailsOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="inv_furnizor_mobile">Furnizor</Label>
                      <Input
                        id="inv_furnizor_mobile"
                        className="agri-control h-12"
                        {...form.register('furnizor')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv_descriere_mobile">Descriere</Label>
                      <Textarea
                        id="inv_descriere_mobile"
                        rows={4}
                        className="agri-control w-full px-3 py-2 text-base"
                        {...form.register('descriere')}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Înregistrare" className="hidden md:block">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
                <div className="space-y-2">
                  <AppDatePicker
                    id="inv_data"
                    label="Data"
                    placeholder="Selectează data"
                    value={watchedData ?? ''}
                    triggerClassName="h-12 md:h-11"
                    onChange={(nextValue) =>
                      form.setValue('data', nextValue, { shouldDirty: true, shouldValidate: true })
                    }
                    error={form.formState.errors.data?.message}
                  />
                </div>

                <AppSelect
                  id="inv_categorie"
                  label="Categorie"
                  placeholder="Selectează categoria"
                  value={watchedCategorie ?? ''}
                  options={buildCategoryInvestitiiOptions()}
                  showSearchThreshold={12}
                  triggerClassName="h-12 md:h-11"
                  onChange={(nextValue) =>
                    form.setValue('categorie', nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                  error={form.formState.errors.categorie?.message}
                />

                <AppSelect
                  id="inv_parcela_id"
                  label="Parcelă"
                  placeholder="Fără legătură cu parcelă"
                  value={watchedParcelaId ?? ''}
                  options={[
                    { value: '', label: 'Fără legătură cu parcelă' },
                    ...parcele.map((parcela: { id: string; nume_parcela: string | null }) => ({
                      value: parcela.id,
                      label: parcela.nume_parcela || 'Parcela',
                    })),
                  ]}
                  showSearchThreshold={10}
                  searchPlaceholder="Caută parcelă..."
                  triggerClassName="h-12 md:h-11"
                  onChange={(nextValue) =>
                    form.setValue('parcela_id', nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                />

                <div className="space-y-2">
                  <Label htmlFor="inv_suma_lei">Suma investită (lei)</Label>
                  <Input
                    id="inv_suma_lei"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]+([.,][0-9]+)?"
                    className="agri-control h-12 md:h-11"
                    placeholder="Ex: 1500,00"
                    {...form.register('suma_lei')}
                  />
                  {form.formState.errors.suma_lei ? (
                    <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.suma_lei.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="inv_furnizor">Furnizor</Label>
                  <Input id="inv_furnizor" className="agri-control h-12 md:h-11" {...form.register('furnizor')} />
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Detalii" className="hidden md:block">
              <div className="space-y-2">
                <Label htmlFor="inv_descriere">Descriere</Label>
                <Textarea
                  id="inv_descriere"
                  rows={4}
                  className="agri-control w-full px-3 py-2 text-base md:min-h-[7.5rem]"
                  {...form.register('descriere')}
                />
              </div>
            </FormDialogSection>
          </DesktopFormGrid>
        </form>
        )}
      </AppDrawer>
    </>
  )
}
