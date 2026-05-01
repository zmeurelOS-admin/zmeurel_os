'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { AppDialog } from '@/components/app/AppDialog'
import {
  ClientForm,
  clientSchema,
  getClientFormDefaults,
  type ClientFormData,
} from '@/components/clienti/ClientForm'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import type { Client } from '@/lib/supabase/queries/clienti'

interface EditClientDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: ClientFormData) => Promise<void>
}

export function EditClientDialog({ client, open, onOpenChange, onSubmit }: EditClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: getClientFormDefaults(),
  })

  useEffect(() => {
    if (!open || !client) return
    form.reset({
      nume_client: client.nume_client || '',
      telefon: client.telefon || '',
      email: client.email || '',
      adresa: client.adresa || '',
      pret_negociat_lei_kg: client.pret_negociat_lei_kg ? String(client.pret_negociat_lei_kg) : '',
      observatii: client.observatii || '',
      salveaza_in_telefon: false,
    })
  }, [open, client, form])

  const handleSubmit = async (data: ClientFormData) => {
    if (!client) return
    setIsSubmitting(true)
    try {
      await onSubmit(client.id, data)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
  }

  if (!client) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează client"
      description="Actualizezi rapid profilul și vezi imediat rezumatul live înainte de salvare."
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
        <ClientForm form={form} mode="edit" />
      </form>
    </AppDialog>
  )
}
