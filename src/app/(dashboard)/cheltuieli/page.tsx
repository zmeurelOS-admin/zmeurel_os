import { createClient } from '@/lib/supabase/server'
import { CheltuialaPageClient } from './CheltuialaPageClient'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'

export default async function CheltuieliPage() {
  const supabase = await createClient()

  const { data: cheltuieli, error } = await supabase
    .from('cheltuieli_diverse')
    .select(
      'id,id_cheltuiala,client_sync_id,data,categorie,descriere,suma_lei,furnizor,document_url,sync_status,conflict_flag,created_by,updated_by,created_at,updated_at,tenant_id'
    )
    .order('data', { ascending: false })

  if (error) {
    console.error('Failed loading cheltuieli_diverse for cheltuieli page:', error)
  }

  return <CheltuialaPageClient initialCheltuieli={(cheltuieli ?? []) as unknown as Cheltuiala[]} />
}
