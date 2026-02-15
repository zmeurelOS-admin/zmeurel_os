// src/app/(dashboard)/activitati-agricole/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ActivitatiAgricolePageClient } from './ActivitatiAgricolePageClient';

export default async function ActivitatiAgricolePage() {
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

  // Fetch activități inițial (pentru SSR)
  const { data: activitati = [] } = await supabase
    .from('activitati_agricole')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data_aplicare', { ascending: false });

  // Fetch parcele pentru mapping (nume parcele)
  const { data: parcele = [] } = await supabase
    .from('parcele')
    .select('id, id_parcela, nume_parcela')
    .eq('tenant_id', tenantId);

  return (
    <ActivitatiAgricolePageClient
      initialActivitati={activitati || []}
      parcele={parcele || []}
      tenantId={tenantId}
    />
  );
}
