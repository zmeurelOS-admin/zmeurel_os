/**
 * Prețul standard (lei/kg) pentru persoane fizice: trei perioade, una activă.
 * Îl folosesc Comenzi, Vânzarea rapidă, Clienți și Setări.
 *
 * Patiseriile și magazinele au preț negociat în fișa clientului; prețul se poate schimba la fiecare comandă.
 * Cât setarea lipsește din baza de date (migrarea nerulată), prețul e cel de până acum: 35 lei/kg.
 */
import { useFarmSettings, type FarmSettings, type PerioadaPret } from '@/lib/farm-settings'

/** Prețul fix de până acum (era scris în `ComenziPageClient`). */
export const PRET_STANDARD_REZERVA = 35

export const PRET_STANDARD_IMPLICIT: Record<PerioadaPret, number> = {
  inceput: 35,
  varf: 25,
  mediu: 30,
}

export const PERIOADA_PRET_LABEL: Record<PerioadaPret, string> = {
  inceput: 'Început de sezon',
  varf: 'Vârf de sezon',
  mediu: 'Mediu',
}

export const PERIOADE_PRET: readonly PerioadaPret[] = ['inceput', 'varf', 'mediu']

export interface PretStandard {
  inceput: number
  varf: number
  mediu: number
  perioada: PerioadaPret
  /** Prețul perioadei active: ce primesc comenzile noi. */
  activ: number
  /** Se poate schimba din Setări (coloanele există în baza de date). */
  configurabil: boolean
}

export const PRET_STANDARD_FARA_SETARE: PretStandard = {
  ...PRET_STANDARD_IMPLICIT,
  perioada: 'inceput',
  activ: PRET_STANDARD_REZERVA,
  configurabil: false,
}

type PretSettings = Pick<
  FarmSettings,
  'pretStandardConfigurabil' | 'pretInceput' | 'pretVarf' | 'pretMediu' | 'pretPerioada'
>

/** Funcție pură: setările fermei → prețul standard. */
export function resolvePretStandard(settings: PretSettings | null | undefined): PretStandard {
  if (!settings?.pretStandardConfigurabil) return PRET_STANDARD_FARA_SETARE

  const prices: Record<PerioadaPret, number> = {
    inceput: settings.pretInceput ?? PRET_STANDARD_IMPLICIT.inceput,
    varf: settings.pretVarf ?? PRET_STANDARD_IMPLICIT.varf,
    mediu: settings.pretMediu ?? PRET_STANDARD_IMPLICIT.mediu,
  }
  const perioada = settings.pretPerioada ?? 'inceput'
  return { ...prices, perioada, activ: prices[perioada], configurabil: true }
}

/**
 * Prețul unei comenzi noi pentru un client: cel negociat din fișa lui, dacă e completat (patiserii și
 * magazine; un client vechi de tip „persoană” cu preț negociat și-l păstrează), altfel prețul standard
 * al perioadei active.
 */
export function pretPentruClient(
  client: { pret_negociat_lei_kg?: number | null } | null | undefined,
  standard: PretStandard,
): { pret: number; sursa: 'negociat' | 'standard' } {
  const negociat = Number(client?.pret_negociat_lei_kg ?? 0)
  if (client && Number.isFinite(negociat) && negociat > 0) {
    return { pret: negociat, sursa: 'negociat' }
  }
  return { pret: standard.activ, sursa: 'standard' }
}

export function usePretStandard(): PretStandard {
  const { settings } = useFarmSettings()
  return resolvePretStandard(settings)
}
