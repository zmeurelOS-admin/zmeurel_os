'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StatusBadge from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'

const culegatorSchema = z.object({
  nume_prenume: z.string().trim().min(2, 'Numele trebuie să aibă minimum 2 caractere'),
  telefon: z.string().optional(),
  tip_angajare: z.string().min(1, 'Selectează tipul de angajare'),
  tarif_lei_kg: z.string().optional(),
  data_angajare: z.string().optional(),
  status_activ: z.boolean().optional(),
  observatii: z.string().optional(),
})

type CulegatorFormData = z.infer<typeof culegatorSchema>

interface AddCulegatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CulegatorFormData) => Promise<void>
}

const defaults = (): CulegatorFormData => ({
  nume_prenume: '',
  telefon: '',
  tip_angajare: 'Sezonier',
  tarif_lei_kg: '0',
  data_angajare: '',
  status_activ: true,
  observatii: '',
})

function formatDateRo(iso: string | undefined | null): string {
  if (!iso?.trim()) return '—'
  const raw = iso.slice(0, 10)
  const d = new Date(`${raw}T12:00:00`)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('ro-RO')
}

function clipNote(text: string | undefined, max = 120): string {
  const t = (text ?? '').trim()
  if (!t) return '—'
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function AddCulegatorDialog({ open, onOpenChange, onSubmit }: AddCulegatorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CulegatorFormData>({
    resolver: zodResolver(culegatorSchema),
    defaultValues: defaults(),
  })

  const watched = useWatch({ control: form.control })

  useEffect(() => {
    if (!open) form.reset(defaults())
  }, [open, form])

  const handleSubmit = async (data: CulegatorFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
  }

  const tarifNum = useMemo(() => {
    const n = Number(String(watched.tarif_lei_kg ?? '').replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [watched.tarif_lei_kg])

  const asideTitle = watched.nume_prenume?.trim() || 'Culegător nou'
  const statusActiv = Boolean(watched.status_activ)

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă culegător nou"
      desktopFormWide
      contentClassName="lg:max-w-[min(94vw,56rem)] xl:max-w-[min(92vw,60rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={handleClose}
          onSave={form.handleSubmit(handleSubmit)}
          saving={isSubmitting}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_min(280px,30%)] md:items-start md:gap-6 lg:gap-8">
          <div className="min-w-0 space-y-4 md:space-y-6">
            <FormDialogSection label="Identificare">
              <div className="space-y-2">
                <Label htmlFor="culegator_nume">Nume și prenume</Label>
                <Input id="culegator_nume" className="agri-control h-12 md:h-11" placeholder="Popescu Ion" {...form.register('nume_prenume')} />
                {form.formState.errors.nume_prenume ? (
                  <p className="text-xs text-red-600">{form.formState.errors.nume_prenume.message}</p>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="culegator_telefon">Telefon</Label>
                  <Input id="culegator_telefon" type="tel" className="agri-control h-12 md:h-11" placeholder="0740123456" {...form.register('telefon')} />
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Detalii">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2">
                  <Label htmlFor="culegator_tip">Tip angajare</Label>
                  <select id="culegator_tip" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('tip_angajare')}>
                    <option value="Sezonier">Sezonier</option>
                    <option value="Permanent">Permanent</option>
                    <option value="Zilier">Zilier</option>
                    <option value="Colaborator">Colaborator</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="culegator_tarif">Tarif (lei/kg)</Label>
                  <Input
                    id="culegator_tarif"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="agri-control h-12 md:h-11"
                    placeholder="0"
                    {...form.register('tarif_lei_kg')}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="culegator_data">Data angajare</Label>
                  <Input id="culegator_data" type="date" className="agri-control h-12 md:h-11" {...form.register('data_angajare')} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="culegator_activ"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                  checked={Boolean(form.watch('status_activ'))}
                  onChange={(event) => form.setValue('status_activ', event.target.checked, { shouldDirty: true })}
                />
                <Label htmlFor="culegator_activ" className="cursor-pointer text-sm font-normal">
                  Culegător activ
                </Label>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Observații">
              <Textarea
                id="culegator_obs"
                rows={3}
                className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6rem]"
                {...form.register('observatii')}
              />
            </FormDialogSection>
          </div>

          <aside className="hidden md:block md:sticky md:top-2 md:self-start">
            <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 shadow-[var(--shadow-soft)]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Previzualizare</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">{asideTitle}</p>
              </div>
              <dl className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{watched.telefon?.trim() || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip angajare</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{watched.tip_angajare || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tarif</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{tarifNum > 0 ? `${tarifNum.toLocaleString('ro-RO')} lei/kg` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data angajării</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{formatDateRo(watched.data_angajare)}</dd>
                </div>
                <div className="border-t border-[var(--divider)] pt-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5">Status</dt>
                  <dd>
                    <StatusBadge variant={statusActiv ? 'success' : 'neutral'} text={statusActiv ? 'Activ' : 'Inactiv'} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Observații</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)] text-xs leading-relaxed">{clipNote(watched.observatii)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </form>
    </AppDrawer>
  )
}
