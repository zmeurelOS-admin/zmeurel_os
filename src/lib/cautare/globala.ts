/**
 * Căutarea globală de pe desktop (promptul 35, §2): caută în comenzi, clienți, parcele, culegători și în paginile din
 * meniu, din datele deja încărcate (fără căutare pe server). Pur, testat.
 */
import { isPathAllowedForAccess } from '@/lib/farm-members/access'
import { intrariMeniuDesktop, meniuDesktop, vedeBanii, type ContextMeniu } from '@/lib/navigatie/meniu'

export type GrupCautare = 'pagini' | 'comenzi' | 'clienti' | 'parcele' | 'culegatori'

export const TITLU_GRUP: Record<GrupCautare, string> = {
  pagini: 'Pagini',
  comenzi: 'Comenzi',
  clienti: 'Clienți',
  parcele: 'Parcele',
  culegatori: 'Culegători',
}

export const ORDINE_GRUPURI: readonly GrupCautare[] = ['pagini', 'comenzi', 'clienti', 'parcele', 'culegatori']

/** Câte rezultate pe grup. */
export const PE_GRUP = 5

export interface ElementCautare {
  id: string
  titlu: string
  detaliu?: string
  href: string
  /** Textele în care se caută (numele întâi). */
  texte: ReadonlyArray<string | null | undefined>
  /** Telefoanele (se caută după cifre). */
  telefoane?: ReadonlyArray<string | null | undefined>
}

export interface RezultatCautare extends Omit<ElementCautare, 'texte' | 'telefoane'> {
  grup: GrupCautare
  scor: number
}

/** Fără diacritice, fără majuscule, spațiile strânse. */
export function normalizeaza(text: string | null | undefined): string {
  return String(text ?? '')
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const cifre = (text: string | null | undefined) => String(text ?? '').replace(/\D/g, '')

/**
 * Scorul unui element pentru întrebare: 3 = un cuvânt începe cu întrebarea (în primul text, numele), 2 = un cuvânt
 * din alt text începe cu ea, 1 = apare oriunde, 1 și pentru telefon (cel puțin 3 cifre); 0 = nu se potrivește.
 */
export function scor(element: Pick<ElementCautare, 'texte' | 'telefoane'>, intrebare: string): number {
  const q = normalizeaza(intrebare)
  if (!q) return 0
  let best = 0
  element.texte.forEach((text, index) => {
    const t = normalizeaza(text)
    if (!t) return
    if (t.startsWith(q) || t.includes(` ${q}`)) best = Math.max(best, index === 0 ? 3 : 2)
    else if (t.includes(q)) best = Math.max(best, 1)
  })
  const q9 = cifre(intrebare).replace(/^0+/, '')
  if (best === 0 && q9.length >= 3 && /^[\d\s+()-]+$/.test(intrebare.trim())) {
    if ((element.telefoane ?? []).some((telefon) => cifre(telefon).includes(q9))) best = 1
  }
  return best
}

/** Rezultatele unui grup, cele mai bune primele, cel mult `PE_GRUP`. */
export function cautaInGrup(grup: GrupCautare, elemente: readonly ElementCautare[], intrebare: string, limita = PE_GRUP): RezultatCautare[] {
  return elemente
    .map((element) => ({ element, scor: scor(element, intrebare) }))
    .filter((item) => item.scor > 0)
    .sort((a, b) => b.scor - a.scor || a.element.titlu.localeCompare(b.element.titlu, 'ro'))
    .slice(0, limita)
    .map(({ element, scor: valoare }) => ({ id: element.id, titlu: element.titlu, detaliu: element.detaliu, href: element.href, grup, scor: valoare }))
}

/** Ce grupuri de date are voie să caute utilizatorul (operatorul: doar modulele lui). Paginile, mereu. */
export function grupuriPermise(ctx: ContextMeniu): Record<GrupCautare, boolean> {
  const operator = ctx.memberRole === 'operator'
  const poate = (href: string) => !operator || isPathAllowedForAccess(href, ctx.memberAccess ?? [])
  return {
    pagini: true,
    comenzi: poate('/comenzi'),
    clienti: poate('/clienti'),
    parcele: !operator || (ctx.memberAccess ?? []).some((item) => item.module === 'parcele'),
    culegatori: poate('/culegatori'),
  }
}

/** Paginile în care se poate sări: intrările vizibile din bara laterală + câteva sub-pagini des folosite. */
export function paginiCautare(ctx: ContextMeniu): ElementCautare[] {
  const meniu = meniuDesktop(ctx)
  const intrari = intrariMeniuDesktop(meniu).filter((intrare) => !intrare.extern)
  const hrefuri = new Set(intrari.map((intrare) => intrare.href))
  const pagini: ElementCautare[] = intrari.map((intrare) => ({ id: intrare.href, titlu: intrare.label, href: intrare.href, texte: [intrare.label] }))
  const adauga = (id: string, titlu: string, href: string, cuvinte: string[] = []) => pagini.push({ id, titlu, href, texte: [titlu, ...cuvinte] })
  if (hrefuri.has('/tratamente')) {
    adauga('/tratamente/magazie', 'Magazia', '/tratamente/magazie', ['stoc produse tratament'])
    adauga('/tratamente?tab=plan', 'Planul pe stadii', '/tratamente?tab=plan')
    adauga('/tratamente?tab=capcane', 'Capcane', '/tratamente?tab=capcane')
    adauga('/tratamente?tab=analize', 'Analize la fructe', '/tratamente?tab=analize')
  }
  if (hrefuri.has('/comenzi')) adauga('/livrari', 'Livrări azi', '/livrari', ['traseu'])
  if (vedeBanii(ctx)) {
    adauga('/rapoarte#registre', 'Registrul de tratamente', '/rapoarte#registre', ['ansvsa export'])
    adauga('/settings/echipa', 'Setări › Echipa', '/settings/echipa', ['operatori invită'])
    adauga('/settings/ferma', 'Setări › Ferma', '/settings/ferma', ['numele fermei localitate'])
    adauga('/settings/ferma/acte', 'Actele fermei', '/settings/ferma/acte', ['atestat producător documente'])
  }
  adauga('/notificari', 'Notificări', '/notificari')
  return pagini
}

export interface GrupRezultate {
  grup: GrupCautare
  titlu: string
  rezultate: RezultatCautare[]
}

/** Toate rezultatele, pe grupuri, în ordinea fixă; grupurile interzise sau goale lipsesc. */
export function cautaGlobal(
  intrebare: string,
  surse: Partial<Record<GrupCautare, readonly ElementCautare[]>>,
  permise: Record<GrupCautare, boolean>,
): GrupRezultate[] {
  if (!normalizeaza(intrebare)) return []
  return ORDINE_GRUPURI.filter((grup) => permise[grup])
    .map((grup) => ({ grup, titlu: TITLU_GRUP[grup], rezultate: cautaInGrup(grup, surse[grup] ?? [], intrebare) }))
    .filter((item) => item.rezultate.length > 0)
}
