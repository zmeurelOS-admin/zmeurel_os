/**
 * Alegerile rapide de la „Altele” (promptul 34, §7): textele scrise cel mai des la „Ce ai făcut?”, pe fermă,
 * derivate din lucrările deja încărcate (fără tabel nou). Doar rândurile „Altele: <text>”; cele vechi („Altele”,
 * „Recoltare”) nu intră. Fără React și fără Supabase.
 */
import { textAltele } from './tipuri'

/** Câte alegeri rapide apar în pasul 1. */
export const MAX_ALEGERI_RAPIDE = 5

const cheie = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('ro-RO')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Cele mai folosite texte, după câte apariții (o lucrare pe mai multe parcele contează o dată pe lot), apoi după cea
 * mai nouă. Fără diferențe de majuscule, diacritice și spații; se păstrează scrierea celei mai noi apariții.
 */
export function alegeriRapideAltele(
  rows: ReadonlyArray<{ tip_activitate: string | null; data_aplicare?: string | null; created_at?: string | null; lot_id?: string | null; id?: string }>,
  max = MAX_ALEGERI_RAPIDE,
): string[] {
  const grupuri = new Map<string, { text: string; nr: number; ultima: string; loturi: Set<string> }>()
  for (const row of rows) {
    const text = textAltele(row.tip_activitate)
    if (!text) continue
    const k = cheie(text)
    const moment = String(row.created_at ?? row.data_aplicare ?? '')
    const lot = row.lot_id ?? row.id ?? `${moment}:${k}`
    const grup = grupuri.get(k)
    if (!grup) {
      grupuri.set(k, { text, nr: 1, ultima: moment, loturi: new Set([lot]) })
      continue
    }
    if (!grup.loturi.has(lot)) {
      grup.loturi.add(lot)
      grup.nr += 1
    }
    if (moment > grup.ultima) {
      grup.ultima = moment
      grup.text = text
    }
  }
  return [...grupuri.values()]
    .sort((a, b) => b.nr - a.nr || b.ultima.localeCompare(a.ultima))
    .slice(0, max)
    .map((grup) => grup.text)
}
