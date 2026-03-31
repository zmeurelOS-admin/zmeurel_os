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
import { Button } from '@/components/ui/button'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'

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
      })
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
  const setDialogOpen = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setComboInput('')
      setComboOpen(false)
    }
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

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
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const words = normalize(comboInput ?? '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
    if (words.length === 0 || (words.length === 1 && words[0].length < 2)) return clienti.slice(0, 30)
    return clienti.filter((c) => {
      const name = normalize(c.nume_client ?? '')
      const phone = (c.telefon ?? '').toLowerCase()
      return words.every((w) => name.includes(w) || phone.includes(w))
    })
  }, [comboInput, clienti])

  const watchedItems = useWatch({ control: form.control, name: 'items' })
  const avansValue = useWatch({ control: form.control, name: 'avans_suma' })
  const clientMode = useWatch({ control: form.control, name: 'client_mode' }) ?? 'existing'
  const saveClientToDatabase = useWatch({ control: form.control, name: 'save_client_to_database' }) ?? false
  const selectedStatus = useWatch({ control: form.control, name: 'status' }) ?? 'noua'
  const avans = Number(avansValue ?? 0)

  const totalProduse = useMemo(
    () =>
      (watchedItems ?? []).reduce(
        (sum, item) => sum + Number(item.cantitate || 0) * Number(item.pret_unitar || 0),
        0
      ),
    [watchedItems]
  )

  const restDeIncasat = Math.max(0, totalProduse - (Number.isFinite(avans) ? avans : 0))

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
      console.error('[DEBUG] Error creating butasi order:', {
        message: maybeError?.message || resolvedMessage,
        code: maybeError?.code,
        details: maybeError?.details,
        hint: maybeError?.hint,
        statusText: maybeError?.statusText,
        rawError: error,
      })
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
        const savedClient = await createClienți({
          nume_client: manualClientName,
          telefon: manualClientPhone || null,
        }, {
          onDuplicateWarning: (existing) => {
            toast.warning(`Un client cu un nume similar există deja: ${existing.nume_client}. Continui.`)
          },
        })
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
    <>
      <AppDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Adaugă vânzare material săditor"
        contentClassName="sm:max-w-2xl"
        footer={
          <DialogFormActions
            onCancel={() => setDialogOpen(false)}
            onSave={form.handleSubmit(onSubmit)}
            saving={mutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează comanda"
          />
        }
      >
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="space-y-4">
              {/* Single client combobox — replaces the old mode-toggle + select + manual fields */}
              <div className="space-y-2" ref={comboRef}>
                <Label htmlFor="vb_client_combo">Client</Label>
                <div className="relative">
                  <Input
                    id="vb_client_combo"
                    className="agri-control h-12"
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
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {comboFiltered.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-gray-400 dark:text-zinc-400">Niciun client găsit — completează manual</p>
                      ) : (
                        comboFiltered.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
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
                            <span className="font-medium text-gray-900 dark:text-gray-100">{client.nume_client}</span>
                            {client.telefon ? <span className="text-gray-400 dark:text-zinc-400">— {client.telefon}</span> : null}
                          </button>
                        ))
                      )}
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 border-t border-gray-100 px-3 py-2.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:bg-emerald-900/20"
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

              {/* Manual fields — visible only when client_mode is 'manual' */}
              {clientMode === 'manual' ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vb_client_nume_manual">Nume client</Label>
                      <Input
                        id="vb_client_nume_manual"
                        className="agri-control h-12"
                        placeholder="Ex: Popescu Ion"
                        {...form.register('client_nume_manual')}
                      />
                      {form.formState.errors.client_nume_manual ? (
                        <p className="text-xs text-red-600">{form.formState.errors.client_nume_manual.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vb_client_telefon_manual">Telefon client</Label>
                      <Input
                        id="vb_client_telefon_manual"
                        className="agri-control h-12"
                        placeholder="Ex: 07xxxxxxxx"
                        {...form.register('client_telefon_manual')}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="vb_save_client_to_database"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                      checked={Boolean(saveClientToDatabase)}
                      onChange={(event) =>
                        form.setValue('save_client_to_database', event.target.checked, { shouldDirty: true })
                      }
                    />
                    <Label htmlFor="vb_save_client_to_database" className="cursor-pointer text-sm font-normal">
                      Salvează clientul în lista de clienți
                    </Label>
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="grid grid-cols-3 gap-2">
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
                          !isActive && 'bg-white text-slate-600 dark:bg-zinc-900 dark:text-zinc-300'
                        )}
                      >
                        {statusLabels[status]}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vb_data_comanda">Data comandă</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="vb_data_comanda" type="date" className="agri-control h-12 pl-10" {...form.register('data_comanda')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vb_data_livrare">Data preconizată livrare</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="vb_data_livrare" type="date" className="agri-control h-12 pl-10" {...form.register('data_livrare_estimata')} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="vb_adresa">Adresă livrare</Label>
                <Input id="vb_adresa" className="agri-control h-12" placeholder="Strada, numar, localitate" {...form.register('adresa_livrare')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vb_obs">Observații</Label>
                <Textarea id="vb_obs" rows={4} className="agri-control" {...form.register('observatii')} />
              </div>

              <div className="space-y-2">
                <Label>Teren sursă</Label>
                <Controller
                  control={form.control}
                  name="parcela_sursa_id"
                  render={({ field }) => (
                    <Select value={field.value || '__none'} onValueChange={(value) => field.onChange(value === '__none' ? '' : value)}>
                      <SelectTrigger className="agri-control h-12">
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
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-[var(--agri-text)]">Produse</h3>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => {
                const cantitate = Number(watchedItems[index]?.cantitate || 0)
                const pret = Number(watchedItems[index]?.pret_unitar || 0)
                const subtotal = cantitate * pret

                return (
                  <div key={field.id} className="relative rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
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

                    <div className="grid gap-3 pr-8 md:grid-cols-12">
                      <div className="space-y-2 md:col-span-4">
                        <Label>Soi</Label>
                        <Input className="agri-control h-11" {...form.register(`items.${index}.soi`)} />
                      </div>

                      <div className="space-y-2 md:col-span-4">
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
                            className="agri-control h-11 text-center"
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

                      <div className="space-y-2 md:col-span-2">
                        <Label>Preț/buc</Label>
                        <Input
                          type="number"
                          min={0.01}
                          step="0.01"
                          className="agri-control h-11"
                          {...form.register(`items.${index}.pret_unitar`, { valueAsNumber: true })}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs">Subtotal</Label>
                        <div className="flex h-11 items-center justify-end rounded-xl border border-emerald-100 bg-white px-2 text-sm font-semibold dark:border-emerald-900/50 dark:bg-zinc-900">
                          {formatLei(subtotal || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl"
                onClick={() => append({ soi: '', cantitate: 1, pret_unitar: 0 })}
              >
                + Adaugă soi
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            <div className="space-y-3">
              <p className="text-lg font-bold text-[var(--agri-text)]">Total produse: {formatLei(totalProduse || 0)}</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vb_avans">Avans plătit</Label>
                  <Input
                    id="vb_avans"
                    type="number"
                    min={0}
                    step="0.01"
                    className="agri-control h-12"
                    {...form.register('avans_suma', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vb_avans_data">Data avans</Label>
                  <Input id="vb_avans_data" type="date" className="agri-control h-12" {...form.register('avans_data')} />
                </div>
              </div>

              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Rest de încasat: {formatLei(restDeIncasat || 0)}
              </div>
            </div>
          </div>
        </form>
      </AppDrawer>
    </>
  )
}

