import { createClient } from '@/lib/supabase/server';
import { CheltuialaPageClient } from './CheltuialaPageClient';
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli';

export default async function CheltuieliPage() {
  const supabase = await createClient();

  // RLS handles tenant isolation automatically
  const { data: cheltuieli, error } = await supabase
    .from('cheltuieli_diverse')
    .select('id,id_cheltuiala,client_sync_id,data,categorie,descriere,suma_lei,furnizor,document_url,sync_status,conflict_flag,created_by,updated_by,created_at,updated_at,tenant_id')
    .order('data', { ascending: false });

  // Nu aruncăm UI changes; doar protejăm de undefined
  if (error) {
    // Poți loga în server logs dacă vrei
    // console.error(error);
  }

  return <CheltuialaPageClient initialCheltuieli={(cheltuieli ?? []) as unknown as Cheltuiala[]} />;
}

