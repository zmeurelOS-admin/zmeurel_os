'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { Button, Notice } from '@/components/kit'
import { capcaneDeVerificat, textAtractant, titluVerificare } from '@/lib/capcane'
import { queryKeys } from '@/lib/query-keys'
import { CapcaneIndisponibileError, getCapcane } from '@/lib/supabase/queries/capcane'
import { getParcele } from '@/lib/supabase/queries/parcele'

/**
 * Acasă: „Verificare azi · N capcane”, în ziua verificării și după, până se face (același calcul ca mementoul de
 * dimineață). Fără migrare sau fără nimic de verificat: nimic.
 */
export function MementoCapcaneAcasa({ azi }: { azi: string | null }) {
  const router = useRouter()
  const dateQuery = useQuery({
    queryKey: queryKeys.capcaneDate,
    queryFn: getCapcane,
    staleTime: 30_000,
    enabled: Boolean(azi),
    retry: (n, error) => !(error instanceof CapcaneIndisponibileError) && n < 1,
  })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, enabled: Boolean(azi) })

  const deVerificat = useMemo(() => (azi && dateQuery.data ? capcaneDeVerificat(dateQuery.data.grupuri, azi) : null), [azi, dateQuery.data])
  if (!azi || !deVerificat || deVerificat.capcane === 0) return null

  const nume = new Map((parceleQuery.data ?? []).map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă']))
  const parcele = [...new Set(deVerificat.grupuri.map((grup) => nume.get(grup.parcela_id) ?? 'Parcelă'))]
  const text = `${parcele.slice(0, 3).join(', ')}${parcele.length > 3 ? ` și încă ${parcele.length - 3}` : ''}.${textAtractant(deVerificat.atractant) ? ` ${textAtractant(deVerificat.atractant)}` : ''}`

  return (
    <Notice
      tone="warning"
      title={titluVerificare(deVerificat.capcane)}
      action={
        <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => router.push('/tratamente?tab=capcane&verifica=1')}>
          Verifică acum
        </Button>
      }
    >
      {text}
    </Notice>
  )
}
