'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { generateClientId } from '@/lib/offline/generateClientId'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { CALITATI_VANZARE, createVanzare, STATUS_PLATA } from '@/lib/supabase/queries/vanzari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

const schema = z.object({
  data: z.string().min(1, 'Data este obligatorie'),
  client_id: z.string().optional(),
  calitate: z.enum(['cal1', 'cal2']),
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

type VanzareFormData = z.infer<typeof schema>

interface AddVanzareDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

const defaults = (): VanzareFormData => ({
  data: new Date().toISOString().split('T')[0],
  client_id: '',
  calitate: 'cal1',
  cantitate_kg: '',
  pret_lei_kg: '',
  status_plata: 'platit',
  observatii_ladite: '',
})

function formatStatusPlataLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function AddVanzareDialog({ open, onOpenChange, hideTrigger = false }: AddVanzareDialogProps) {
  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const form = useForm<VanzareFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (dialogOpen) {
      hasOpenedRef.current = true
      submittedRef.current = false
      trackEvent({ eventName: 'open_create_form', moduleName: 'vanzari', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'vanzari', status: 'abandoned' })
    }
    if (!dialogOpen) form.reset(defaults())
  }, [dialogOpen, form])

  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const selectedClientId = useWatch({ control: form.control, name: 'client_id' }) ?? ''

  const handleClientChange = (clientId: string) => {
    form.setValue('client_id', clientId, { shouldDirty: true })

    if (clientId) {
      const client = clienti.find((c) => c.id === clientId)
      if (client?.pret_negociat_lei_kg) {
        form.setValue('pret_lei_kg', String(client.pret_negociat_lei_kg), { shouldDirty: true })
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: createVanzare,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      submittedRef.current = true
      trackEvent({ eventName: 'create_success', moduleName: 'vanzari', status: 'success' })
      trackEvent('create_vanzare', 'vanzari', { source: 'AddVanzareDialog' })
      track('vanzare_add', {
        amount: Number(variables.cantitate_kg || 0) * Number(variables.pret_lei_kg || 0),
        client_id: variables.client_id ?? null,
        calitate: variables.calitate ?? 'cal1',
      })
      hapticSuccess()
      toast.success('Vânzare adaugata')
      setDialogOpen(false)
    },
    onError: (error) => {
      const maybeError = error as { status?: number; code?: string; message?: string; details?: string; hint?: string }
      const conflict = maybeError?.status === 409 || maybeError?.code === '23505'
      if (conflict) {
        submittedRef.current = true
        toast.info('Inregistrarea era deja sincronizat?.')
        setDialogOpen(false)
        return
      }

      trackEvent({ eventName: 'create_failed', moduleName: 'vanzari', status: 'failed' })
      const message =
        maybeError?.message ||
        maybeError?.details ||
        maybeError?.hint ||
        'Eroare la adaugarea vanzarii'

      hapticError()
      toast.error(message)
    },
  })

  const onSubmit = (data: VanzareFormData) => {
    if (createMutation.isPending) return

    createMutation.mutate({
      client_sync_id: generateClientId(),
      data: data.data,
      client_id: data.client_id || undefined,
      calitate: data.calitate,
      cantitate_kg: Number(data.cantitate_kg),
      pret_lei_kg: Number(data.pret_lei_kg),
      status_plata: data.status_plata,
      observatii_ladite: data.observatii_ladite?.trim() || undefined,
    })
  }

  return (
    <>
      <AppDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Adaugă vânzare"
        contentClassName="md:max-w-2xl"
        footer={
          <DialogFormActions
            onCancel={() => setDialogOpen(false)}
            onSave={form.handleSubmit(onSubmit)}
            saving={createMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Client: full-width */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="v_client">Client</Label>
              <select
                id="v_client"
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="agri-control h-12 w-full px-3 text-base"
              >
                <option value="">Fără client specificat</option>
                {clienti.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nume_client}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 1: Data + Status plată */}
            <div className="space-y-2">
              <Label htmlFor="v_data">Data vânzării</Label>
              <Input id="v_data" type="date" className="agri-control h-12" {...form.register('data')} />
              {form.formState.errors.data ? <p className="text-xs text-red-600">{form.formState.errors.data.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="v_status">Status plată</Label>
              <select id="v_status" className="agri-control h-12 w-full px-3 text-base" {...form.register('status_plata')}>
                {STATUS_PLATA.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusPlataLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2: Calitate + Cantitate */}
            <div className="space-y-2">
              <Label htmlFor="v_calitate">Calitate</Label>
              <select id="v_calitate" className="agri-control h-12 w-full px-3 text-base" {...form.register('calitate')}>
                {CALITATI_VANZARE.map((calitate) => (
                  <option key={calitate} value={calitate}>
                    {calitate === 'cal1' ? 'Calitatea 1' : 'Calitatea 2'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="v_qty">Cantitate (kg)</Label>
              <Input
                id="v_qty"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                className="agri-control h-12"
                {...form.register('cantitate_kg')}
              />
              {form.formState.errors.cantitate_kg ? <p className="text-xs text-red-600">{form.formState.errors.cantitate_kg.message}</p> : null}
            </div>

            {/* Preț: single column */}
            <div className="space-y-2">
              <Label htmlFor="v_price">Preț (lei/kg)</Label>
              <Input
                id="v_price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                className="agri-control h-12"
                {...form.register('pret_lei_kg')}
              />
              {form.formState.errors.pret_lei_kg ? <p className="text-xs text-red-600">{form.formState.errors.pret_lei_kg.message}</p> : null}
            </div>

            {/* Observații: full-width */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="v_obs">Observații lădițe</Label>
              <Textarea id="v_obs" rows={3} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii_ladite')} />
            </div>
          </div>
        </form>
      </AppDrawer>
    </>
  )
}
