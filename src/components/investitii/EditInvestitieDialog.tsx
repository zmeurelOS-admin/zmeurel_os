// src/components/investitii/EditInvestitieDialog.tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    onError: (error) => {
      console.error('Error updating investitie:', error)
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
          <div className="space-y-6 md:space-y-8">
            <FormDialogSection label="Înregistrare">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
                <div className="space-y-2">
                  <Label htmlFor="edit_inv_data">Data</Label>
                  <Input
                    id="edit_inv_data"
                    type="date"
                    className="agri-control h-12 md:h-11"
                    {...register('data')}
                  />
                  {errors.data ? <p className="text-xs text-red-600">{errors.data.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_inv_categorie">Categorie</Label>
                  <select
                    id="edit_inv_categorie"
                    className="agri-control h-12 w-full px-3 text-base md:h-11"
                    {...register('categorie')}
                  >
                    <option value="">Selectează categoria</option>
                    {CATEGORII_INVESTITII.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.categorie ? (
                    <p className="text-xs text-red-600">{errors.categorie.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_inv_parcela">Parcelă</Label>
                  <select
                    id="edit_inv_parcela"
                    className="agri-control h-12 w-full px-3 text-base md:h-11"
                    {...register('parcela_id')}
                  >
                    <option value="">Fără legătură cu parcelă</option>
                    {parcele.map((parcela: { id: string; nume_parcela: string | null }) => (
                      <option key={parcela.id} value={parcela.id}>
                        {parcela.nume_parcela || 'Parcela'}
                      </option>
                    ))}
                  </select>
                </div>

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
                    <p className="text-xs text-red-600">{errors.suma_lei.message}</p>
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
          </div>
        </form>
      )}
    </AppDialog>
  )
}

