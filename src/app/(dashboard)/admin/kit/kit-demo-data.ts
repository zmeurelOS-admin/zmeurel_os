/** Date de exemplu pentru pagina kitului. Nimic din baza de date. */

export interface KitTocEntry {
  id: string
  title: string
}

export const PRIMITIVE_TOC: KitTocEntry[] = [
  { id: 'butoane', title: 'Butoane' },
  { id: 'placi', title: 'Plăci (Tile)' },
  { id: 'segmente', title: 'Segmente' },
  { id: 'filtre', title: 'Filtre pastilă' },
  { id: 'cifre', title: 'Cifre' },
  { id: 'status', title: 'Pastilă de status' },
  { id: 'gol', title: 'Stare goală' },
  { id: 'campuri', title: 'Câmp mare' },
  { id: 'randuri', title: 'Rând de listă' },
  { id: 'comutator', title: 'Rând cu comutator' },
  { id: 'bifa', title: 'Rând bifabil' },
  { id: 'benzi', title: 'Bandă de mesaj' },
  { id: 'progres', title: 'Bară de progres' },
  { id: 'card', title: 'Card cu acțiune' },
  { id: 'exemple', title: 'Exemple din mockup-uri' },
]

export interface DemoCulegator {
  id: string
  prenume: string
  nume: string
  /** Kilograme notate deja azi. */
  kgAzi?: number
}

export const DEMO_CULEGATORI: DemoCulegator[] = [
  { id: 'ana', prenume: 'Ana', nume: 'Lungu', kgAzi: 35 },
  { id: 'vasile', prenume: 'Vasile', nume: 'Rotaru' },
  { id: 'maria', prenume: 'Maria', nume: 'Onofrei', kgAzi: 27.35 },
  { id: 'ion', prenume: 'Ion', nume: 'Ursu' },
  { id: 'elena', prenume: 'Elena', nume: 'Cozma' },
]

export interface DemoComanda {
  id: string
  client: string
  localitate: string
  kg: number
  prioritara?: boolean
}

export const DEMO_COMENZI_AZI: DemoComanda[] = [
  { id: 'c1', client: 'Patiseria Bucovina', localitate: 'Suceava', kg: 12, prioritara: true },
  { id: 'c2', client: 'Maria Ionescu', localitate: 'Fălticeni', kg: 9, prioritara: true },
  { id: 'c3', client: 'Ion Popescu', localitate: 'Gura Humorului', kg: 5 },
  { id: 'c4', client: 'Cofetăria Aroma', localitate: 'Suceava', kg: 8 },
]

/** Disponibilul de calitatea 1 din exemplul „Pune în livrare azi”. */
export const DEMO_STOC_KG = 30

export const formatKg = (value: number) =>
  `${value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} kg`

export const formatLei = (value: number) => `${Math.round(value).toLocaleString('ro-RO')} lei`
