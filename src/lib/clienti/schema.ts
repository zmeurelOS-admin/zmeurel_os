import { z } from 'zod'

/**
 * Regulile de validare ale unui client. Folosite de formularul din Clienți și de salvarea unui client
 * odată cu o comandă (`lib/comenzi/ai-order-client`).
 */
export const clientSchema = z.object({
  nume_client: z.string().trim().min(2, 'Numele trebuie să aibă minimum 2 caractere'),
  tip: z.enum(['standard', 'patiserie', 'magazin']).default('standard'),
  telefon: z.string().optional(),
  email: z.string().email('Email invalid').or(z.literal('')).optional(),
  adresa: z.string().optional(),
  pret_negociat_lei_kg: z.string().optional(),
  observatii: z.string().optional(),
  salveaza_in_telefon: z.boolean().optional(),
})

export type ClientFormInput = z.input<typeof clientSchema>
export type ClientFormData = z.output<typeof clientSchema>
