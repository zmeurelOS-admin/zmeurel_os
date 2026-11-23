/**
 * „Demo gata”: intrăm în Acasă doar când datele demo se văd cu adevărat (promptul 31). Funcții pure, testate.
 *
 * Verificarea e o interogare reală (câte parcele, recoltări și comenzi vede utilizatorul în ferma lui), repetată
 * până trec pragurile tipului de demo sau până expiră timpul. Cititorul și ceasul se dau din afară (teste).
 */
export type TipDemo = 'berries' | 'solar'

export const TIPURI_DEMO: readonly TipDemo[] = ['berries', 'solar']

export function esteTipDemo(value: unknown): value is TipDemo {
  return value === 'berries' || value === 'solar'
}

export interface NumaratoareDemo {
  parcele: number
  recoltari: number
  comenzi: number
}

/** Câte rânduri pune seed-ul (`demo-seed-service`): Fructe de pădure 6 / 15 / 12, Solarii 5 / 12 / 12. */
export const PRAGURI_DEMO: Record<TipDemo, NumaratoareDemo> = {
  berries: { parcele: 6, recoltari: 15, comenzi: 12 },
  solar: { parcele: 5, recoltari: 12, comenzi: 12 },
}

export type PasDemo = 'cont' | 'date' | 'parcele' | 'recoltari' | 'comenzi'

export const PASI_DEMO: readonly { pas: PasDemo; text: string }[] = [
  { pas: 'cont', text: 'Contul demo' },
  { pas: 'date', text: 'Datele fermei' },
  { pas: 'parcele', text: 'Parcele' },
  { pas: 'recoltari', text: 'Recoltări' },
  { pas: 'comenzi', text: 'Comenzi' },
]

/** Ce lipsește încă (în ordinea pașilor); gol = gata. */
export function lipsaDemo(numaratoare: NumaratoareDemo, tip: TipDemo): Array<keyof NumaratoareDemo> {
  const prag = PRAGURI_DEMO[tip]
  return (['parcele', 'recoltari', 'comenzi'] as const).filter((cheie) => numaratoare[cheie] < prag[cheie])
}

export function demoGata(numaratoare: NumaratoareDemo, tip: TipDemo): boolean {
  return lipsaDemo(numaratoare, tip).length === 0
}

/** Pașii bifați după ultima numărătoare: parcelele, recoltările și comenzile se bifează pe rând, fiecare la pragul lui. */
export function pasiVerificati(numaratoare: NumaratoareDemo | null, tip: TipDemo): Set<PasDemo> {
  const bifati = new Set<PasDemo>()
  if (!numaratoare) return bifati
  const prag = PRAGURI_DEMO[tip]
  for (const cheie of ['parcele', 'recoltari', 'comenzi'] as const) {
    if (numaratoare[cheie] < prag[cheie]) break
    bifati.add(cheie)
  }
  return bifati
}

export type RezultatAsteptare =
  | { ok: true; numaratoare: NumaratoareDemo; incercari: number }
  | { ok: false; motiv: 'timp' | 'eroare'; numaratoare: NumaratoareDemo | null; incercari: number; eroare?: string }

/**
 * Citește numărătoarea până e gata. Se oprește la `limitaMs` (implicit 20 s). O eroare de citire se reîncearcă;
 * dacă toate dau eroare, rezultatul spune `eroare`, altfel `timp`.
 */
export async function asteaptaDemoGata(options: {
  tip: TipDemo
  citeste: () => Promise<NumaratoareDemo>
  laFiecare?: (numaratoare: NumaratoareDemo) => void
  limitaMs?: number
  pauzaMs?: number
  acum?: () => number
  asteapta?: (ms: number) => Promise<void>
}): Promise<RezultatAsteptare> {
  const { tip, citeste, laFiecare, limitaMs = 20_000, pauzaMs = 800 } = options
  const acum = options.acum ?? (() => Date.now())
  const asteapta = options.asteapta ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const start = acum()
  let ultima: NumaratoareDemo | null = null
  let ultimaEroare: string | undefined
  let incercari = 0

  for (;;) {
    incercari += 1
    try {
      ultima = await citeste()
      ultimaEroare = undefined
      laFiecare?.(ultima)
      if (demoGata(ultima, tip)) return { ok: true, numaratoare: ultima, incercari }
    } catch (cause) {
      ultimaEroare = cause instanceof Error ? cause.message : String(cause)
    }
    if (acum() - start + pauzaMs > limitaMs) {
      return ultima === null && ultimaEroare
        ? { ok: false, motiv: 'eroare', numaratoare: null, incercari, eroare: ultimaEroare }
        : { ok: false, motiv: 'timp', numaratoare: ultima, incercari }
    }
    await asteapta(pauzaMs)
  }
}
