'use client'

import { usePlan } from '@/lib/plan/usePlan'

import { IntrebareStadiuCard } from './IntrebareStadiuCard'

/**
 * Pe fișa parcelei: „A început înflorirea?” când se apropie ziua în care parcela a intrat în stadiul următor anul
 * trecut (sau după culesul estimat). Aceleași date și aceeași regulă ca în tab-ul Plan; nimic dacă nu e întrebare.
 */
export function IntrebareStadiuParcela({ parcelaId, azi, poateScrie }: { parcelaId: string; azi: string; poateScrie: boolean }) {
  const plan = usePlan(azi)
  const intrebari = plan.intrebari([parcelaId])
  if (intrebari.length === 0) return null
  return (
    <div className="space-y-2">
      {intrebari.map((intrebare) => (
        <IntrebareStadiuCard key={intrebare.cheie} intrebare={intrebare} numeParcela={null} azi={azi} poateScrie={poateScrie} onAmana={plan.amana} />
      ))}
    </div>
  )
}
