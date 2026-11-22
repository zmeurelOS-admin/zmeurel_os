/**
 * Lista de analize (tab-ul „Analize” din Tratamente), „Ultima analiză” și rândul de pe fișa parcelei.
 * Funcții pure.
 */
import { zileIntre } from '@/lib/tratamente/zile'

import type { AnalizaRow, StatusAnaliza } from './model'

const LUNI_SCURT = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.']

/** „18 iul.” (anul doar dacă e altul decât `anCurent`: „14 iul. 2025”). */
export function dataScurtaAnaliza(ziua: string, anCurent?: string | number | null): string {
  const [an, luna, zi] = ziua.slice(0, 10).split('-').map(Number)
  const baza = `${zi} ${LUNI_SCURT[luna - 1] ?? ''}`.trim()
  return anCurent !== undefined && anCurent !== null && String(anCurent).slice(0, 4) !== String(an) ? `${baza} ${an}` : baza
}

/** „Maravilla 1 + 2”, „DELNIWA”, „Maravilla 1 + DELNIWA”, „4 parcele”. */
export function textParceleAnaliza(parcelaIds: readonly string[], nume: ReadonlyMap<string, string>): string {
  const lista = parcelaIds.map((id) => nume.get(id) ?? 'Parcelă')
  if (lista.length === 0) return 'Fără parcelă'
  if (lista.length > 3) return `${lista.length} parcele`
  // „Maravilla 1”, „Maravilla 2” → „Maravilla 1 + 2” (același început, diferă doar numărul de la final).
  const prefix = /^(.*\S)\s+(\d+)$/
  const potriviri = lista.map((text) => prefix.exec(text))
  if (lista.length > 1 && potriviri.every((m) => m && m[1] === potriviri[0]![1])) {
    return `${potriviri[0]![1]} ${potriviri.map((m) => m![2]).join(' + ')}`
  }
  return lista.join(' + ')
}

/** Titlul unui rând: parcelele + data prelevării. */
export function titluAnaliza(analiza: Pick<AnalizaRow, 'parcele' | 'data_prelevare'>, nume: ReadonlyMap<string, string>, azi?: string | null): string {
  return `${textParceleAnaliza(analiza.parcele, nume)} · prelevată ${dataScurtaAnaliza(analiza.data_prelevare, azi)}`
}

/** Cele „la laborator” sus (cele mai vechi întâi, așteaptă de mai mult), apoi restul, cele mai noi întâi. */
export function ordoneazaAnalize<T extends Pick<AnalizaRow, 'status' | 'data_prelevare' | 'created_at'>>(analize: readonly T[]): T[] {
  const laLaborator = analize
    .filter((analiza) => analiza.status === 'la_laborator')
    .sort((a, b) => a.data_prelevare.localeCompare(b.data_prelevare) || a.created_at.localeCompare(b.created_at))
  const rest = analize
    .filter((analiza) => analiza.status !== 'la_laborator')
    .sort((a, b) => b.data_prelevare.localeCompare(a.data_prelevare) || b.created_at.localeCompare(a.created_at))
  return [...laLaborator, ...rest]
}

/** Ziua rezultatului: data buletinului, altfel ziua în care s-a trecut rezultatul. */
export function ziRezultat(analiza: Pick<AnalizaRow, 'buletin_data' | 'updated_at'>): string {
  return analiza.buletin_data ?? analiza.updated_at.slice(0, 10)
}

/** Ultima analiză cu rezultat (conform sau neconform), după ziua rezultatului. */
export function ultimaCuRezultat<T extends Pick<AnalizaRow, 'status' | 'buletin_data' | 'updated_at' | 'data_prelevare'>>(analize: readonly T[]): T | null {
  let best: T | null = null
  for (const analiza of analize) {
    if (analiza.status === 'la_laborator') continue
    if (!best) {
      best = analiza
      continue
    }
    const a = ziRezultat(analiza)
    const b = ziRezultat(best)
    if (a > b || (a === b && analiza.data_prelevare > best.data_prelevare)) best = analiza
  }
  return best
}

/** Câte zile e la laborator (de la predare, altfel de la prelevare). */
export function zileLaLaborator(analiza: Pick<AnalizaRow, 'data_predare' | 'data_prelevare'>, azi: string): number {
  return Math.max(0, zileIntre(analiza.data_predare ?? analiza.data_prelevare, azi))
}

export type StareAnalizaParcela =
  | { tip: 'rezultat'; status: Exclude<StatusAnaliza, 'la_laborator'>; analiza: Pick<AnalizaRow, 'id' | 'buletin_data' | 'updated_at' | 'public_token' | 'public_activ'> }
  | { tip: 'la_laborator'; analiza: Pick<AnalizaRow, 'id' | 'data_prelevare'> }
  | { tip: 'netrimisa' }

/**
 * Rândul de pe fișa parcelei, pentru sezonul `an` (anul prelevării):
 * - ultima analiză cu rezultat din sezon („Ultima analiză: conform · vezi raportul” / neconform);
 * - altfel una la laborator;
 * - altfel „Analiza sezonului: netrimisă”.
 */
export function stareAnalizaParcela(analize: readonly AnalizaRow[], parcelaId: string, an: string): StareAnalizaParcela {
  const ale = analize.filter((analiza) => analiza.parcele.includes(parcelaId) && analiza.data_prelevare.startsWith(an))
  const ultima = ultimaCuRezultat(ale)
  if (ultima && ultima.status !== 'la_laborator') return { tip: 'rezultat', status: ultima.status, analiza: ultima }
  const laLab = ale.find((analiza) => analiza.status === 'la_laborator')
  if (laLab) return { tip: 'la_laborator', analiza: laLab }
  return { tip: 'netrimisa' }
}

/** Analizele neconforme din sezon (avertizarea roșie din Acasă). */
export function neconformeInSezon(analize: readonly AnalizaRow[], an: string): AnalizaRow[] {
  return analize.filter((analiza) => analiza.status === 'neconform' && analiza.data_prelevare.startsWith(an))
}
