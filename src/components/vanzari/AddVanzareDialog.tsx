'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { VanzareFormSummary } from '@/components/vanzari/VanzareFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { queryKeys } from '@/lib/query-keys'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { CALITATI_VANZARE, createVanzare, STATUS_PLATA, type Vanzare } from '@/lib/supabase/queries/vanzari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

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
  /** Listă deja încărcată în pagină (fără query suplimentar în dialog). */
  tenantVanzari?: Vanzare[]
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

function calitateLabel(cal: string): string {
  return cal === 'cal1' ? 'Calitatea 1' : 'Calitatea 2'
}

export function AddVanzareDialog({ open, onOpenChange, hideTrigger = false, tenantVanzari }: AddVanzareDialogProps) {
  void hideTrigger
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
  const watchedQty = useWatch({ control: form.control, name: 'cantitate_kg' })
  const watchedPret = useWatch({ control: form.control, name: 'pret_lei_kg' })
  const watchedCalitate = useWatch({ control: form.control, name: 'calitate' })
  const watchedStatus = useWatch({ control: form.control, name: 'status_plata' })
  const watchedData = useWatch({ control: form.control, name: 'data' })
  const watchedObs = useWatch({ control: form.control, name: 'observatii_ladite' })

  const selectedClient = useMemo(
    () => (selectedClientId ? clienti.find((c) => c.id === selectedClientId) : undefined),
    [clienti, selectedClientId],
  )

  const totalRon = useMemo(() => {
    const q = Number(String(watchedQty ?? '').replace(',', '.'))
    const p = Number(String(watchedPret ?? '').replace(',', '.'))
    if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return null
    return q * p
  }, [watchedQty, watchedPret])

  const vanzariClientCount = useMemo(() => {
    if (!selectedClientId || !tenantVanzari?.length) return null
    return tenantVanzari.filter((v) => v.client_id === selectedClientId).length
  }, [tenantVanzari, selectedClientId])

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
      data: data.data,
      client_id: data.client_id || undefined,
      calitate: data.calitate,
      cantitate_kg: Number(data.cantitate_kg),
      pret_lei_kg: Number(data.pret_lei_kg),
      status_plata: data.status_plata,
      observatii_ladite: data.observatii_ladite?.trim() || undefined,
    })
  }

  const handleClose = () => {
    if (createMutation.isPending) return
    setDialogOpen(false)
  }

  const dataAsideLabel = useMemo(() => {
    const d = watchedData?.trim()
    if (!d) return '—'
    const parsed = new Date(`${d.slice(0, 10)}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('ro-RO')
  }, [watchedData])

  const statusVariant =
    watchedStatus === 'platit' ? 'success' : watchedStatus === 'restanta' ? 'warning' : 'neutral'

  return (
    <>
      <AppDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Adaugă vânzare"
        desktopFormWide
        contentClassName="lg:max-w-[min(94vw,56rem)] xl:max-w-[min(92vw,60rem)]"
        footer={
          <DialogFormActions
            className="w-full"
            onCancel={handleClose}
            onSave={form.handleSubmit(onSubmit)}
            saving={createMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
          <DesktopFormGrid
            aside={
              <VanzareFormSummary
                clientName={selectedClient?.nume_client}
                clientPhone={selectedClient?.telefon ?? undefined}
                clientAddress={selectedClient?.adresa ?? undefined}
                qualityLabel={calitateLabel(watchedCalitate || 'cal1')}
                quantity={watchedQty}
                unitPrice={watchedPret}
                totalRon={totalRon}
                statusLabel={formatStatusPlataLabel(watchedStatus || '')}
                statusVariant={statusVariant}
                dateLabel={dataAsideLabel}
                notes={watchedObs}
                mode="create"
                relatedSalesCount={vanzariClientCount}
                relatedSalesLabel="Vânzări existente (acest client)"
              />
            }
          >
              <FormDialogSection label="Client">
                <div className="space-y-2">
                  <Label htmlFor="v_client">Client</Label>
                  <select
                    id="v_client"
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="agri-control h-12 w-full px-3 text-base md:h-11"
                  >
                    <option value="">Fără client specificat</option>
                    {clienti.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nume_client}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2 md:gap-x-6 md:gap-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</p>
                    <p className="text-sm text-[var(--text-primary)]">{selectedClient?.telefon?.trim() || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[var(--text-tertiary)]">Locație</p>
                    <p className="text-sm text-[var(--text-primary)]">{selectedClient?.adresa?.trim() || '—'}</p>
                  </div>
                </div>
              </FormDialogSection>

              <FormDialogSection label="Vânzare">
                <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="v_calitate">Calitate produs</Label>
                    <select id="v_calitate" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('calitate')}>
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
                      className="agri-control h-12 md:h-11"
                      {...form.register('cantitate_kg')}
                    />
                    {form.formState.errors.cantitate_kg ? (
                      <p className="text-xs text-red-600">{form.formState.errors.cantitate_kg.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="v_price">Preț (lei/kg)</Label>
                    <Input
                      id="v_price"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      className="agri-control h-12 md:h-11 md:max-w-md"
                      {...form.register('pret_lei_kg')}
                    />
                    {form.formState.errors.pret_lei_kg ? (
                      <p className="text-xs text-red-600">{form.formState.errors.pret_lei_kg.message}</p>
                    ) : null}
                  </div>
                </div>
              </FormDialogSection>

              <FormDialogSection label="Financiar">
                <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="v_data">Data vânzării</Label>
                    <Input id="v_data" type="date" className="agri-control h-12 md:h-11" {...form.register('data')} />
                    {form.formState.errors.data ? <p className="text-xs text-red-600">{form.formState.errors.data.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="v_status">Status plată</Label>
                    <select id="v_status" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('status_plata')}>
                      {STATUS_PLATA.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusPlataLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FormDialogSection>

              <FormDialogSection label="Observații">
                <Textarea
                  id="v_obs"
                  rows={3}
                  className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6rem]"
                  {...form.register('observatii_ladite')}
                />
              </FormDialogSection>
          </DesktopFormGrid>
        </form>
      </AppDrawer>
    </>
  )
}
