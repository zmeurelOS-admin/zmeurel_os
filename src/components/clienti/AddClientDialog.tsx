'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  nume_client: z.string().trim().min(2, 'Numele trebuie sa aiba minim 2 caractere'),
  telefon: z.string().optional(),
  email: z.string().email('Email invalid').or(z.literal('')).optional(),
  adresa: z.string().optional(),
  pret_negociat_lei_kg: z.string().optional(),
  observatii: z.string().optional(),
})

type ClientFormData = z.infer<typeof schema>

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ClientFormData) => Promise<void>
  initialValues?: Partial<ClientFormData>
}

const defaults = (initialValues?: Partial<ClientFormData>): ClientFormData => ({
  nume_client: initialValues?.nume_client ?? '',
  telefon: initialValues?.telefon ?? '',
  email: initialValues?.email ?? '',
  adresa: initialValues?.adresa ?? '',
  pret_negociat_lei_kg: initialValues?.pret_negociat_lei_kg ?? '',
  observatii: initialValues?.observatii ?? '',
})

export function AddClientDialog({ open, onOpenChange, onSubmit, initialValues }: AddClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults(initialValues),
  })

  useEffect(() => {
    if (open) {
      form.reset(defaults(initialValues))
      return
    }
    form.reset(defaults())
  }, [form, initialValues, open])

  const handleSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă client nou"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="agri-cta" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Anulează
          </Button>
          <Button
            type="button"
            className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
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
          <Label htmlFor="client_nume">Nume client</Label>
          <Input id="client_nume" className="agri-control h-12" placeholder="Restaurant La Zmeura" {...form.register('nume_client')} />
          {form.formState.errors.nume_client ? <p className="text-xs text-red-600">{form.formState.errors.nume_client.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="client_telefon">Telefon</Label>
          <Input id="client_telefon" type="tel" className="agri-control h-12" placeholder="0740123456" {...form.register('telefon')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client_email">Email</Label>
          <Input id="client_email" type="email" className="agri-control h-12" placeholder="contact@client.ro" {...form.register('email')} />
          {form.formState.errors.email ? <p className="text-xs text-red-600">{form.formState.errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="client_adresa">Adresa</Label>
          <Textarea id="client_adresa" rows={3} className="agri-control w-full px-3 py-2 text-base" {...form.register('adresa')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client_pret">Pret negociat (lei/kg)</Label>
          <Input
            id="client_pret"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="agri-control h-12"
            placeholder="12.50"
            {...form.register('pret_negociat_lei_kg')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client_obs">Observații</Label>
          <Textarea id="client_obs" rows={4} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii')} />
        </div>
      </form>
    </AppDrawer>
  )
}
