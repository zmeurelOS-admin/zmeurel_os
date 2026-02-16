// src/app/(dashboard)/vanzari/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { VanzariPageClient } from './VanzariPageClient';

export default async function VanzariPage() {
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

  // Fetch vânzări inițial (pentru SSR)
  const { data: vanzari = [] } = await supabase
    .from('vanzari')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  // Fetch clienti pentru mapping (nume clienti)
  const { data: clienti = [] } = await supabase
    .from('clienti')
    .select('id, id_client, nume_client')
    .eq('tenant_id', tenantId);

  return (
    <VanzariPageClient
      initialVanzari={vanzari || []}
      clienti={clienti || []}
      tenantId={tenantId}
    />
  );
}
