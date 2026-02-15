// src/app/(dashboard)/culegatori/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getCulegatori } from '@/lib/supabase/queries/culegatori';
import { CulegatorPageClient } from './CulegatorPageClient';

export const metadata = {
  title: 'Culegători | Zmeurel OS',
  description: 'Gestionează echipa de culegători',
};

export default async function CulegatorPage() {
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
  console.log('[CulegatorPage] Tenant ID:', tenantId);

  // Fetch culegători
  let culegatori = [];
  try {
    culegatori = await getCulegatori(tenantId);
    console.log('[CulegatorPage] Fetched culegatori:', culegatori.length);
  } catch (error) {
    console.error('[CulegatorPage] Error fetching culegatori:', error);
  }

  // Pass data to Client Component
  return <CulegatorPageClient initialCulegatori={culegatori} tenantId={tenantId} />;
}
