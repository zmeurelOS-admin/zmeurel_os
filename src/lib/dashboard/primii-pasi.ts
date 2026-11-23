/**
 * „Primii pași” în Acasă, pentru o fermă reală (promptul 31). Funcții pure, testate.
 *
 * Patru pași care se bifează singuri din date: numele fermei, prima parcelă (de aici știe aplicația cultura),
 * culegătorii și prețul la cultura fermei. Pasul 4 e inactiv până la prima parcelă.
 */
import { esteNumeImplicit } from '@/lib/auth/cont-nou'
import { culturaPrincipala, culturileFermei, numeMic, type ParcelaCuCultura } from '@/lib/parcele/culturi-ferma'

export type CheiePas = 'nume' | 'parcela' | 'culegatori' | 'pret'

export interface PasPrimii {
  cheie: CheiePas
  titlu: string
  detaliu: string
  gata: boolean
  /** Inactiv: apăsat, spune `motivInactiv` în loc să deschidă formularul. */
  inactiv: boolean
  motivInactiv: string | null
  href: string
}

export interface DatePrimiiPasi {
  numeFerma: string | null
  parcele: readonly ParcelaCuCultura[]
  culegatori: number
  /** Prețul standard e pus (oricare dintre cele trei). */
  pretPus: boolean
}

export const RUTE_PRIMII_PASI: Record<CheiePas, string> = {
  nume: '/settings/ferma',
  parcela: '/parcele?nou=1',
  culegatori: '/culegatori?nou=1',
  pret: '/settings/pret-standard',
}

export function pasiPrimii(date: DatePrimiiPasi): PasPrimii[] {
  const culturi = culturileFermei(date.parcele)
  const cultura = culturaPrincipala(culturi)
  const areParcela = culturi.length > 0
  const numeGata = !esteNumeImplicit(date.numeFerma)
  return [
    {
      cheie: 'nume',
      titlu: numeGata ? `Numele fermei: ${String(date.numeFerma).trim()}` : 'Numele fermei',
      detaliu: numeGata ? 'gata' : 'apare pe rapoarte și pe acte',
      gata: numeGata,
      inactiv: false,
      motivInactiv: null,
      href: RUTE_PRIMII_PASI.nume,
    },
    {
      cheie: 'parcela',
      titlu: areParcela ? 'Prima parcelă e pusă' : 'Adaugă prima parcelă',
      detaliu: 'cultura, soiul, suprafața',
      gata: areParcela,
      inactiv: false,
      motivInactiv: null,
      href: RUTE_PRIMII_PASI.parcela,
    },
    {
      cheie: 'culegatori',
      titlu: 'Adaugă culegătorii',
      detaliu: 'ca să notezi kg pe om',
      gata: date.culegatori > 0,
      inactiv: false,
      motivInactiv: null,
      href: RUTE_PRIMII_PASI.culegatori,
    },
    {
      cheie: 'pret',
      titlu: cultura ? `Pune prețul la ${numeMic(cultura)}` : 'Pune prețul',
      detaliu: cultura ? 'pentru comenzi și vânzări' : 'pentru comenzi și vânzări · după prima parcelă',
      gata: areParcela && date.pretPus,
      inactiv: !areParcela,
      motivInactiv: areParcela ? null : 'Întâi adaugă prima parcelă',
      href: RUTE_PRIMII_PASI.pret,
    },
  ]
}

/** Câți pași sunt gata. */
export function pasiGata(pasi: readonly PasPrimii[]): number {
  return pasi.filter((pas) => pas.gata).length
}

/** Cardul se vede cât nu sunt toți pașii gata și omul nu l-a ascuns. */
export function aratamPrimiiPasi(pasi: readonly PasPrimii[], ascuns: boolean): boolean {
  return !ascuns && pasiGata(pasi) < pasi.length
}

/** Cheia din `localStorage` pentru „Ascunde” (pe utilizator; fără migrare). */
export function cheieAscundePrimiiPasi(userId: string | null | undefined): string {
  return `zmeurel:primii-pasi-ascuns:${userId ?? 'anonim'}`
}
