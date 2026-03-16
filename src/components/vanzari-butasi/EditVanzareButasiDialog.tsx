'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Minus, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
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
import { getClienți } from '@/lib/supabase/queries/clienti'
import { getParcele } from '@/lib/supabase/queries/parcele'
import {
  VANZARE_BUTASI_STATUSES,
  type UpdateVanzareButasiInput,
  type VanzareButasi,
  type VanzareButasiStatus,
  updateVanzareButasi,
} from '@/lib/supabase/queries/vanzari-butasi'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'

interface EditVanzareButasiDialogProps {
  vanzare: VanzareButasi | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusLabels: Record<VanzareButasiStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  pregatita: 'Pregătită',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const schema = z.object({
  client_id: z.string().optional(),
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
})

type FormValues = z.input<typeof schema>
type SubmitValues = z.output<typeof schema>

function formatLei(value: number): string {
  return `${value.toFixed(2)} lei`
}

function getDefaultValues(vanzare: VanzareButasi): FormValues {
  return {
    client_id: vanzare.client_id ?? '',
    parcela_sursa_id: vanzare.parcela_sursa_id ?? '',
    status: vanzare.status,
    data_comanda: vanzare.data_comanda || vanzare.data,
    data_livrare_estimata: vanzare.data_livrare_estimata ?? '',
    adresa_livrare: vanzare.adresa_livrare ?? '',
    observatii: vanzare.observatii ?? '',
    avans_suma: Number(vanzare.avans_suma ?? 0),
    avans_data: vanzare.avans_data ?? '',
    items:
      vanzare.items?.length > 0
        ? vanzare.items.map((item) => ({
            soi: item.soi,
            cantitate: item.cantitate,
            pret_unitar: item.pret_unitar,
          }))
        : [
            {
              soi: vanzare.soi_butasi ?? '',
              cantitate: Math.max(1, Number(vanzare.cantitate_butasi || 1)),
              pret_unitar: Math.max(0.01, Number(vanzare.pret_unitar_lei || 0.01)),
            },
          ],
  }
}

export function EditVanzareButasiDialog({ vanzare, open, onOpenChange }: EditVanzareButasiDialogProps) {
  const queryClient = useQueryClient()

  const form = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: '',
      parcela_sursa_id: '',
      status: 'noua',
      data_comanda: '',
      data_livrare_estimata: '',
      adresa_livrare: '',
      observatii: '',
      avans_suma: 0,
      avans_data: '',
      items: [{ soi: '', cantitate: 1, pret_unitar: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const [comboInput, setComboInput] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (vanzare && open) {
      console.log('[EditVanzareButasiDialog] clienti loaded:', clienti.length)
      form.reset(getDefaultValues(vanzare))
      if (vanzare.client_id) {
        const client = clienti.find((c) => c.id === vanzare.client_id)
        setComboInput(client?.nume_client ?? '')
      } else {
        setComboInput('')
      }
    }
  }, [vanzare, open, form, clienti])

  useEffect(() => {
    if (!open) {
      setComboInput('')
      setComboOpen(false)
    }
  }, [open])

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

  const watchedItems = form.watch('items')
  const status = form.watch('status')
  const isProductsReadonly = status === 'anulata'

  const totalProduse = useMemo(
    () => watchedItems.reduce((sum, item) => sum + Number(item.cantitate || 0) * Number(item.pret_unitar || 0), 0),
    [watchedItems]
  )

  const avans = Number(form.watch('avans_suma') ?? 0)
  const restDeIncasat = totalProduse - (Number.isFinite(avans) ? avans : 0)

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVanzareButasiInput }) => updateVanzareButasi(id, input),
    onSuccess: (updatedOrder) => {
      if (!vanzare) return

      queryClient.invalidateQueries({ queryKey: queryKeys.vanzariButasi })

      if (updatedOrder.status !== vanzare.status) {
        trackEvent('butasi_order_status_changed', 'vanzari-butasi', {
          orderId: updatedOrder.id,
          from: vanzare.status,
          to: updatedOrder.status,
        })
        Sentry.captureMessage('butasi_order_status_changed', {
          level: 'info',
          tags: { module: 'vanzari-butasi' },
          extra: { orderId: updatedOrder.id, from: vanzare.status, to: updatedOrder.status },
        })
      }

      const avansDelta = Number(updatedOrder.avans_suma) - Number(vanzare.avans_suma)
      if (avansDelta > 0) {
        trackEvent('butasi_order_payment_added', 'vanzari-butasi', {
          orderId: updatedOrder.id,
          addedAmount: avansDelta,
          newAvans: updatedOrder.avans_suma,
        })
        Sentry.captureMessage('butasi_order_payment_added', {
          level: 'info',
          tags: { module: 'vanzari-butasi' },
          extra: { orderId: updatedOrder.id, addedAmount: avansDelta, newAvans: updatedOrder.avans_suma },
        })
      }

      hapticSuccess()
      toast.success('Comandă actualizată')
      onOpenChange(false)
    },
    onError: (error: Error) => {
      hapticError()
      toast.error(error.message || 'Eroare la actualizare')
    },
  })

  const onSubmit = (values: SubmitValues) => {
    if (!vanzare || updateMutation.isPending) return

    updateMutation.mutate({
      id: vanzare.id,
      input: {
        client_id: values.client_id || null,
        parcela_sursa_id: values.parcela_sursa_id || null,
        status: values.status,
        data_comanda: values.data_comanda,
        data_livrare_estimata: values.data_livrare_estimata || null,
        adresa_livrare: values.adresa_livrare?.trim() || null,
        observatii: values.observatii?.trim() || null,
        avans_suma: Number(values.avans_suma),
        avans_data: values.avans_data || null,
        items: values.items.map((item) => ({
          soi: item.soi.trim(),
          cantitate: Number(item.cantitate),
          pret_unitar: Number(item.pret_unitar),
        })),
      },
    })
  }

  if (!vanzare) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează vânzarea de material săditor"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(onSubmit)}
          saving={updateMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează comanda"
        />
      }
    >
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2" ref={comboRef}>
              <Label htmlFor="edit_vb_client_combo">Client</Label>
              <div className="relative">
                <Input
                  id="edit_vb_client_combo"
                  className="agri-control h-12"
                  placeholder="Caută după nume sau telefon..."
                  autoComplete="off"
                  value={comboInput}
                  onFocus={() => setComboOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value
                    setComboInput(val)
                    setComboOpen(true)
                    form.setValue('client_id', '', { shouldDirty: true })
                  }}
                />
                {comboOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 border-b border-gray-100 px-3 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setComboInput('')
                        setComboOpen(false)
                        form.setValue('client_id', '', { shouldDirty: true })
                      }}
                    >
                      — Fără client
                    </button>
                    {comboFiltered.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-400">Niciun client găsit</p>
                    ) : (
                      comboFiltered.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setComboInput(client.nume_client)
                            setComboOpen(false)
                            form.setValue('client_id', client.id, { shouldDirty: true })
                          }}
                        >
                          <span className="font-medium text-gray-900">{client.nume_client}</span>
                          {client.telefon ? <span className="text-gray-400">— {client.telefon}</span> : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="grid grid-cols-2 gap-1.5 min-[380px]:grid-cols-3 sm:grid-cols-3">
                {VANZARE_BUTASI_STATUSES.map((option) => {
                  const isActive = status === option
                  return (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      onClick={() => form.setValue('status', option, { shouldDirty: true })}
                      className={cn(
                        'h-8 rounded-full border px-2 text-[11px] font-semibold',
                        isActive && option !== 'anulata' && 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
                        isActive && option === 'anulata' && 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200',
                        !isActive && 'bg-white text-slate-600'
                      )}
                    >
                      {statusLabels[option]}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit_vb_data_comanda">Data comandă</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="edit_vb_data_comanda" type="date" className="agri-control h-12 pl-10" {...form.register('data_comanda')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_vb_data_livrare">Data preconizată livrare</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="edit_vb_data_livrare" type="date" className="agri-control h-12 pl-10" {...form.register('data_livrare_estimata')} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit_vb_adresa">Adresă livrare</Label>
              <Input id="edit_vb_adresa" className="agri-control h-12" {...form.register('adresa_livrare')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_vb_obs">Observații</Label>
              <Textarea id="edit_vb_obs" rows={4} className="agri-control" {...form.register('observatii')} />
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

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-[var(--agri-text)]">Produse</h3>
          </div>

          {isProductsReadonly ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              Comandă anulată: produsele sunt doar în citire.
            </div>
          ) : null}

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
                    className="absolute right-2 top-2 h-7 w-7 rounded-full text-red-500 hover:bg-red-100"
                    onClick={() => {
                      if (fields.length > 1) remove(index)
                    }}
                    disabled={fields.length === 1 || isProductsReadonly}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <div className="grid gap-3 pr-8 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-4">
                      <Label>Soi</Label>
                      <Input className="agri-control h-11" disabled={isProductsReadonly} {...form.register(`items.${index}.soi`)} />
                    </div>

                    <div className="space-y-2 md:col-span-4">
                      <Label>Cantitate</Label>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-10 w-10 shrink-0 rounded-full"
                          disabled={isProductsReadonly}
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
                          disabled={isProductsReadonly}
                          {...form.register(`items.${index}.cantitate`, { valueAsNumber: true })}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-10 w-10 shrink-0 rounded-full"
                          disabled={isProductsReadonly}
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
                        disabled={isProductsReadonly}
                        {...form.register(`items.${index}.pret_unitar`, { valueAsNumber: true })}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs">Subtotal</Label>
                      <div className="flex h-11 items-center justify-end rounded-xl border border-emerald-100 bg-white px-2 text-sm font-semibold">
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
              disabled={isProductsReadonly}
            >
              + Adaugă soi
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <p className="text-lg font-bold text-[var(--agri-text)]">Total produse: {formatLei(totalProduse || 0)}</p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_vb_avans">Avans plătit</Label>
                <Input
                  id="edit_vb_avans"
                  type="number"
                  min={0}
                  step="0.01"
                  className="agri-control h-12"
                  {...form.register('avans_suma', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_vb_avans_data">Data avans</Label>
                <Input id="edit_vb_avans_data" type="date" className="agri-control h-12" {...form.register('avans_data')} />
              </div>
            </div>

            <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              Rest de încasat: {formatLei(restDeIncasat || 0)}
            </div>
          </div>
        </div>
      </form>
    </AppDialog>
  )
}
