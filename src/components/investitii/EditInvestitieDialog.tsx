// src/components/investitii/EditInvestitieDialog.tsx
'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { InvestitieFormSummary } from '@/components/investitii/InvestitieFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildCategoryInvestitiiOptions } from '@/lib/ui/app-select-maps'
import { Textarea } from '@/components/ui/textarea'
import { resolveInvestitieCategorie } from '@/lib/financial/categories'

import {
  Investitie,
  updateInvestitie,
  CATEGORII_INVESTITII,
} from '@/lib/supabase/queries/investitii'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

import { getParcele } from '@/lib/supabase/queries/parcele'
import { queryKeys } from '@/lib/query-keys'

// ===============================
// VALIDATION
// ===============================

const investitieSchema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().optional(),
  categorie: z.string().min(1, 'Categoria este obligatorie'),
  furnizor: z.string().optional(),
  descriere: z.string().optional(),
  suma_lei: z.string().min(1, 'Suma este obligatorie'),
})

type InvestitieFormData = z.infer<typeof investitieSchema>

interface EditInvestitieDialogProps {
  investitie: Investitie | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ===============================
// COMPONENT
// ===============================

export function EditInvestitieDialog({
  investitie,
  open,
  onOpenChange,
}: EditInvestitieDialogProps) {
  const queryClient = useQueryClient()

  const { data: parcele = [], isLoading: isLoadingParcele } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const isInitialDataLoading = open && isLoadingParcele && parcele.length === 0

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<InvestitieFormData>({
    resolver: zodResolver(investitieSchema),
    defaultValues: {
      data: '',
      parcela_id: '',
      categorie: '',
      furnizor: '',
      descriere: '',
      suma_lei: '',
    },
  })

  const watchedData = useWatch({ control, name: 'data' })
  const watchedParcelaId = useWatch({ control, name: 'parcela_id' })
  const watchedCategorie = useWatch({ control, name: 'categorie' })
  const watchedFurnizor = useWatch({ control, name: 'furnizor' })
  const watchedDescriere = useWatch({ control, name: 'descriere' })
  const watchedSuma = useWatch({ control, name: 'suma_lei' })
  const selectedParcelaName = watchedParcelaId
    ? parcele.find((parcela) => parcela.id === watchedParcelaId)?.nume_parcela
    : null

  useEffect(() => {
    if (investitie && open) {
      reset({
        data: investitie.data.split('T')[0],
        parcela_id: investitie.parcela_id ?? '',
        categorie: resolveInvestitieCategorie(investitie.categorie),
        furnizor: investitie.furnizor ?? '',
        descriere: investitie.descriere ?? '',
        suma_lei: investitie.suma_lei.toString(),
      })
    }
  }, [investitie, open, reset])

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: {
        data: string
        parcela_id?: string
        categorie: string
        furnizor?: string
        descriere?: string
        suma_lei: number
      }
    }) => updateInvestitie(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
      hapticSuccess()
      toast.success('Investiție actualizată cu succes!')
      onOpenChange(false)
    },
    onError: () => {
      
      hapticError()
      toast.error('Eroare la actualizarea investiției')
    },
  })

  const handleClose = () => {
    if (updateMutation.isPending) return
    onOpenChange(false)
  }

  const onSubmit = (data: InvestitieFormData) => {
    if (!investitie) return

    updateMutation.mutate({
      id: investitie.id,
      data: {
        data: data.data,
        parcela_id: data.parcela_id || undefined,
        categorie: resolveInvestitieCategorie(data.categorie),
        furnizor: data.furnizor || undefined,
        descriere: data.descriere || undefined,
        suma_lei: Number(data.suma_lei),
      },
    })
  }

  if (!investitie) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează investitie"
      desktopFormWide
      contentClassName="lg:max-w-[min(94vw,60rem)] xl:max-w-[min(92vw,64rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={handleClose}
          onSave={handleSubmit(onSubmit)}
          saving={updateMutation.isPending}
          disabled={isInitialDataLoading}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      {isInitialDataLoading ? (
        <DialogInitialDataSkeleton compact />
      ) : (
        <form className="space-y-0" onSubmit={handleSubmit(onSubmit)}>
          <DesktopFormGrid
            aside={
              <InvestitieFormSummary
                amount={watchedSuma}
                category={watchedCategorie}
                date={watchedData}
                parcelaName={selectedParcelaName}
                supplier={watchedFurnizor}
                description={watchedDescriere}
                mode="edit"
              />
            }
          >
            <FormDialogSection label="Înregistrare">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
                <AppDatePicker
                  id="edit_inv_data"
                  label="Data"
                  placeholder="Selectează data"
                  value={watchedData ?? ''}
                  triggerClassName="h-12 md:h-11"
                  onChange={(nextValue) =>
                    setValue('data', nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.data?.message}
                />

                <AppSelect
                  id="edit_inv_categorie"
                  label="Categorie"
                  placeholder="Selectează categoria"
                  value={watchedCategorie ?? ''}
                  options={buildCategoryInvestitiiOptions()}
                  showSearchThreshold={12}
                  triggerClassName="h-12 md:h-11"
                  onChange={(nextValue) =>
                    setValue('categorie', nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.categorie?.message}
                />

                <AppSelect
                  id="edit_inv_parcela"
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
                    setValue('parcela_id', nextValue, { shouldDirty: true, shouldValidate: true })
                  }
                />

                <div className="space-y-2">
                  <Label htmlFor="edit_inv_suma">Suma investită (lei)</Label>
                  <Input
                    id="edit_inv_suma"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="agri-control h-12 md:h-11"
                    placeholder="Ex: 1500.00"
                    {...register('suma_lei')}
                  />
                  {errors.suma_lei ? (
                    <p className="text-xs text-[var(--status-danger-text)]">{errors.suma_lei.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit_inv_furnizor">Furnizor</Label>
                  <Input
                    id="edit_inv_furnizor"
                    type="text"
                    className="agri-control h-12 md:h-11"
                    {...register('furnizor')}
                  />
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Detalii">
              <div className="space-y-2">
                <Label htmlFor="edit_inv_descriere">Descriere</Label>
                <Textarea
                  id="edit_inv_descriere"
                  rows={4}
                  className="agri-control w-full px-3 py-2 text-base md:min-h-[7.5rem]"
                  {...register('descriere')}
                />
              </div>
            </FormDialogSection>
          </DesktopFormGrid>
        </form>
      )}
    </AppDialog>
  )
}

