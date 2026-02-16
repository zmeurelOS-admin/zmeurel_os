// src/app/(dashboard)/cheltuieli/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CheltuialaPageClient } from './CheltuialaPageClient';

export default async function CheltuieliPage() {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Autentificare necesară</div>;
  }

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (!tenants) {
    return <div>Tenant nu a fost găsit</div>;
  }

  const tenantId = tenants.id;

  const { data: cheltuieli = [] } = await supabase
    .from('cheltuieli_diverse')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  return (
    <CheltuialaPageClient
      initialCheltuieli={cheltuieli || []}
      tenantId={tenantId}
    />
  );
}
