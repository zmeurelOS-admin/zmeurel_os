import {
  Banknote,
  Building2,
  Droplets,
  FlaskConical,
  Fuel,
  Grid3x3,
  Package,
  Receipt,
  Sprout,
  Tractor,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import {
  resolveCheltuialaCategorie,
  resolveInvestitieCategorie,
  type CategorieCheltuiala,
  type CategorieInvestitie,
} from '@/lib/financial/categories'

const CHELTUIELI_ICONS: Record<CategorieCheltuiala, LucideIcon> = {
  Îngrășăminte: Sprout,
  Tratamente: FlaskConical,
  Manoperă: Users,
  Ambalaje: Package,
  'Motorină și curent': Fuel,
  'Reparații și consumabile': Wrench,
  'Taxe și servicii': Receipt,
  Altele: Banknote,
}

const INVESTITII_ICONS: Record<CategorieInvestitie, LucideIcon> = {
  Plantație: Sprout,
  Irigație: Droplets,
  'Spalier și plase': Grid3x3,
  'Utilaje și unelte': Tractor,
  'Construcții și depozitare': Building2,
  Altele: Banknote,
}

/** Iconița unei categorii (nume nou, vechi sau text liber: trece prin aceeași mapare ca afișarea). */
export function CategorieIcon({ kind, categorie }: { kind: 'cheltuiala' | 'investitie'; categorie: string | null | undefined }) {
  const Icon =
    kind === 'investitie'
      ? INVESTITII_ICONS[resolveInvestitieCategorie(categorie)]
      : CHELTUIELI_ICONS[resolveCheltuialaCategorie(categorie)]
  return <Icon aria-hidden />
}
