'use client'

import { useQuery } from '@tanstack/react-query'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { getSupabase } from '@/lib/supabase/client'

/**
 * Are ferma un loc pentru vreme? (promptul 33): locul din Setări › Ferma (`tenant_settings`), altfel coordonatele
 * unei parcele. Fără niciunul, Acasă arată „Pune locul fermei ca să vezi vremea ta” și nu cere vremea (nicio locație
 * implicită tăcută). `null` = încă nu știm.
 */
export function useLocFerma(): { areLoc: boolean | null } {
  const { tenantId } = useDashboardAuth()
  const query = useQuery({
    queryKey: ['loc-ferma', tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const supabase = getSupabase()
      const setari = await supabase
        .from('tenant_settings')
        .select('latitudine_default,longitudine_default')
        .eq('tenant_id', tenantId as string)
        .maybeSingle()
      if (!setari.error && setari.data?.latitudine_default != null && setari.data?.longitudine_default != null) return true
      const parcela = await supabase
        .from('parcele')
        .select('id')
        .eq('tenant_id', tenantId as string)
        .not('latitudine', 'is', null)
        .not('longitudine', 'is', null)
        .limit(1)
      if (parcela.error) throw parcela.error
      return (parcela.data ?? []).length > 0
    },
  })
  return { areLoc: query.data ?? null }
}
