'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  getCapcanaCuVerificari,
  listCapcaneActive,
  mapTratamenteError,
  montaCapcana,
  verificaCapcana,
  type CapcanaMontataView,
} from '@/lib/supabase/queries/tratamente'
import { tipCapcanaSchema } from '@/types/tratamente-metode'

const montaCapcanaSchema = z.object({
  parcelaId: z.string().uuid(),
  tipCapcana: tipCapcanaSchema,
  nrBucati: z.number().int().min(1).max(1000),
  dataMontare: z.string().optional(),
  dataUrmatoareaVerificare: z.string().optional(),
  observatii: z.string().optional(),
  fotoUrl: z.string().url().optional(),
})

const verificaCapcanaSchema = z.object({
  capcanaMontataId: z.string().uuid(),
  nrCapturati: z.number().int().min(0).optional(),
  actiune: z.enum(['inlocuit', 'curatat', 'scos', 'doar_observat']),
  pragDepasit: z.boolean().optional(),
  observatii: z.string().optional(),
  fotoUrl: z.string().url().optional(),
})

const listCapcaneActiveSchema = z.object({
  parcelaId: z.string().uuid().optional(),
  parcelaIds: z.array(z.string().uuid()).max(200).optional(),
})

export type MontaCapcanaInput = z.infer<typeof montaCapcanaSchema>
export type VerificaCapcanaInput = z.infer<typeof verificaCapcanaSchema>
export type ListCapcaneActiveInput = z.infer<typeof listCapcaneActiveSchema>
export type CapcaneActionResult =
  | { ok: true }
  | { ok: false; error: string }
export type ListCapcaneActiveActionResult =
  | { ok: true; data: CapcanaMontataView[] }
  | { ok: false; error: string }

function revalidateCapcanePaths(parcelaId: string) {
  revalidatePath('/tratamente')
  revalidatePath(`/parcele/${parcelaId}/tratamente`)
}

/** Montează o capcană și revalidează hub-urile dependente. */
export async function montaCapcanaAction(input: MontaCapcanaInput): Promise<CapcaneActionResult> {
  const parsed = montaCapcanaSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut monta capcana.',
    }
  }

  try {
    const capcana = await montaCapcana({
      parcelaId: parsed.data.parcelaId,
      tipCapcana: parsed.data.tipCapcana,
      nrBucati: parsed.data.nrBucati,
      dataMontare: parsed.data.dataMontare?.trim() || null,
      dataUrmatoareaVerificare: parsed.data.dataUrmatoareaVerificare?.trim() || null,
      observatii: parsed.data.observatii?.trim() || null,
      fotoUrl: parsed.data.fotoUrl?.trim() || null,
    })

    revalidateCapcanePaths(capcana.parcela_id)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut monta capcana.').message,
    }
  }
}

/** Salvează o verificare de capcană și revalidează hub-urile dependente. */
export async function verificaCapcanaAction(input: VerificaCapcanaInput): Promise<CapcaneActionResult> {
  const parsed = verificaCapcanaSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut salva verificarea capcanei.',
    }
  }

  try {
    await verificaCapcana({
      capcanaMontataId: parsed.data.capcanaMontataId,
      nrCapturati: parsed.data.nrCapturati ?? null,
      actiune: parsed.data.actiune,
      pragDepasit: parsed.data.pragDepasit ?? false,
      observatii: parsed.data.observatii?.trim() || null,
      fotoUrl: parsed.data.fotoUrl?.trim() || null,
    })

    const capcana = await getCapcanaCuVerificari(parsed.data.capcanaMontataId)
    if (!capcana) {
      revalidatePath('/tratamente')
      return { ok: true }
    }

    revalidateCapcanePaths(capcana.parcela_id)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut salva verificarea capcanei.').message,
    }
  }
}

/** Listează capcanele active pentru selectorul mobil de verificare. */
export async function listCapcaneActiveAction(
  input: ListCapcaneActiveInput
): Promise<ListCapcaneActiveActionResult> {
  const parsed = listCapcaneActiveSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut încărca capcanele active.',
    }
  }

  const targetIds = parsed.data.parcelaId
    ? [parsed.data.parcelaId]
    : Array.from(new Set(parsed.data.parcelaIds ?? []))

  if (targetIds.length === 0) {
    return { ok: true, data: [] }
  }

  try {
    const grouped = await Promise.all(targetIds.map((parcelaId) => listCapcaneActive(parcelaId)))
    return {
      ok: true,
      data: grouped.flat().sort((first, second) => {
        const firstDate = first.data_urmatoarea_verificare ?? first.data_montare
        const secondDate = second.data_urmatoarea_verificare ?? second.data_montare
        return firstDate.localeCompare(secondDate)
      }),
    }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut încărca capcanele active.').message,
    }
  }
}
