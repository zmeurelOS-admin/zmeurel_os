'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { STATUS_PLATA, updateVanzare, type Vanzare } from '@/lib/supabase/queries/vanzari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

const schema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  client_id: z.string().optional(),
  cantitate_kg: z
    .string()
    .trim()
    .min(1, 'Cantitatea este obligatorie')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'Cantitatea trebuie sa fie mai mare ca 0',
    }),
  pret_lei_kg: z
    .string()
    .trim()
    .min(1, 'Pretul este obligatoriu')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'Pretul trebuie sa fie mai mare ca 0',
    }),
  status_plata: z.string().min(1, 'Statusul este obligatoriu'),
  observatii_ladite: z.string().optional(),
})

type EditVanzareFormData = z.infer<typeof schema>

interface EditVanzareDialogProps {
  vanzare: Vanzare | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const defaults = (): EditVanzareFormData => ({
  data: new Date().toISOString().split('T')[0],
  client_id: '',
  cantitate_kg: '',
  pret_lei_kg: '',
  status_plata: 'Platit',
  observatii_ladite: '',
})

export function EditVanzareDialog({ vanzare, open, onOpenChange }: EditVanzareDialogProps) {
  const queryClient = useQueryClient()

  const form = useForm<EditVanzareFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (!open || !vanzare) return

    form.reset({
      data: vanzare.data ? new Date(vanzare.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      client_id: vanzare.client_id ?? '',
      cantitate_kg: String(vanzare.cantitate_kg ?? ''),
      pret_lei_kg: String(vanzare.pret_lei_kg ?? ''),
      status_plata: vanzare.status_plata || 'Platit',
      observatii_ladite: vanzare.observatii_ladite ?? '',
    })
  }, [open, vanzare, form])

  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const selectedClientId = useWatch({ control: form.control, name: 'client_id' }) ?? ''

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditVanzareFormData }) =>
      updateVanzare(id, {
        data: data.data,
        client_id: data.client_id || undefined,
        cantitate_kg: Number(data.cantitate_kg),
        pret_lei_kg: Number(data.pret_lei_kg),
        status_plata: data.status_plata,
        observatii_ladite: data.observatii_ladite?.trim() || undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      track('vanzare_edit', { id: variables.id })
      hapticSuccess()
      toast.success('Vânzare actualizata')
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Error updating vanzare:', error)
      hapticError()
      toast.error('Eroare la actualizarea vanzarii')
    },
  })

  if (!vanzare) return null

  const onSubmit = (data: EditVanzareFormData) => {
    if (updateMutation.isPending) return
    updateMutation.mutate({ id: vanzare.id, data })
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează vânzare"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(onSubmit)}
          saving={updateMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="ev_data">Data vanzarii</Label>
          <Input id="ev_data" type="date" className="agri-control h-12" {...form.register('data')} />
          {form.formState.errors.data ? <p className="text-xs text-red-600">{form.formState.errors.data.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ev_client">Client</Label>
          <select id="ev_client" className="agri-control h-12 w-full px-3 text-base" value={selectedClientId} onChange={(e) => form.setValue('client_id', e.target.value, { shouldDirty: true })}>
            <option value="">Fără client specificat</option>
            {clienti.map((client) => (
              <option key={client.id} value={client.id}>
                {client.nume_client}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ev_qty">Cantitate (kg)</Label>
            <Input id="ev_qty" type="number" inputMode="decimal" step="0.01" min="0.01" className="agri-control h-12" {...form.register('cantitate_kg')} />
            {form.formState.errors.cantitate_kg ? <p className="text-xs text-red-600">{form.formState.errors.cantitate_kg.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev_price">Pret lei/kg</Label>
            <Input id="ev_price" type="number" inputMode="decimal" step="0.01" min="0.01" className="agri-control h-12" {...form.register('pret_lei_kg')} />
            {form.formState.errors.pret_lei_kg ? <p className="text-xs text-red-600">{form.formState.errors.pret_lei_kg.message}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ev_status">Status plata</Label>
          <select id="ev_status" className="agri-control h-12 w-full px-3 text-base" {...form.register('status_plata')}>
            {STATUS_PLATA.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ev_obs">Observații ladite</Label>
          <Textarea id="ev_obs" rows={4} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii_ladite')} />
        </div>
      </form>
    </AppDialog>
  )
}
