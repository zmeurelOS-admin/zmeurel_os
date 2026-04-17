'use server'

import { z } from 'zod'

import { getMeteoZi, logMeteoWarning } from '@/lib/tratamente/meteo'
import type { MeteoZi } from '@/lib/tratamente/meteo'

const parcelaIdSchema = z.string().uuid('Parcela selectată nu este validă.')

export async function loadHubMeteoParcelaAction(parcelaId: string): Promise<MeteoZi | null> {
  const parsed = parcelaIdSchema.safeParse(parcelaId)
  if (!parsed.success) {
    return null
  }

  try {
    return await getMeteoZi(parsed.data)
  } catch (error) {
    logMeteoWarning('Nu s-a putut încărca meteo pentru hub-ul global de tratamente.', error, {
      parcelaId: parsed.data,
    })
    return null
  }
}
