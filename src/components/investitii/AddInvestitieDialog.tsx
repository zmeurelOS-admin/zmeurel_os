'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
}

const defaultValues = (): InvestitieFormData => ({
  data: new Date().toISOString().split('T')[0],
  parcela_id: '',
  categorie: '',
  furnizor: '',
  descriere: '',
  suma_lei: '',
})

export function AddInvestitieDialog({ open, onOpenChange, hideTrigger = false }: AddInvestitieDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const queryClient = useQueryClient()

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const form = useForm<InvestitieFormData>({
    resolver: zodResolver(investitieSchema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (!dialogOpen) form.reset(defaultValues())
  }, [dialogOpen, form])

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
      console.error('Error creating investitie:', error)
      hapticError()
      toast.error('Eroare la adaugarea investitiei')
    },
  })

  const onSubmit = (data: InvestitieFormData) => {
    if (createMutation.isPending) return

    createMutation.mutate({
      data: data.data,
      parcela_id: data.parcela_id || undefined,
      categorie: data.categorie,
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
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDialogOpen(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
              onClick={form.handleSubmit(onSubmit)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                'Salvează'
              )}
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="inv_data">Data</Label>
            <Input id="inv_data" type="date" className="agri-control h-12" {...form.register('data')} />
            {form.formState.errors.data ? <p className="text-xs text-red-600">{form.formState.errors.data.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_categorie">Categorie</Label>
            <select id="inv_categorie" className="agri-control h-12 w-full px-3 text-base" {...form.register('categorie')}>
              <option value="">Selectează categoria</option>
              {CATEGORII_INVESTITII.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {form.formState.errors.categorie ? <p className="text-xs text-red-600">{form.formState.errors.categorie.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_parcela_id">Parcelă</Label>
            <select id="inv_parcela_id" className="agri-control h-12 w-full px-3 text-base" {...form.register('parcela_id')}>
              <option value="">Fără legătură cu parcelă</option>
              {parcele.map((parcela: { id: string; nume_parcela: string | null }) => (
                <option key={parcela.id} value={parcela.id}>
                  {parcela.nume_parcela || 'Parcela'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_suma_lei">Suma investita (lei)</Label>
            <Input
              id="inv_suma_lei"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="agri-control h-12"
              placeholder="Ex: 1500.00"
              {...form.register('suma_lei')}
            />
            {form.formState.errors.suma_lei ? <p className="text-xs text-red-600">{form.formState.errors.suma_lei.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_furnizor">Furnizor</Label>
            <Input id="inv_furnizor" className="agri-control h-12" {...form.register('furnizor')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_descriere">Descriere</Label>
            <Textarea id="inv_descriere" rows={4} className="agri-control w-full px-3 py-2 text-base" {...form.register('descriere')} />
          </div>
        </form>
      </AppDrawer>
    </>
  )
}
