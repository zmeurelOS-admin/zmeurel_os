// src/app/(dashboard)/vanzari-butasi/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { VanzariButasiPageClient } from './VanzariButasiPageClient';

export default async function VanzariButasiPage() {
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

  // Fetch vânzări butași inițial (pentru SSR)
  const { data: vanzariButasi = [] } = await supabase
    .from('vanzari_butasi')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  // Fetch clienti pentru mapping (nume clienti)
  const { data: clienti = [] } = await supabase
    .from('clienti')
    .select('id, id_client, nume_client')
    .eq('tenant_id', tenantId);

  // Fetch parcele pentru mapping (nume parcele)
  const { data: parcele = [] } = await supabase
    .from('parcele')
    .select('id, id_parcela, nume_parcela')
    .eq('tenant_id', tenantId);

  return (
    <VanzariButasiPageClient
      initialVanzari={vanzariButasi || []}
      clienti={clienti || []}
      parcele={parcele || []}
      tenantId={tenantId}
    />
  );
}
