/**
 * Tratamentul „La sol” (gunoi de grajd, îngrășăminte solide), promptul 34, §8. Funcții pure.
 *
 * - Cantitatea se scrie pe parcele (total) sau la ha, în kg, tone sau litri.
 * - În bază, cantitatea se ține în kg (sau l): `cantitate_totala` + `unitate_cantitate` = `kg` / `l` (constrângerea
 *   coloanei nu acceptă tone și nu o atingem). La ha, doza se ține în `doza_l_per_ha`, tot în kg/ha (sau l/ha), cum se
 *   scrie deja la stropirea „la ha” cu pulbere.
 * - Unitatea aleasă de om (t sau kg, pe parcele sau la ha) se păstrează în `cantitate_text`: „0,75 t · 3 t/ha”.
 *   Registrul, fișa parcelei și jurnalul afișează cantitatea în unitatea aceea (`afisareSol`).
 */

export type UnitateSol = 'kg' | 't' | 'l'
export type ModSol = 'total' | 'ha'

export const UNITATI_SOL: readonly UnitateSol[] = ['kg', 't', 'l']

/** Câte kg (sau l) are o unitate: 1 t = 1.000 kg. */
export function factorSol(unitate: UnitateSol): number {
  return unitate === 't' ? 1000 : 1
}

/** Unitatea din bază: `kg` pentru kg și tone, `l` pentru litri. */
export function unitateBazaSol(unitate: UnitateSol): 'kg' | 'l' {
  return unitate === 'l' ? 'l' : 'kg'
}

const rotunjeste = (n: number, zecimale = 3) => {
  const f = 10 ** zecimale
  return Math.round(n * f) / f
}

/** Totalul pe toate parcelele, în kg (sau l). La ha fără suprafață: `null`. */
export function totalSolBaza(input: { doza: number | null; mod: ModSol; unitate: UnitateSol; ha: number }): number | null {
  const doza = Number(input.doza)
  if (!Number.isFinite(doza) || doza <= 0) return null
  const baza = doza * factorSol(input.unitate)
  if (input.mod === 'total') return rotunjeste(baza)
  if (!(input.ha > 0)) return null
  return rotunjeste(baza * input.ha)
}

/** Doza la ha, în kg/ha (sau l/ha): cea scrisă la ha, sau totalul împărțit la suprafață. */
export function dozaHaSolBaza(input: { doza: number | null; mod: ModSol; unitate: UnitateSol; ha: number }): number | null {
  const doza = Number(input.doza)
  if (!Number.isFinite(doza) || doza <= 0) return null
  const baza = doza * factorSol(input.unitate)
  if (input.mod === 'ha') return rotunjeste(baza)
  return input.ha > 0 ? rotunjeste(baza / input.ha) : null
}

const fmt = (n: number, max = 2) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: max }).format(n)

/** „0,75 t”, „750 kg”, „20 l”: o cantitate din bază (kg / l), în unitatea aleasă. */
export function formatCantitateSol(baza: number, unitate: UnitateSol): string {
  if (unitate === 't') return `${fmt(baza / 1000, 3)} t`
  return `${fmt(baza)} ${unitate}`
}

/** „3 t/ha”, „3.000 kg/ha”, „80 l/ha”. */
export function formatDozaHaSol(dozaBaza: number, unitate: UnitateSol): string {
  if (unitate === 't') return `${fmt(dozaBaza / 1000, 3)} t/ha`
  return `${fmt(dozaBaza)} ${unitate}/ha`
}

/** Ce se scrie în `cantitate_text` pe rândul unei parcele: „0,75 t” sau, la ha, „0,75 t · 3 t/ha”. */
export function textSol(input: { parteBaza: number; unitate: UnitateSol; mod: ModSol; dozaHaBaza: number | null }): string {
  const cantitate = formatCantitateSol(input.parteBaza, input.unitate)
  if (input.mod === 'ha' && input.dozaHaBaza !== null) return `${cantitate} · ${formatDozaHaSol(input.dozaHaBaza, input.unitate)}`
  return cantitate
}

/** Citește înapoi unitatea și modul din `cantitate_text` („0,75 t · 3 t/ha”). `null` = text vechi sau gol. */
export function citesteTextSol(text: string | null | undefined): { unitate: UnitateSol; mod: ModSol } | null {
  const match = /^\s*[\d.,]+\s*(t|kg|l)\b(?:\s*·\s*[\d.,]+\s*(?:t|kg|l)\s*\/\s*ha)?/i.exec(text ?? '')
  if (!match) return null
  const unitate = match[1].toLowerCase() as UnitateSol
  return { unitate, mod: /\/\s*ha/i.test(match[0]) ? 'ha' : 'total' }
}

/**
 * Afișarea unei cantități „La sol” în unitatea aleasă la salvare: cantitatea (suma pe parcele, din bază) și, dacă s-a
 * scris la ha, doza la ha. Fără text (rânduri vechi): kg / l, ca înainte.
 */
export function afisareSol(input: {
  cantitateBaza: number | null
  unitateBaza: string | null
  cantitateText: string | null
  dozaHaBaza: number | null
}): { cantitate: string | null; doza: string | null } {
  const citit = citesteTextSol(input.cantitateText)
  const unitate: UnitateSol = citit?.unitate ?? (input.unitateBaza === 'l' ? 'l' : 'kg')
  const cantitate = input.cantitateBaza !== null && input.cantitateBaza > 0 ? formatCantitateSol(input.cantitateBaza, unitate) : null
  const doza = citit?.mod === 'ha' && input.dozaHaBaza !== null && input.dozaHaBaza > 0 ? formatDozaHaSol(input.dozaHaBaza, unitate) : null
  return { cantitate, doza }
}

/** Conversia afișată sub câmp: „3 t/ha × 0,25 ha = 0,75 t” sau „750 kg pe 0,25 ha = 3.000 kg/ha”. */
export function textConversieSol(input: { doza: number | null; mod: ModSol; unitate: UnitateSol; ha: number }): string | null {
  const total = totalSolBaza(input)
  const dozaHa = dozaHaSolBaza(input)
  const ha = fmt(input.ha, 2)
  if (input.mod === 'ha') {
    if (dozaHa === null || total === null) return null
    return `${formatDozaHaSol(dozaHa, input.unitate)} × ${ha} ha = ${formatCantitateSol(total, input.unitate)}`
  }
  if (total === null || dozaHa === null) return null
  return `${formatCantitateSol(total, input.unitate)} pe ${ha} ha = ${formatDozaHaSol(dozaHa, input.unitate)}`
}
