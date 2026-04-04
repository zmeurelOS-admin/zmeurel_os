/**
 * Paletă pastel + emoji pentru carduri catalog magazin asociație.
 * Matching case-insensitive, fără diacritice.
 */

export type GustCategoryVisual = { bg: string; emoji: string }

const DEFAULT_VISUAL: GustCategoryVisual = { bg: '#e0f2f1', emoji: '🌿' }

/** Elimină diacritice + lowercase (Unicode-safe). */
export function normalizeCategoryForMatch(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Rezolvă fundal + emoji după valoarea `produse.categorie` (sau etichetă afișată).
 */
export function getGustCategoryVisual(categorie: string): GustCategoryVisual {
  const n = normalizeCategoryForMatch(categorie)

  if (n.includes('fruct')) {
    return { bg: '#fce4ec', emoji: '🍓' }
  }
  if (n.includes('lactat') || n.includes('lapte') || n.includes('branza') || n.includes('cas')) {
    return { bg: '#fff8e1', emoji: '🧀' }
  }
  if (n.includes('carne') || (n.includes('preparate') && n.includes('carne'))) {
    return { bg: '#fbe9e7', emoji: '🥩' }
  }
  if (n.includes('apic') || n.includes('miere') || n.includes('apicol')) {
    return { bg: '#fff3e0', emoji: '🍯' }
  }
  if (n.includes('panific') || n.includes('paine') || n.includes('pâine')) {
    return { bg: '#efebe9', emoji: '🍞' }
  }
  if (n.includes('conserv')) {
    return { bg: '#e8f5e9', emoji: '🫙' }
  }
  if (n.includes('legum')) {
    return { bg: '#e8f5e9', emoji: '🥬' }
  }

  return DEFAULT_VISUAL
}
