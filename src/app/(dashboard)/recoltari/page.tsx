// src/app/(dashboard)/recoltari/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { RecoltariPageClient } from './RecoltariPageClient';

export default async function RecoltariPage() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Autentificare necesară</div>;
  }

  // Get tenant ID pentru user
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (!tenants) {
    return <div>Tenant nu a fost găsit</div>;
  }

  const tenantId = tenants.id;

  // Fetch recoltări inițial (pentru SSR)
  const { data: recoltari = [] } = await supabase
    .from('recoltari')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  // Fetch culegători pentru mapping (nume + tarif)
  const { data: culegatori = [] } = await supabase
    .from('culegatori')
    .select('id, id_culegator, nume_prenume, tarif_lei_kg')
    .eq('tenant_id', tenantId);

  // Fetch parcele pentru mapping (nume parcele)
  const { data: parcele = [] } = await supabase
    .from('parcele')
    .select('id, id_parcela, nume_parcela')
    .eq('tenant_id', tenantId);

  return (
    <RecoltariPageClient
      initialRecoltari={recoltari || []}
      culegatori={culegatori || []}
      parcele={parcele || []}
      tenantId={tenantId}
    />
  );
}
