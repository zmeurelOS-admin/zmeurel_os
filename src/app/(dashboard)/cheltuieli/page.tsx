import { createClient } from '@/lib/supabase/server'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import type { Investitie } from '@/lib/supabase/queries/investitii'

import { CheltuieliPageClient } from './CheltuieliPageClient'

type SearchParams = Record<string, string | string[] | undefined>

/** Cheltuieli și Investiții, pe aceeași pagină: `?fila=investitii` deschide a doua filă. */
export default async function CheltuieliPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  const [cheltuieliResult, investitiiResult, parceleResult] = await Promise.all([
    supabase
      .from('cheltuieli_diverse')
      .select(
        'id,id_cheltuiala,client_sync_id,data,categorie,descriere,suma_lei,furnizor,document_url,sync_status,conflict_flag,created_by,updated_by,created_at,updated_at,tenant_id',
      )
      .order('data', { ascending: false }),
    supabase
      .from('investitii')
      .select('id,id_investitie,data,parcela_id,categorie,furnizor,descriere,document_url,suma_lei,created_at,updated_at,tenant_id')
      .order('data', { ascending: false }),
    supabase.from('parcele').select('id, nume_parcela').order('created_at', { ascending: false }),
  ])

  return (
    <CheltuieliPageClient
      initialCheltuieli={(cheltuieliResult.data ?? []) as unknown as Cheltuiala[]}
      initialInvestitii={(investitiiResult.data ?? []) as unknown as Investitie[]}
      parcele={parceleResult.data ?? []}
      initialTab={params.fila === 'investitii' ? 'investitii' : 'cheltuieli'}
    />
  )
}
