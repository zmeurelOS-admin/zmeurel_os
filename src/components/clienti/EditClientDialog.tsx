'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Client } from '@/lib/supabase/queries/clienti'

const schema = z.object({
  nume_client: z.string().trim().min(2, 'Numele trebuie sa aiba minim 2 caractere'),
  telefon: z.string().optional(),
  email: z.string().email('Email invalid').or(z.literal('')).optional(),
  adresa: z.string().optional(),
  pret_negociat_lei_kg: z.string().optional(),
  observatii: z.string().optional(),
})

type ClientFormData = z.infer<typeof schema>

interface EditClientDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, data: ClientFormData) => Promise<void>
}

const defaults = (): ClientFormData => ({
  nume_client: '',
  telefon: '',
  email: '',
  adresa: '',
  pret_negociat_lei_kg: '',
  observatii: '',
})

export function EditClientDialog({ client, open, onOpenChange, onSubmit }: EditClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
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

  if (!client) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează client"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="agri-cta" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Anulează
          </Button>
          <Button
            type="button"
            className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se salvează...
              </>
            ) : (
              'Salvează'
            )}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="edit_client_nume">Nume client</Label>
          <Input id="edit_client_nume" className="agri-control h-12" {...form.register('nume_client')} />
          {form.formState.errors.nume_client ? <p className="text-xs text-red-600">{form.formState.errors.nume_client.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_client_telefon">Telefon</Label>
          <Input id="edit_client_telefon" type="tel" className="agri-control h-12" {...form.register('telefon')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_client_email">Email</Label>
          <Input id="edit_client_email" type="email" className="agri-control h-12" {...form.register('email')} />
          {form.formState.errors.email ? <p className="text-xs text-red-600">{form.formState.errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_client_adresa">Adresa</Label>
          <Textarea id="edit_client_adresa" rows={3} className="agri-control w-full px-3 py-2 text-base" {...form.register('adresa')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_client_pret">Pret negociat (lei/kg)</Label>
          <Input
            id="edit_client_pret"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="agri-control h-12"
            {...form.register('pret_negociat_lei_kg')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_client_obs">Observații</Label>
          <Textarea id="edit_client_obs" rows={4} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii')} />
        </div>
      </form>
    </AppDialog>
  )
}
