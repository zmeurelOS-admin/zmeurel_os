'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { AppDrawer } from '@/components/app/AppDrawer'
import {
  ClientForm,
  clientSchema,
  getClientFormDefaults,
  type ClientFormData,
} from '@/components/clienti/ClientForm'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { downloadVCard } from '@/lib/utils/downloadVCard'

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ClientFormData) => Promise<void>
  initialValues?: Partial<ClientFormData>
}

export function AddClientDialog({ open, onOpenChange, onSubmit, initialValues }: AddClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: getClientFormDefaults(initialValues),
  })

  useEffect(() => {
    if (open) {
      form.reset(getClientFormDefaults(initialValues))
      return
    }
    form.reset(getClientFormDefaults())
  }, [form, initialValues, open])

  const handleSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      const name = data.nume_client.trim()
      const phone = (data.telefon ?? '').trim()
      if (data.salveaza_in_telefon && name && phone) {
        downloadVCard(name, phone)
      }
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
      title="Adaugă client"
      description="Completezi rapid profilul clientului și verifici rezumatul din dreapta înainte de salvare."
      desktopFormWide
      desktopFormCompact
      showCloseButton
      contentClassName="md:w-[min(96vw,64rem)] md:max-w-none lg:w-[min(94vw,65rem)]"
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
        <ClientForm form={form} mode="create" showSaveToPhone />
      </form>
    </AppDrawer>
  )
}
