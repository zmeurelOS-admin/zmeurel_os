/**
 * Plata la livrare: Cash / Transfer / Nu a plătit și suma primită. Aceeași regulă pentru livrarea
 * obișnuită și pentru „Livrează și copiază”. Funcție pură.
 *
 * - suma = totalul (sau fără bani de încasat): încasat tot (`platit`);
 * - mai puțin decât totalul: avans — vânzarea rămâne neîncasată (`neplatit`), iar suma se adună ca plată;
 * - „Nu a plătit”: neîncasat, fără avans.
 */
import { round2 } from '@/lib/format-ro'

export type PlataLivrare = 'cash' | 'transfer' | 'neplatit'

export interface PlataLaLivrare {
  sumaValid: boolean
  receivedLei: number
  paidInFull: boolean
  statusPlata: 'platit' | 'neplatit'
  /** Suma de adunat ca plată parțială (0 dacă a plătit tot sau nimic). */
  avansLei: number
}

export function plataLaLivrare(input: {
  expectedLei: number
  payment: PlataLivrare
  parsedSuma: number | null
  zeroPrice: boolean
}): PlataLaLivrare {
  const { expectedLei, payment, parsedSuma, zeroPrice } = input
  const sumaValid = payment === 'neplatit' || zeroPrice || (parsedSuma !== null && parsedSuma >= 0 && parsedSuma <= expectedLei)
  const receivedLei = payment === 'neplatit' || zeroPrice ? 0 : round2(parsedSuma ?? 0)
  const paidInFull = zeroPrice || (payment !== 'neplatit' && receivedLei >= expectedLei)
  return {
    sumaValid,
    receivedLei,
    paidInFull,
    statusPlata: paidInFull ? 'platit' : 'neplatit',
    avansLei: !paidInFull && receivedLei > 0 ? receivedLei : 0,
  }
}
