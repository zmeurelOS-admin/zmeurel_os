'use client'

import { type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

import { ClientFormSummary } from '@/components/clienti/ClientFormSummary'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const clientSchema = z.object({
  nume_client: z.string().trim().min(2, 'Numele trebuie să aibă minimum 2 caractere'),
  telefon: z.string().optional(),
  email: z.string().email('Email invalid').or(z.literal('')).optional(),
  adresa: z.string().optional(),
  pret_negociat_lei_kg: z.string().optional(),
  observatii: z.string().optional(),
  salveaza_in_telefon: z.boolean().optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>

export function getClientFormDefaults(initialValues?: Partial<ClientFormData>): ClientFormData {
  return {
    nume_client: initialValues?.nume_client ?? '',
    telefon: initialValues?.telefon ?? '',
    email: initialValues?.email ?? '',
    adresa: initialValues?.adresa ?? '',
    pret_negociat_lei_kg: initialValues?.pret_negociat_lei_kg ?? '',
    observatii: initialValues?.observatii ?? '',
    salveaza_in_telefon: false,
  }
}

interface ClientFormProps {
  form: UseFormReturn<ClientFormData>
  mode: 'create' | 'edit'
  showSaveToPhone?: boolean
}

export function ClientForm({ form, mode, showSaveToPhone = false }: ClientFormProps) {
  const watched = form.watch()

  return (
    <DesktopFormGrid
      className="md:grid-cols-[minmax(0,1fr)_16rem] md:gap-3 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-3.5"
      aside={
        <ClientFormSummary
          name={watched.nume_client}
          phone={watched.telefon}
          email={watched.email}
          address={watched.adresa}
          negotiatedPrice={watched.pret_negociat_lei_kg}
          notes={watched.observatii}
        />
      }
    >
      <FormDialogSection>
        <DesktopFormPanel>
          <div className="grid gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_client_nume' : 'client_nume'}>Nume client</Label>
              <Input
                id={mode === 'edit' ? 'edit_client_nume' : 'client_nume'}
                className="agri-control h-11 md:h-10"
                placeholder="Restaurant La Zmeura"
                {...form.register('nume_client')}
              />
              {form.formState.errors.nume_client ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.nume_client.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_client_telefon' : 'client_telefon'}>Telefon</Label>
              <Input
                id={mode === 'edit' ? 'edit_client_telefon' : 'client_telefon'}
                type="tel"
                className="agri-control h-11 md:h-10"
                placeholder="0740123456"
                {...form.register('telefon')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_client_email' : 'client_email'}>Email</Label>
              <Input
                id={mode === 'edit' ? 'edit_client_email' : 'client_email'}
                type="email"
                className="agri-control h-11 md:h-10"
                placeholder="contact@client.ro"
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_client_pret' : 'client_pret'}>Preț negociat (lei/kg)</Label>
              <Input
                id={mode === 'edit' ? 'edit_client_pret' : 'client_pret'}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="agri-control h-11 md:h-10"
                placeholder="12.50"
                {...form.register('pret_negociat_lei_kg')}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={mode === 'edit' ? 'edit_client_adresa' : 'client_adresa'}>Adresă</Label>
              <Textarea
                id={mode === 'edit' ? 'edit_client_adresa' : 'client_adresa'}
                rows={2}
                className="agri-control min-h-[3.5rem] w-full px-3 py-2 text-base md:min-h-[3.75rem]"
                {...form.register('adresa')}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={mode === 'edit' ? 'edit_client_obs' : 'client_obs'}>Observații</Label>
              <Textarea
                id={mode === 'edit' ? 'edit_client_obs' : 'client_obs'}
                rows={2}
                className="agri-control min-h-[3.75rem] w-full px-3 py-2 text-base md:min-h-[4rem]"
                {...form.register('observatii')}
              />
            </div>

            {showSaveToPhone ? (
              <div className="md:col-span-2">
                <label className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--shadow-soft)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[var(--agri-border)] text-[var(--agri-primary)]"
                    {...form.register('salveaza_in_telefon')}
                  />
                  <span>
                    <span className="block font-medium">Salvează și în telefon</span>
                    <span className="block text-xs text-[var(--text-secondary)]">
                      Descarcă automat contactul ca vCard după salvare.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </DesktopFormPanel>
      </FormDialogSection>
    </DesktopFormGrid>
  )
}
