'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { AppDialog } from '@/components/app/AppDialog'
import {
  CulegatorForm,
  culegatorSchema,
  getCulegatorFormDefaults,
  type CulegatorFormData,
} from '@/components/culegatori/CulegatorForm'
import type { CulegatorDialogActivitySummary } from '@/components/culegatori/CulegatorFormSummary'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import type { Culegator } from '@/lib/supabase/queries/culegatori'

interface EditCulegatorDialogProps {
  culegator: Culegator | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: CulegatorFormData) => Promise<void>
  /** Din `workerStats` pe listă; opțional. */
  activitySummary?: CulegatorDialogActivitySummary | null
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
    defaultValues: getCulegatorFormDefaults(),
  })

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
      description="Actualizezi rapid profilul și vezi imediat rezumatul live înainte de salvare."
      desktopFormWide
      desktopFormCompact
      showCloseButton
      contentClassName="md:w-[min(96vw,66rem)] md:max-w-none lg:w-[min(94vw,68rem)]"
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
        <CulegatorForm
          form={form}
          mode="edit"
          recordCode={culegator.id_culegator || culegator.id.slice(0, 8)}
          activitySummary={activitySummary}
        />
      </form>
    </AppDialog>
  )
}
