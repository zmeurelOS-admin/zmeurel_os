'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Minus, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { VanzareButasiFormSummary } from '@/components/vanzari-butasi/VanzareButasiFormSummary'
import { Button } from '@/components/ui/button'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, DesktopFormPanel, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { captureReactError } from '@/lib/monitoring/sentry'
import { createClienți, getClienți } from '@/lib/supabase/queries/clienti'
import { getParcele } from '@/lib/supabase/queries/parcele'
import {
  VANZARE_BUTASI_STATUSES,
  type VanzareButasiStatus,
  createVanzareButasi,
} from '@/lib/supabase/queries/vanzari-butasi'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

const statusLabels: Record<VanzareButasiStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  pregatita: 'Pregătită',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const schema = z.object({
  client_mode: z.enum(['existing', 'manual']),
  client_id: z.string().optional(),
  client_nume_manual: z.string().optional(),
  client_telefon_manual: z.string().optional(),
  save_client_to_database: z.boolean().optional(),
  parcela_sursa_id: z.string().optional(),
  status: z.enum(VANZARE_BUTASI_STATUSES),
  data_comanda: z.string().min(1, 'Data comenzii este obligatorie'),
  data_livrare_estimata: z.string().optional(),
  adresa_livrare: z.string().optional(),
  observatii: z.string().optional(),
  avans_suma: z.coerce.number().min(0, 'Avansul nu poate fi negativ'),
  avans_data: z.string().optional(),
  items: z
    .array(
      z.object({
        soi: z.string().trim().min(1, 'Soiul este obligatoriu'),
        cantitate: z.coerce.number().int().min(1, 'Cantitatea trebuie sa fie > 0'),
        pret_unitar: z.coerce.number().gt(0, 'Pretul trebuie sa fie > 0'),
      }),
    )
    .min(1, 'Adauga cel puțin un produs'),
}).superRefine((values, ctx) => {
  if (values.client_mode === 'manual' && !values.client_nume_manual?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['client_nume_manual'],
      message: 'Numele clientului este obligatoriu pentru client manual',
    })
  }
})

type FormValues = z.input<typeof schema>
type SubmitValues = z.output<typeof schema>

interface AddVanzareButasiDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

const defaultValues = (): FormValues => ({
  client_mode: 'existing',
  client_id: '',
  client_nume_manual: '',
  client_telefon_manual: '',
  save_client_to_database: false,
  parcela_sursa_id: '',
  status: 'noua',
  data_comanda: new Date().toISOString().split('T')[0],
  data_livrare_estimata: '',
  adresa_livrare: '',
  observatii: '',
  avans_suma: 0,
  avans_data: '',
  items: [{ soi: '', cantitate: 1, pret_unitar: 0 }],
})

function formatLei(value: number): string {
  return `${value.toFixed(2)} lei`
}

function formatDateLabel(value: string | undefined): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  const parsed = new Date(current)
  if (Number.isNaN(parsed.getTime())) return current
  return parsed.toLocaleDateString('ro-RO')
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  const maybeError = (error ?? {}) as {
    message?: string
    details?: string
    hint?: string
    error?: { message?: string; details?: string; hint?: string }
    cause?: { message?: string; details?: string; hint?: string }
  }
  return (
    maybeError.message ||
    maybeError.details ||
    maybeError.hint ||
    maybeError.error?.message ||
    maybeError.error?.details ||
    maybeError.error?.hint ||
    maybeError.cause?.message ||
    maybeError.cause?.details ||
    maybeError.cause?.hint ||
    'Eroare la salvarea comenzii'
  )
}

function isSchemaCacheError(error: unknown): boolean {
  const maybeError = (error ?? {}) as { code?: string; message?: string }
  const message = (maybeError.message ?? '').toLowerCase()
  return (
    maybeError.code === 'PGRST204' ||
    maybeError.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find the')
  )
}

