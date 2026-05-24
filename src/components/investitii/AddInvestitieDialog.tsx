'use client'

import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCategoryInvestitiiOptions } from '@/lib/ui/app-select-maps'
import { Textarea } from '@/components/ui/textarea'
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
  suma_lei: z.string().min(1, 'Suma este obligatorie'),
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

export function AddInvestitieDialog({ open, onOpenChange, hideTrigger = false, initialValues }: AddInvestitieDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
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
      const maybeError = error as { status?: number; code?: string }
      const conflict = maybeError?.status === 409 || maybeError?.code === '23505'
      if (conflict) {
        toast.info('Inregistrarea era deja sincronizat?.')
        setDialogOpen(false)
        return
      }
      
      hapticError()
      toast.error('Eroare la adaugarea investitiei')
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
            <FormDialogSection label="Înregistrare">
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
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="agri-control h-12 md:h-11"
                    placeholder="Ex: 1500.00"
                    {...form.register('suma_lei')}
                  />
                  {form.formState.errors.suma_lei ? (
                    <p className="text-xs text-red-600">{form.formState.errors.suma_lei.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="inv_furnizor">Furnizor</Label>
                  <Input id="inv_furnizor" className="agri-control h-12 md:h-11" {...form.register('furnizor')} />
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Detalii">
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
