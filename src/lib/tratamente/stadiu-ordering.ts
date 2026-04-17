export const STADII_ORDINE: Record<string, { ordine: number; label: string }> = {
  repaus: { ordine: 10, label: 'Repaus vegetativ' },
  umflare_muguri: { ordine: 20, label: 'Umflare muguri' },
  buton_verde: { ordine: 30, label: 'Buton verde' },
  buton_roz: { ordine: 40, label: 'Buton roz' },
  inflorit: { ordine: 50, label: 'Înflorit' },
  scuturare_petale: { ordine: 60, label: 'Scuturare petale' },
  fruct_verde: { ordine: 70, label: 'Fruct verde' },
  parga: { ordine: 80, label: 'Pârgă' },
  maturitate: { ordine: 90, label: 'Maturitate' },
  post_recoltare: { ordine: 100, label: 'Post-recoltare' },
}

const STADII_SORTATE = Object.entries(STADII_ORDINE).sort(
  (a, b) => a[1].ordine - b[1].ordine
)

/**
 * Returnează ordinea logică a unui stadiu fenologic; stadiile necunoscute cad la final.
 * Exemplu: `getStadiuOrdine('inflorit')`
 */
export function getStadiuOrdine(stadiu: string): number {
  return STADII_ORDINE[stadiu]?.ordine ?? Number.MAX_SAFE_INTEGER
}

/**
 * Returnează codul stadiului următor din secvența canonică.
 * Exemplu: `getStadiulUrmator('buton_verde')`
 */
export function getStadiulUrmator(stadiu: string): string | null {
  const currentIndex = STADII_SORTATE.findIndex(([key]) => key === stadiu)
  if (currentIndex === -1 || currentIndex === STADII_SORTATE.length - 1) {
    return null
  }

  return STADII_SORTATE[currentIndex + 1]?.[0] ?? null
}
