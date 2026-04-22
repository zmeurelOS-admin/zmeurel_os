'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { CulegatorFormSummary, type CulegatorDialogActivitySummary } from '@/components/culegatori/CulegatorFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { DesktopFormGrid, FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <DesktopFormGrid
          aside={
            <CulegatorFormSummary
              title={watched.nume_prenume || culegator.nume_prenume}
              phone={watched.telefon}
              employmentType={watched.tip_angajare}
              rate={watched.tarif_lei_kg}
              startDate={watched.data_angajare}
              active={Boolean(watched.status_activ)}
              observations={watched.observatii}
              mode="edit"
              recordCode={culegator.id_culegator || culegator.id.slice(0, 8)}
              activitySummary={activitySummary}
            />
          }
        >
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
        </DesktopFormGrid>
      </form>
    </AppDialog>
  )
}
