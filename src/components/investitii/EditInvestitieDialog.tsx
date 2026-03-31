// src/components/investitii/EditInvestitieDialog.tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import {
  AppDialog,
} from '@/components/app/AppDialog'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { Button } from '@/components/ui/button'
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
  } = useForm<InvestitieFormData>({
    resolver: zodResolver(investitieSchema),
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
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anulează
          </Button>
          <Button
            type="submit"
            form="edit-investitie-form"
            disabled={updateMutation.isPending || isInitialDataLoading}
            className="bg-[#F16B6B] hover:bg-[#E05A5A]"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se salvează...
              </>
            ) : (
              'Salvează'
            )}
          </Button>
        </>
      }
    >
        {isInitialDataLoading ? <DialogInitialDataSkeleton compact /> : (
        <form id="edit-investitie-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Data</Label>
            <Input type="date" {...register('data')} />
          </div>

          <div>
            <Label>Categorie</Label>
            <select
              {...register('categorie')}
              className="agri-control h-10 w-full px-3 py-2 text-sm"
            >
              <option value="">Selectează categoria...</option>
              {CATEGORII_INVESTITII.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Parcelă</Label>
            <select
              {...register('parcela_id')}
              className="agri-control h-10 w-full px-3 py-2 text-sm"
            >
              <option value="">Fără legătură cu parcelă</option>
              {parcele.map((parcela: { id: string; nume_parcela: string | null }) => (
                <option key={parcela.id} value={parcela.id}>
                  {parcela.nume_parcela || 'Parcela'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Sumă (lei)</Label>
            <Input type="number" step="0.01" {...register('suma_lei')} />
          </div>

          <div>
            <Label>Furnizor</Label>
            <Input type="text" {...register('furnizor')} />
          </div>

          <div>
            <Label>Descriere</Label>
            <Textarea rows={2} {...register('descriere')} />
          </div>

        </form>
        )}
    </AppDialog>
  )
}

