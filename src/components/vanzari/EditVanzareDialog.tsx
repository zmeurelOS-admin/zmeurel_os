'use client'

import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StatusBadge from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { queryKeys } from '@/lib/query-keys'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { STATUS_PLATA, updateVanzare, type Vanzare } from '@/lib/supabase/queries/vanzari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

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
  /** Listă deja încărcată în pagină (fără query suplimentar în dialog). */
  tenantVanzari?: Vanzare[]
}

const defaults = (): EditVanzareFormData => ({
  data: new Date().toISOString().split('T')[0],
  client_id: '',
  cantitate_kg: '',
  pret_lei_kg: '',
  status_plata: 'platit',
  observatii_ladite: '',
})

function formatStatusPlataLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function clipNote(text: string | undefined, max = 100): string {
  const t = (text ?? '').trim()
  if (!t) return '—'
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function EditVanzareDialog({ vanzare, open, onOpenChange, tenantVanzari }: EditVanzareDialogProps) {
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
      status_plata: vanzare.status_plata || 'platit',
      observatii_ladite: vanzare.observatii_ladite ?? '',
    })
  }, [open, vanzare, form])

  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const selectedClientId = useWatch({ control: form.control, name: 'client_id' }) ?? ''
  const watchedQty = useWatch({ control: form.control, name: 'cantitate_kg' })
  const watchedPret = useWatch({ control: form.control, name: 'pret_lei_kg' })
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

  const alteVanzariClient = useMemo(() => {
    if (!selectedClientId || !tenantVanzari?.length || !vanzare) return null
    return tenantVanzari.filter((v) => v.client_id === selectedClientId && v.id !== vanzare.id).length
  }, [tenantVanzari, selectedClientId, vanzare])

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
    onSuccess: (result, variables) => {
      if (!result.success) {
        hapticError()
        toast.error(result.error)
        return
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      track('vanzare_edit', { id: variables.id })
      hapticSuccess()
      toast.success('Vânzare actualizata')
      onOpenChange(false)
    },
    onError: (error) => {
      hapticError()
      const message = error instanceof Error ? error.message : 'Eroare la actualizarea vanzarii'
      toast.error(message)
    },
  })

  const dataAsideLabel = useMemo(() => {
    const d = watchedData?.trim()
    if (!d) return '—'
    const parsed = new Date(`${d.slice(0, 10)}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('ro-RO')
  }, [watchedData])

  const statusVariant =
    watchedStatus === 'platit' ? 'success' : watchedStatus === 'restanta' ? 'warning' : 'neutral'

  if (!vanzare) return null

  const onSubmit = (data: EditVanzareFormData) => {
    if (updateMutation.isPending) return
    updateMutation.mutate({ id: vanzare.id, data })
  }

  const handleClose = () => {
    if (updateMutation.isPending) return
    onOpenChange(false)
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează vânzare"
      desktopFormWide
      contentClassName="lg:max-w-[min(94vw,56rem)] xl:max-w-[min(92vw,60rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={handleClose}
          onSave={form.handleSubmit(onSubmit)}
          saving={updateMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_min(280px,30%)] md:items-start md:gap-6 lg:gap-8">
          <div className="min-w-0 space-y-4 md:space-y-6">
            <FormDialogSection label="Client">
              <div className="space-y-2">
                <Label htmlFor="ev_client">Client</Label>
                <select
                  id="ev_client"
                  className="agri-control h-12 w-full px-3 text-base md:h-11"
                  value={selectedClientId}
                  onChange={(e) => form.setValue('client_id', e.target.value, { shouldDirty: true })}
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
                  <Label htmlFor="ev_qty">Cantitate (kg)</Label>
                  <Input id="ev_qty" type="number" inputMode="decimal" step="0.01" min="0.01" className="agri-control h-12 md:h-11" {...form.register('cantitate_kg')} />
                  {form.formState.errors.cantitate_kg ? <p className="text-xs text-red-600">{form.formState.errors.cantitate_kg.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ev_price">Preț (lei/kg)</Label>
                  <Input id="ev_price" type="number" inputMode="decimal" step="0.01" min="0.01" className="agri-control h-12 md:h-11" {...form.register('pret_lei_kg')} />
                  {form.formState.errors.pret_lei_kg ? <p className="text-xs text-red-600">{form.formState.errors.pret_lei_kg.message}</p> : null}
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Financiar">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ev_data">Data vânzării</Label>
                  <Input id="ev_data" type="date" className="agri-control h-12 md:h-11" {...form.register('data')} />
                  {form.formState.errors.data ? <p className="text-xs text-red-600">{form.formState.errors.data.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ev_status">Status plată</Label>
                  <select id="ev_status" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('status_plata')}>
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
              <Textarea id="ev_obs" rows={3} className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6rem]" {...form.register('observatii_ladite')} />
            </FormDialogSection>
          </div>

          <aside className="hidden md:block md:sticky md:top-2 md:self-start">
            <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 shadow-[var(--shadow-soft)]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Previzualizare</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
                  {selectedClient?.nume_client?.trim() || 'Fără client'}
                </p>
              </div>
              <dl className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cod vânzare</dt>
                  <dd className="mt-0.5 font-mono text-xs text-[var(--text-primary)]">{vanzare.id_vanzare || vanzare.id.slice(0, 8)}</dd>
                </div>
                {vanzare.comanda_id ? (
                  <div>
                    <dt className="text-xs font-medium text-[var(--text-tertiary)]">Comandă</dt>
                    <dd className="mt-0.5">
                      <StatusBadge variant="info" text="Din comandă" />
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cantitate / Preț</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">
                    {watchedQty ? `${watchedQty} kg` : '—'} · {watchedPret ? `${watchedPret} lei/kg` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Total</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                    {totalRon !== null ? `${totalRon.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} lei` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5">Status plată</dt>
                  <dd>
                    <StatusBadge variant={statusVariant} text={formatStatusPlataLabel(watchedStatus || '')} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{dataAsideLabel}</dd>
                </div>
                {alteVanzariClient !== null ? (
                  <div className="border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-tertiary)]">Alte vânzări (acest client): </span>
                    <span className="font-semibold text-[var(--text-primary)]">{alteVanzariClient}</span>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Observații</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-[var(--text-primary)]">{clipNote(watchedObs)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </form>
    </AppDialog>
  )
}
