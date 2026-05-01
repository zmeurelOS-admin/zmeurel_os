'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { AppDrawer } from '@/components/app/AppDrawer'
import {
  CulegatorForm,
  culegatorSchema,
  getCulegatorFormDefaults,
  type CulegatorFormData,
} from '@/components/culegatori/CulegatorForm'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'

interface AddCulegatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CulegatorFormData) => Promise<void>
}

export function AddCulegatorDialog({ open, onOpenChange, onSubmit }: AddCulegatorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CulegatorFormData>({
    resolver: zodResolver(culegatorSchema),
    defaultValues: getCulegatorFormDefaults(),
  })

  useEffect(() => {
    if (!open) form.reset(getCulegatorFormDefaults())
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

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă culegător"
      description="Completezi rapid profilul și verifici rezumatul din dreapta înainte de salvare."
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
        <CulegatorForm form={form} mode="create" />
      </form>
    </AppDrawer>
  )
}