export function AddVanzareButasiDialog({
  open,
  onOpenChange,
  hideTrigger = false,
}: AddVanzareButasiDialogProps) {
  void hideTrigger
  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const [comboInput, setComboInput] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setComboInput('')
        setComboOpen(false)
      }
      if (!isControlled) setInternalOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange],
  )

  const form = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  useEffect(() => {
    if (!dialogOpen) {
      form.reset(defaultValues())
    }
  }, [dialogOpen, form])

  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) {
        setComboOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const comboFiltered = useMemo(() => {
    const normalize = (value: string) =>
      value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const words = normalize(comboInput ?? '')
      .split(/\s+/)
      .filter((word) => word.length > 0)
    if (words.length === 0 || (words.length === 1 && words[0].length < 2)) return clienti.slice(0, 30)
    return clienti.filter((client) => {
      const name = normalize(client.nume_client ?? '')
      const phone = (client.telefon ?? '').toLowerCase()
      return words.every((word) => name.includes(word) || phone.includes(word))
    })
  }, [comboInput, clienti])

  const watchedItems = useWatch({ control: form.control, name: 'items' })
  const avansValue = useWatch({ control: form.control, name: 'avans_suma' })
  const clientMode = useWatch({ control: form.control, name: 'client_mode' }) ?? 'existing'
  const saveClientToDatabase = useWatch({ control: form.control, name: 'save_client_to_database' }) ?? false
  const selectedStatus = useWatch({ control: form.control, name: 'status' }) ?? 'noua'
  const orderDateValue = useWatch({ control: form.control, name: 'data_comanda' }) ?? ''
  const deliveryDateValue = useWatch({ control: form.control, name: 'data_livrare_estimata' }) ?? ''
  const addressValue = useWatch({ control: form.control, name: 'adresa_livrare' }) ?? ''
  const notesValue = useWatch({ control: form.control, name: 'observatii' }) ?? ''
  const selectedParcelaId = useWatch({ control: form.control, name: 'parcela_sursa_id' }) ?? ''
  const selectedClientId = useWatch({ control: form.control, name: 'client_id' }) ?? ''
  const manualClientNameValue = useWatch({ control: form.control, name: 'client_nume_manual' }) ?? ''
  const avans = Number(avansValue ?? 0)

  const selectedClient = selectedClientId ? clienti.find((client) => client.id === selectedClientId) : undefined
  const selectedParcela = selectedParcelaId ? parcele.find((parcela) => parcela.id === selectedParcelaId) : undefined

  const totalProduse = useMemo(
    () =>
      (watchedItems ?? []).reduce(
        (sum, item) => sum + Number(item.cantitate || 0) * Number(item.pret_unitar || 0),
        0,
      ),
    [watchedItems],
  )

  const restDeIncasat = Math.max(0, totalProduse - (Number.isFinite(avans) ? avans : 0))
  const totalBucati = (watchedItems ?? []).reduce((sum, item) => sum + Number(item.cantitate || 0), 0)
  const productNames = (watchedItems ?? [])
    .map((item) => item.soi.trim())
    .filter(Boolean)
  const productsLabel = productNames.length
    ? `${productNames.slice(0, 2).join(', ')}${productNames.length > 2 ? '…' : ''} · ${totalBucati} buc`
    : '—'
  const summaryClientName =
    selectedClient?.nume_client ||
    manualClientNameValue.trim() ||
    comboInput.trim() ||
    'Client'
  const summaryLocation = addressValue.trim() || '—'
  const summarySourceParcel = selectedParcela?.nume_parcela || '—'

  const mutation = useMutation({
    mutationFn: createVanzareButasi,
    onSuccess: (savedOrder) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzariButasi })
      trackEvent('butasi_order_created', 'vanzari-butasi', {
        orderId: savedOrder.id,
        status: savedOrder.status,
        total: savedOrder.total_lei,
      })
      Sentry.captureMessage('butasi_order_created', {
        level: 'info',
        tags: { module: 'vanzari-butasi' },
        extra: { orderId: savedOrder.id, status: savedOrder.status, total: savedOrder.total_lei },
      })
      hapticSuccess()
      toast.success('Comanda a fost salvată')
      setDialogOpen(false)
    },
    onError: (error: unknown) => {
      const maybeError = (error ?? {}) as {
        code?: string
        message?: string
        details?: string
        hint?: string
        statusText?: string
      }
      const resolvedMessage = resolveErrorMessage(error)

      captureReactError(error, {
        component: 'AddVanzareButasiDialog',
        tags: { module: 'vanzari-butasi', action: 'create_order' },
        extra: {
          code: maybeError?.code,
          message: maybeError?.message || resolvedMessage,
          details: maybeError?.details,
          hint: maybeError?.hint,
          statusText: maybeError?.statusText,
        },
      })

      if (isSchemaCacheError(error)) {
        hapticError()
        toast.error('Schema DB nu e sincronizat?. Reîncarcă aplicația sau ruleaza reload schema in Supabase.')
        return
      }

      hapticError()
      toast.error(resolvedMessage)
    },
  })

  const onSubmit = async (values: SubmitValues) => {
    if (mutation.isPending) return

    const manualClientName = values.client_nume_manual?.trim() || ''
    const manualClientPhone = values.client_telefon_manual?.trim() || ''
    const shouldSaveClient = Boolean(values.save_client_to_database)
    const isManualMode = values.client_mode === 'manual'

    let resolvedClientId: string | null = isManualMode ? null : values.client_id || null

    if (isManualMode && shouldSaveClient) {
      try {
        const savedClient = await createClienți(
          {
            nume_client: manualClientName,
            telefon: manualClientPhone || null,
          },
          {
            onDuplicateWarning: (existing) => {
              toast.warning(`Un client cu un nume similar există deja: ${existing.nume_client}. Continui.`)
            },
          },
        )
        resolvedClientId = savedClient.id
        queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      } catch (error) {
        hapticError()
        toast.error(resolveErrorMessage(error))
        return
      }
    }

    const manualClientNote =
      isManualMode && !resolvedClientId
        ? `Client manual: ${manualClientName}${manualClientPhone ? ` (${manualClientPhone})` : ''}`
        : ''
    const mergedObservatii = [values.observatii?.trim() || '', manualClientNote].filter(Boolean).join(' | ')

    mutation.mutate({
      client_id: resolvedClientId,
      parcela_sursa_id: values.parcela_sursa_id || null,
      status: values.status,
      data_comanda: values.data_comanda,
      data_livrare_estimata: values.data_livrare_estimata || null,
      adresa_livrare: values.adresa_livrare?.trim() || null,
      observatii: mergedObservatii || null,
      avans_suma: Number(values.avans_suma),
      avans_data: values.avans_data || null,
      items: values.items.map((item) => ({
        soi: item.soi.trim(),
        cantitate: Number(item.cantitate),
        pret_unitar: Number(item.pret_unitar),
      })),
    })
  }

  return (
    <AppDrawer
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title="Adaugă vânzare material săditor"
      description="Completezi rapid comanda și verifici rezumatul din dreapta înainte de salvare."
      desktopFormWide
      desktopFormCompact
      showCloseButton
      contentClassName="md:w-[min(96vw,76rem)] md:max-w-none lg:w-[min(94vw,78rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => setDialogOpen(false)}
          onSave={form.handleSubmit(onSubmit)}
          saving={mutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează comanda"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
        <DesktopFormGrid
          className="md:grid-cols-[minmax(0,1fr)_17rem] md:gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-3.5"
          aside={
            <VanzareButasiFormSummary
              clientName={summaryClientName}
              statusLabel={statusLabels[selectedStatus]}
              orderDateLabel={formatDateLabel(orderDateValue)}
              deliveryDateLabel={formatDateLabel(deliveryDateValue)}
              location={summaryLocation}
              sourceParcelName={summarySourceParcel}
              productsLabel={productsLabel}
              totalLabel={formatLei(totalProduse || 0)}
              advanceLabel={formatLei(Number.isFinite(avans) ? avans : 0)}
              remainingLabel={formatLei(restDeIncasat || 0)}
              notes={notesValue}
              className="md:rounded-[22px] md:p-3.5 lg:p-4"
            />
          }
        >
          <FormDialogSection>
            <DesktopFormPanel className="space-y-2.5">
              <div className="space-y-2" ref={comboRef}>
                <Label htmlFor="vb_client_combo">Client</Label>
                <div className="relative">
                  <Input
                    id="vb_client_combo"
                    className="agri-control h-11 md:h-10"
                    placeholder="Caută după nume sau telefon..."
                    autoComplete="off"
                    value={comboInput}
                    onFocus={() => setComboOpen(true)}
                    onChange={(e) => {
                      const val = e.target.value
                      setComboInput(val)
                      setComboOpen(true)
                      form.setValue('client_mode', 'manual', { shouldDirty: true })
                      form.setValue('client_id', '', { shouldDirty: true })
                      form.setValue('client_nume_manual', val, { shouldDirty: true })
                    }}
                  />
                  {comboOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-elevated)]">
                      {comboFiltered.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-[var(--text-secondary)]">Niciun client găsit — completează manual</p>
                      ) : (
                        comboFiltered.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm hover:bg-[var(--soft-success-bg)]"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setComboInput(client.nume_client)
                              setComboOpen(false)
                              form.setValue('client_mode', 'existing', { shouldDirty: true })
                              form.setValue('client_id', client.id, { shouldDirty: true })
                              form.setValue('client_nume_manual', '', { shouldDirty: true })
                              form.setValue('client_telefon_manual', '', { shouldDirty: true })
                              form.setValue('save_client_to_database', false, { shouldDirty: true })
                              if (client.adresa) {
                                form.setValue('adresa_livrare', client.adresa, { shouldDirty: true })
                              }
                            }}
                          >
                            <span className="font-medium text-[var(--text-primary)]">{client.nume_client}</span>
                            {client.telefon ? <span className="text-[var(--text-secondary)]">— {client.telefon}</span> : null}
                          </button>
                        ))
                      )}
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 border-t border-[var(--divider)] px-3 py-2.5 text-left text-sm font-medium text-[var(--success-text)] hover:bg-[var(--success-bg)]"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setComboOpen(false)
                          form.setValue('client_mode', 'manual', { shouldDirty: true })
                          form.setValue('client_id', '', { shouldDirty: true })
                          form.setValue('client_nume_manual', comboInput, { shouldDirty: true })
                        }}
                      >
                        ➕ Client nou — completează manual
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {clientMode === 'manual' ? (
                <>
                  <div className="grid gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="vb_client_nume_manual">Nume client</Label>
                      <Input
                        id="vb_client_nume_manual"
                        className="agri-control h-11 md:h-10"
                        placeholder="Ex: Popescu Ion"
                        {...form.register('client_nume_manual')}
                      />
                      {form.formState.errors.client_nume_manual ? (
                        <p className="text-xs text-red-600">{form.formState.errors.client_nume_manual.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vb_client_telefon_manual">Telefon client</Label>
                      <Input
                        id="vb_client_telefon_manual"
                        className="agri-control h-11 md:h-10"
                        placeholder="Ex: 07xxxxxxxx"
                        {...form.register('client_telefon_manual')}
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--shadow-soft)]">
                    <input
                      id="vb_save_client_to_database"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-[var(--agri-border)]"
                      checked={Boolean(saveClientToDatabase)}
                      onChange={(event) => form.setValue('save_client_to_database', event.target.checked, { shouldDirty: true })}
                    />
                    <span>
                      <span className="block font-medium">Salvează clientul în listă</span>
                      <span className="block text-xs text-[var(--text-secondary)]">Păstrezi clientul pentru comenzi viitoare.</span>
                    </span>
                  </label>
                </>
              ) : null}

              <div className="grid gap-2.5 md:grid-cols-[minmax(0,11.5rem)_minmax(0,1fr)] md:gap-x-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <div className="grid grid-cols-2 gap-1.5 min-[380px]:grid-cols-3 md:grid-cols-2">
                    {VANZARE_BUTASI_STATUSES.map((status) => {
                      const isActive = selectedStatus === status
                      return (
                        <Button
                          key={status}
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue('status', status, { shouldDirty: true })}
                          className={cn(
                            'h-8 rounded-full border px-2 text-[11px] font-semibold',
                            isActive && status !== 'anulata' && 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
                            isActive && status === 'anulata' && 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60',
                            !isActive && 'bg-white text-slate-600 dark:bg-zinc-900 dark:text-zinc-300',
                          )}
                        >
                          {statusLabels[status]}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="vb_data_comanda">Data comandă</Label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input id="vb_data_comanda" type="date" className="agri-control h-11 pl-10 md:h-10" {...form.register('data_comanda')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vb_data_livrare">Data preconizată livrare</Label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input id="vb_data_livrare" type="date" className="agri-control h-11 pl-10 md:h-10" {...form.register('data_livrare_estimata')} />
                    </div>
                  </div>
                </div>
              </div>
            </DesktopFormPanel>
          </FormDialogSection>

          <FormDialogSection>
            <DesktopFormPanel>
              <div className="grid gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="vb_adresa">Adresă livrare</Label>
                  <Input
                    id="vb_adresa"
                    className="agri-control h-11 md:h-10"
                    placeholder="Strada, număr, localitate"
                    {...form.register('adresa_livrare')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Teren sursă</Label>
                  <Controller
                    control={form.control}
                    name="parcela_sursa_id"
                    render={({ field }) => (
                      <Select value={field.value || '__none'} onValueChange={(value) => field.onChange(value === '__none' ? '' : value)}>
                        <SelectTrigger className="agri-control h-11 md:h-10">
                          <SelectValue placeholder="Selectează teren" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Fără teren</SelectItem>
                          {parcele.map((parcela) => (
                            <SelectItem key={parcela.id} value={parcela.id}>
                              {parcela.nume_parcela}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vb_obs">Observații</Label>
                  <Textarea id="vb_obs" rows={2} className="agri-control min-h-[3.75rem] md:min-h-[4rem]" {...form.register('observatii')} />
                </div>
              </div>
            </DesktopFormPanel>
          </FormDialogSection>

          <FormDialogSection>
            <DesktopFormPanel className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--agri-text)]">Produse</h3>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl px-3 text-xs sm:text-sm"
                  onClick={() => append({ soi: '', cantitate: 1, pret_unitar: 0 })}
                >
                  + Adaugă soi
                </Button>
              </div>

              <div className="space-y-2.5">
                {fields.map((field, index) => {
                  const cantitate = Number(watchedItems[index]?.cantitate || 0)
                  const pret = Number(watchedItems[index]?.pret_unitar || 0)
                  const subtotal = cantitate * pret

                  return (
                    <div key={field.id} className="relative rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)]/55 p-3 shadow-[var(--shadow-soft)]">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 top-2 h-7 w-7 rounded-full text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        onClick={() => {
                          if (fields.length > 1) remove(index)
                        }}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="grid gap-2.5 pr-8 md:grid-cols-12 md:gap-x-3 md:gap-y-2.5">
                        <div className="space-y-1.5 md:col-span-4">
                          <Label>Soi</Label>
                          <Input className="agri-control h-11 md:h-10" {...form.register(`items.${index}.soi`)} />
                        </div>

                        <div className="space-y-1.5 md:col-span-4">
                          <Label>Cantitate</Label>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-10 w-10 shrink-0 rounded-full"
                              onClick={() => {
                                const nextValue = Math.max(1, cantitate - 1)
                                form.setValue(`items.${index}.cantitate`, nextValue, { shouldValidate: true })
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              className="agri-control h-11 text-center md:h-10"
                              {...form.register(`items.${index}.cantitate`, { valueAsNumber: true })}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-10 w-10 shrink-0 rounded-full"
                              onClick={() => form.setValue(`items.${index}.cantitate`, cantitate + 1, { shouldValidate: true })}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Preț/buc</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            className="agri-control h-11 md:h-10"
                            {...form.register(`items.${index}.pret_unitar`, { valueAsNumber: true })}
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs">Subtotal</Label>
                          <div className="flex h-11 items-center justify-end rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-2 text-sm font-semibold md:h-10">
                            {formatLei(subtotal || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </DesktopFormPanel>
          </FormDialogSection>

          <FormDialogSection>
            <DesktopFormPanel>
              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-x-3">
                <div className="grid gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="vb_avans">Avans plătit</Label>
                    <Input
                      id="vb_avans"
                      type="number"
                      min={0}
                      step="0.01"
                      className="agri-control h-11 md:h-10"
                      {...form.register('avans_suma', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vb_avans_data">Data avans</Label>
                    <Input id="vb_avans_data" type="date" className="agri-control h-11 md:h-10" {...form.register('avans_data')} />
                  </div>
                </div>

                <div className="space-y-1.5 md:min-w-[12rem]">
                  <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface-card)] px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Total produse</p>
                    <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{formatLei(totalProduse || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-warning-text)]">
                    Rest de încasat: {formatLei(restDeIncasat || 0)}
                  </div>
                </div>
              </div>
            </DesktopFormPanel>
          </FormDialogSection>
        </DesktopFormGrid>
      </form>
    </AppDrawer>
  )
}
