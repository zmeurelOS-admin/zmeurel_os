// src/app/(dashboard)/investitii/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { InvestitiiPageClient } from './InvestitiiPageClient';

export default async function InvestitiiPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

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

  // Fetch investiții inițial (pentru SSR)
  const { data: investitii = [] } = await supabase
    .from('investitii')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  // Fetch parcele pentru mapping (nume parcele)
  const { data: parcele = [] } = await supabase
    .from('parcele')
    .select('id, id_parcela, nume_parcela')
    .eq('tenant_id', tenantId);

  return (
    <InvestitiiPageClient
      initialInvestitii={investitii || []}
      parcele={parcele || []}
      tenantId={tenantId}
    />
  );
}
