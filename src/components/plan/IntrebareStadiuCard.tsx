'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button, Notice } from '@/components/kit'
import type { IntrebareStadiu } from '@/lib/plan'
import { queryKeys } from '@/lib/query-keys'
import { createParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { toast } from '@/lib/ui/toast'

/**
 * „A început înflorirea?” (pe fișa parcelei și în tab-ul Plan). „Da, de azi” notează stadiul următor cu ziua de azi
 * (ca „Actualizează stadiul” de pe fișă); „Încă nu” amână întrebarea câteva zile. Stadiul îl schimbă omul.
 */
export function IntrebareStadiuCard({
  intrebare,
  numeParcela,
  azi,
  poateScrie,
  onAmana,
}: {
  intrebare: IntrebareStadiu
  /** `null` pe fișa parcelei (se știe parcela). */
  numeParcela: string | null
  azi: string
  poateScrie: boolean
  onAmana: (cheie: string) => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const an = Number(azi.slice(0, 4))

  const da = async () => {
    if (busy) return
    setBusy(true)
    try {
      await createParcelaStadiuCanonic({ parcela_id: intrebare.parcelaId, an, stadiu: intrebare.urmator, cohort: intrebare.cohort, data_observata: azi })
      await queryClient.invalidateQueries({ queryKey: queryKeys.stadiiFerma(an) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(intrebare.parcelaId) })
      toast.success('Stadiul s-a schimbat de azi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast.error(/row-level security|42501/i.test(message) ? 'Nu ai drept de scriere pe parcele.' : message || 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Notice
      tone="info"
      title={numeParcela ? `${numeParcela}: ${intrebare.intrebare}` : intrebare.intrebare}
      action={
        <div className="mt-1 grid grid-cols-2 gap-2">
          {poateScrie ? (
            <Button type="button" variant="primary" size="touch" className="w-full" loading={busy} onClick={() => void da()}>
              Da, de azi
            </Button>
          ) : null}
          <Button type="button" variant="neutral" size="touch" className={poateScrie ? 'w-full' : 'col-span-2 w-full'} disabled={busy} onClick={() => onAmana(intrebare.cheie)}>
            Încă nu
          </Button>
        </div>
      }
    >
      Anul trecut s-a întâmplat pe la data asta. Stadiul îl schimbi tu; planul îți arată apoi ce urmează.
    </Notice>
  )
}
