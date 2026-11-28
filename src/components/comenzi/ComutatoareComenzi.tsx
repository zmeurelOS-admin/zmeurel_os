'use client'

import { useRouter } from 'next/navigation'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { OPTIUNI_VEDERE, Segments } from '@/components/kit'
import { comenziSiLivrari } from '@/lib/navigatie/meniu'
import type { VedereModul } from '@/lib/ui/useIdDinUrl'

/** „Comenzi · Livrări azi” în antetul de desktop (promptul 35, §1), doar când ambele pagini sunt permise. */
export function ComutatorComenziLivrari({ activ }: { activ: 'comenzi' | 'livrari' }) {
  const router = useRouter()
  const { memberRole, memberAccess, isSuperAdmin, associationRole } = useDashboardAuth()
  if (!comenziSiLivrari({ memberRole, memberAccess, isSuperAdmin, associationRole })) return null
  return (
    <Segments<'comenzi' | 'livrari'>
      aria-label="Comenzi sau livrările de azi"
      value={activ}
      onValueChange={(next) => router.push(next === 'comenzi' ? '/comenzi' : '/livrari')}
      options={[
        { value: 'comenzi', label: 'Comenzi' },
        { value: 'livrari', label: 'Livrări azi' },
      ]}
      className="w-[240px]"
    />
  )
}

/** Comutatorul „Listă / Tabel” din antetul de desktop. */
export function ComutatorVedere({ vedere, onVedere }: { vedere: VedereModul; onVedere: (vedere: VedereModul) => void }) {
  return <Segments<VedereModul> aria-label="Cum arăt lista" value={vedere} onValueChange={onVedere} options={OPTIUNI_VEDERE} className="w-[180px]" />
}
