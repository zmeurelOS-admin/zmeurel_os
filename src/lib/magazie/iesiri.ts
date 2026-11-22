/**
 * Ieșirea automată din magazie la un tratament făcut, fără baza de date. E logica triggerului
 * `magazie_sincronizeaza_iesire` (migrarea `20261122130000_magazia.sql`), scrisă o dată și aici ca să fie testată
 * și ca formularul de tratament să spună dinainte ce se va scădea.
 *
 * Pe fiecare produs al unei aplicări există cel mult un rând `iesire_tratament`:
 *   - aplicare făcută, cu produs din catalog și cantitate > 0, produs urmărit în magazie, ziua ≥ prima intrare
 *     sau numărătoare, unitate convertibilă → ieșire = −cantitatea, în unitatea produsului;
 *   - altfel rândul vechi se șterge (sau nu se creează). Produsul schimbat → același rând, refolosit.
 */
import { convertesteInStoc, type UnitateStoc } from './unitati'

export interface ProdusAplicare {
  status: string
  produsId: string | null
  cantitate: number | null
  unitate: string | null
  /** Ziua aplicării (`data_aplicata` în ora României, altfel `data_planificata`). */
  zi: string | null
}

export interface ProdusInMagazie {
  unitate: UnitateStoc
  /** Ziua primei intrări sau corecții; `null` = nicio mișcare încă. */
  start: string | null
}

export type MotivFaraIesire = 'nefacut' | 'fara_produs' | 'fara_cantitate' | 'neurmarit' | 'vechi' | 'incompatibil'

export type IesireDorita = { cantitate: number; produsId: string; zi: string } | { cantitate: null; motiv: MotivFaraIesire }

/**
 * Ce ar trebui să fie ieșirea pentru un produs de aplicare. `magazie` = cum e produsul în magazia fermei
 * (`undefined` / `null` = neurmărit: nimic de scăzut).
 */
export function iesireDorita(aplicare: ProdusAplicare, magazie: ProdusInMagazie | null | undefined): IesireDorita {
  if (aplicare.status !== 'aplicata' || !aplicare.zi) return { cantitate: null, motiv: 'nefacut' }
  if (!aplicare.produsId) return { cantitate: null, motiv: 'fara_produs' }
  if (!(Number(aplicare.cantitate) > 0)) return { cantitate: null, motiv: 'fara_cantitate' }
  if (!magazie) return { cantitate: null, motiv: 'neurmarit' }
  // Tratamentele de dinainte de magazie nu scad.
  if (!magazie.start || aplicare.zi < magazie.start) return { cantitate: null, motiv: 'vechi' }
  const cantitate = convertesteInStoc(aplicare.cantitate, aplicare.unitate, magazie.unitate)
  if (cantitate === null || !(cantitate > 0)) return { cantitate: null, motiv: 'incompatibil' }
  return { cantitate, produsId: aplicare.produsId, zi: aplicare.zi }
}

export interface RandIesire {
  produsId: string
  cantitate: number
  zi: string
}

export type ActiuneIesire =
  | { tip: 'nimic' }
  | { tip: 'sterge' }
  | { tip: 'insereaza'; rand: RandIesire }
  | { tip: 'actualizeaza'; rand: RandIesire }

/** Ce face triggerul cu rândul existent (sau lipsă), după cum arată acum aplicarea. */
export function sincronizeazaIesire(existent: RandIesire | null, dorit: IesireDorita): ActiuneIesire {
  if (dorit.cantitate === null) return existent ? { tip: 'sterge' } : { tip: 'nimic' }
  const rand: RandIesire = { produsId: dorit.produsId, cantitate: -dorit.cantitate, zi: dorit.zi }
  if (!existent) return { tip: 'insereaza', rand }
  if (existent.produsId === rand.produsId && existent.cantitate === rand.cantitate && existent.zi === rand.zi) return { tip: 'nimic' }
  return { tip: 'actualizeaza', rand }
}

export const TEXT_MOTIV: Record<MotivFaraIesire, string> = {
  nefacut: 'planificat: nu scade',
  fara_produs: 'produs scris de mână: nu e în magazie',
  fara_cantitate: 'fără cantitate: nu s-a putut scădea',
  neurmarit: 'nu e în magazie',
  vechi: 'dinainte de magazie: nu scade',
  incompatibil: 'altă unitate: nu s-a putut scădea',
}
