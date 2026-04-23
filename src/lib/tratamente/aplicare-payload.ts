import { z } from 'zod'

import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

export const aplicareProdusPayloadSchema = z.object({
  plan_linie_produs_id: z.string().uuid().nullable().optional(),
  ordine: z.number().int().min(1),
  produs_id: z.string().uuid().nullable().optional(),
  produs_nume_manual: z.string().trim().optional().default(''),
  produs_nume_snapshot: z.string().trim().nullable().optional(),
  substanta_activa_snapshot: z.string().trim().optional().default(''),
  tip_snapshot: z.string().nullable().optional(),
  frac_irac_snapshot: z.string().trim().optional().default(''),
  phi_zile_snapshot: z.number().int().min(0).nullable().optional(),
  doza_ml_per_hl: z.number().min(0).nullable().optional(),
  doza_l_per_ha: z.number().min(0).nullable().optional(),
  cantitate_totala: z.number().min(0).nullable().optional(),
  unitate_cantitate: z.enum(['ml', 'l', 'kg', 'g', 'buc', 'altul']).nullable().optional(),
  stoc_mutatie_id: z.string().uuid().nullable().optional(),
  observatii: z.string().trim().optional().default(''),
})

export const diferenteFataDePlanSchema = z
  .object({
    automat: z.array(z.string().trim()).optional(),
    observatii: z.string().trim().nullable().optional(),
  })
  .nullable()

export type AplicareProdusPayload = z.infer<typeof aplicareProdusPayloadSchema>

export function parseAplicareProduse(raw: string | null | undefined): AplicareProdusPayload[] {
  if (!raw?.trim()) return []
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('Produsele aplicării nu sunt într-un format valid.')
  }

  const parsed = z.array(aplicareProdusPayloadSchema).safeParse(json)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Produsele aplicării nu sunt valide.')
  }
  return parsed.data
}

export function parseDiferenteFataDePlan(raw: string | null | undefined) {
  if (!raw?.trim()) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('Diferențele față de plan nu sunt într-un format valid.')
  }

  const parsed = diferenteFataDePlanSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Diferențele față de plan nu sunt valide.')
  }
  return parsed.data
}

export function hasAplicareProductDraftErrors(produse: AplicareProdusPayload[]): string | null {
  if (produse.length === 0) return 'Aplicarea trebuie să aibă cel puțin un produs.'
  const invalid = produse.find((produs) => !produs.produs_id && !produs.produs_nume_manual.trim())
  if (invalid) return 'Fiecare produs trebuie selectat din bibliotecă sau completat manual.'
  return null
}

export function getAplicareProductLabel(
  produs: AplicareProdusPayload,
  catalog: ProdusFitosanitar[] = []
): string {
  const catalogItem = produs.produs_id ? catalog.find((item) => item.id === produs.produs_id) : null
  return catalogItem?.nume_comercial || produs.produs_nume_manual.trim() || produs.produs_nume_snapshot || 'Produs fără nume'
}

export function normalizeCohorta(value: string | null | undefined): Cohorta | null {
  return value === 'floricane' || value === 'primocane' ? value : null
}
