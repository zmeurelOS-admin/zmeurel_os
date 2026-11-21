/**
 * Un singur semnal pe cardul unei parcele, cel mai important:
 *   pauza (din `lib/tratamente/pauza`) > un tratament sau o lucrare planificată > stadiul curent.
 * Fără React și fără Supabase.
 */
import type { PauzaParcela } from '@/lib/tratamente/pauza'
import { ziCuDataRo, zileIntre } from '@/lib/tratamente/zile'

export type TonSemnal = 'warning' | 'info' | 'success' | 'neutral'

export interface SemnalParcela {
  tip: 'pauza' | 'planificat' | 'stadiu'
  text: string
  ton: TonSemnal
}

export interface PlanificatParcela {
  /** Ziua planificată (ora României). */
  zi: string
  tip: 'tratament' | 'lucrare'
  /** „Palisare” la lucrări; la tratamente nu se folosește. */
  eticheta?: string
}

/** „azi”, „mâine”, „sâmbătă 23.11” (cu literă mică, în mijlocul frazei). */
export function ziScurta(zi: string, azi: string): string {
  const diff = zileIntre(azi, zi)
  if (diff === 0) return 'azi'
  if (diff === 1) return 'mâine'
  return ziCuDataRo(zi)
}

/** Cel mai apropiat planificat: întârziatele întâi (cel mai vechi), apoi de azi încolo. */
export function celMaiApropiat(planificate: readonly PlanificatParcela[]): PlanificatParcela | null {
  if (planificate.length === 0) return null
  return [...planificate].sort((a, b) => a.zi.localeCompare(b.zi) || (a.tip === 'tratament' ? -1 : 1))[0]
}

export function textPlanificat(planificat: PlanificatParcela, azi: string): string {
  const nume = planificat.tip === 'tratament' ? 'Tratament planificat' : `${planificat.eticheta?.trim() || 'Lucrare'} planificată`
  if (planificat.zi < azi) return `${nume}, întârziat${planificat.tip === 'tratament' ? '' : 'ă'}`
  return `${nume} ${ziScurta(planificat.zi, azi)}`
}

export function semnalParcela(input: {
  pauza: PauzaParcela | null | undefined
  planificate: readonly PlanificatParcela[]
  /** Textul stadiului curent; `null` = fără stadiu. */
  stadiu: string | null | undefined
  azi: string
}): SemnalParcela | null {
  if (input.pauza && input.pauza.zileRamase > 0) {
    return { tip: 'pauza', text: `Pauză până ${ziCuDataRo(input.pauza.panaLa)}`, ton: 'warning' }
  }
  const planificat = celMaiApropiat(input.planificate)
  if (planificat) {
    return { tip: 'planificat', text: textPlanificat(planificat, input.azi), ton: planificat.zi < input.azi ? 'warning' : 'info' }
  }
  const stadiu = input.stadiu?.trim()
  if (stadiu) return { tip: 'stadiu', text: stadiu, ton: 'success' }
  return null
}
