// src/app/(dashboard)/investitii/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { InvestitiiPageClient } from './InvestitiiPageClient';

export default async function InvestitiiPage() {
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

  // Get tenant ID
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (!tenants) {
    return <div>Tenant nu a fost găsit</div>;
  }

  const tenantId = tenants.id;

  // Fetch investitii
  const { data: investitii = [] } = await supabase
    .from('investitii')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  // Fetch parcele pentru dropdown
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
