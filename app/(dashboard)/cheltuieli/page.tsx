// src/app/(dashboard)/cheltuieli/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getCheltuieli } from '@/lib/supabase/queries/cheltuieli';
import { CheltuialaPageClient } from './CheltuialaPageClient';

export const metadata = {
  title: 'Cheltuieli | Zmeurel OS',
  description: 'Gestionează cheltuielile operaționale',
};

export default async function CheltuialaPage() {
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
  console.log('[CheltuialaPage] Tenant ID:', tenantId);

  // Fetch cheltuieli
  let cheltuieli = [];
  try {
    cheltuieli = await getCheltuieli(tenantId);
    console.log('[CheltuialaPage] Fetched cheltuieli:', cheltuieli.length);
  } catch (error) {
    console.error('[CheltuialaPage] Error fetching cheltuieli:', error);
  }

  // Pass data to Client Component
  return <CheltuialaPageClient initialCheltuieli={cheltuieli} tenantId={tenantId} />;
}
