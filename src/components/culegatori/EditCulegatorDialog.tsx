'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StatusBadge from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import type { Culegator } from '@/lib/supabase/queries/culegatori'

const culegatorSchema = z.object({
  nume_prenume: z.string().trim().min(2, 'Numele trebuie să aibă minimum 2 caractere'),
  telefon: z.string().optional(),
  tip_angajare: z.string().min(1, 'Selectează tipul de angajare'),
  tarif_lei_kg: z.string().optional(),
  data_angajare: z.string().optional(),
  status_activ: z.boolean(),
  observatii: z.string().optional(),
})

type CulegatorFormData = z.infer<typeof culegatorSchema>

/** Date agregate deja pe pagina Culegători (fără query în dialog). */
type CulegatorDialogActivitySummary = {
  seasonKg: number
  seasonCount: number
  lastRecoltare: { date: string; parcela: string; kg: number } | null
}

interface EditCulegatorDialogProps {
  culegator: Culegator | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: CulegatorFormData) => Promise<void>
  /** Din `workerStats` pe listă; opțional. */
  activitySummary?: CulegatorDialogActivitySummary | null
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

function formatKg(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)
}

export function EditCulegatorDialog({
  culegator,
  open,
  onOpenChange,
  onSubmit,
  activitySummary = null,
}: EditCulegatorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CulegatorFormData>({
    resolver: zodResolver(culegatorSchema),
    defaultValues: defaults(),
  })

  const watched = useWatch({ control: form.control })

  useEffect(() => {
    if (!culegator || !open) return
    form.reset({
      nume_prenume: culegator.nume_prenume || '',
      telefon: culegator.telefon || '',
      tip_angajare: culegator.tip_angajare || 'Sezonier',
      tarif_lei_kg: String(culegator.tarif_lei_kg ?? 0),
      data_angajare: culegator.data_angajare || '',
      status_activ: Boolean(culegator.status_activ),
      observatii: culegator.observatii || '',
    })
  }, [culegator, open, form])

  const handleSubmit = async (data: CulegatorFormData) => {
    if (!culegator) return
    setIsSubmitting(true)
    try {
      await onSubmit(culegator.id, data)
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

  const estimatPlataSezon = useMemo(() => {
    if (!activitySummary || activitySummary.seasonKg <= 0 || tarifNum <= 0) return null
    return activitySummary.seasonKg * tarifNum
  }, [activitySummary, tarifNum])

  const asideTitle = watched.nume_prenume?.trim() || culegator?.nume_prenume?.trim() || '—'
  const statusActiv = Boolean(watched.status_activ)

  if (!culegator) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează culegător"
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
                <Label htmlFor="edit_culegator_nume">Nume și prenume</Label>
                <Input id="edit_culegator_nume" className="agri-control h-12 md:h-11" {...form.register('nume_prenume')} />
                {form.formState.errors.nume_prenume ? (
                  <p className="text-xs text-red-600">{form.formState.errors.nume_prenume.message}</p>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit_culegator_telefon">Telefon</Label>
                  <Input id="edit_culegator_telefon" type="tel" className="agri-control h-12 md:h-11" {...form.register('telefon')} />
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Detalii">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_culegator_tip">Tip angajare</Label>
                  <select id="edit_culegator_tip" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('tip_angajare')}>
                    <option value="Sezonier">Sezonier</option>
                    <option value="Permanent">Permanent</option>
                    <option value="Zilier">Zilier</option>
                    <option value="Colaborator">Colaborator</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_culegator_tarif">Tarif (lei/kg)</Label>
                  <Input
                    id="edit_culegator_tarif"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="agri-control h-12 md:h-11"
                    {...form.register('tarif_lei_kg')}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit_culegator_data">Data angajare</Label>
                  <Input id="edit_culegator_data" type="date" className="agri-control h-12 md:h-11" {...form.register('data_angajare')} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="edit_culegator_activ"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                  checked={Boolean(form.watch('status_activ'))}
                  onChange={(event) => form.setValue('status_activ', event.target.checked, { shouldDirty: true })}
                />
                <Label htmlFor="edit_culegator_activ" className="cursor-pointer text-sm font-normal">
                  Culegător activ
                </Label>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Observații">
              <Textarea
                id="edit_culegator_obs"
                rows={3}
                className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6rem]"
                {...form.register('observatii')}
              />
            </FormDialogSection>
          </div>

          <aside className="hidden md:block md:sticky md:top-2 md:self-start">
            <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 shadow-[var(--shadow-soft)]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Context</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">{asideTitle}</p>
              </div>
              <dl className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cod înregistrare</dt>
                  <dd className="mt-0.5 font-mono text-xs text-[var(--text-primary)]">{culegator.id_culegator || culegator.id.slice(0, 8)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{watched.telefon?.trim() || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip / tarif</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">
                    {watched.tip_angajare || '—'}
                    {tarifNum > 0 ? ` · ${tarifNum.toLocaleString('ro-RO')} lei/kg` : ''}
                  </dd>
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
              </dl>

              {activitySummary ? (
                <div className="space-y-2 border-t border-[var(--divider)] pt-3 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Activitate (sezon curent)</p>
                  <p>
                    <span className="text-[var(--text-tertiary)]">Kg sezon: </span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatKg(activitySummary.seasonKg)} kg</span>
                  </p>
                  <p>
                    <span className="text-[var(--text-tertiary)]">Recoltări: </span>
                    <span className="font-semibold text-[var(--text-primary)]">{activitySummary.seasonCount}</span>
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    Ultima:{' '}
                    {activitySummary.lastRecoltare
                      ? `${activitySummary.lastRecoltare.date} · ${activitySummary.lastRecoltare.parcela} · ${formatKg(activitySummary.lastRecoltare.kg)} kg`
                      : '—'}
                  </p>
                  {estimatPlataSezon !== null ? (
                    <p>
                      <span className="text-[var(--text-tertiary)]">Estimat plată sezon: </span>
                      <span className="font-semibold text-[var(--text-primary)]">{estimatPlataSezon.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} lei</span>
                      <span className="block text-[10px] text-[var(--text-tertiary)] mt-0.5">kg sezon × tarif din formular</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-[var(--divider)] pt-3">
                <p className="text-xs font-medium text-[var(--text-tertiary)]">Observații</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-primary)]">{clipNote(watched.observatii)}</p>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </AppDialog>
  )
}
