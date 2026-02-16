// src/app/(dashboard)/clienti/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getClienti } from '@/lib/supabase/queries/clienti';
import { ClientPageClient } from './ClientPageClient';

export const metadata = {
  title: 'Clienți | Zmeurel OS',
  description: 'Gestionează baza de clienți',
};

export default async function ClientPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">
          Trebuie să fii autentificat pentru a accesa această pagină.
        </p>
      </div>
    );
  }

  // Get user's tenant_id
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (!tenantData) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">
          Nu ai un cont de fermă configurat. Contactează suportul.
        </p>
      </div>
    );
  }

  const tenantId = tenantData.id;
  console.log('[ClientPage] Tenant ID:', tenantId);

  // Fetch clienți
  let clienti = [];
  try {
    clienti = await getClienti(tenantId);
    console.log('[ClientPage] Fetched clienti:', clienti.length);
  } catch (error) {
    console.error('[ClientPage] Error fetching clienti:', error);
  }

  // Pass data to Client Component
  return <ClientPageClient initialClienti={clienti} tenantId={tenantId} />;
}
