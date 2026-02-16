import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ParcelaPageClient from './ParcelaPageClient';

export const dynamic = 'force-dynamic';

export default async function ParcelePage() {
  const supabase = await createClient();

  console.log('🔍 [ParcelePage] Starting...');

  // Verifică autentificarea
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('🔍 [ParcelePage] User:', user?.email || 'NOT LOGGED IN');

  if (!user) {
    redirect('/login');
  }

  // Tenant ID
  const tenantId = 'b68a19a7-c5fc-4f30-94a2-b3c17af68f76';
  console.log('🔍 [ParcelePage] Tenant ID:', tenantId);

  // Fetch parcele
  console.log('🔍 [ParcelePage] Fetching parcele...');
  const { data: parcele, error: parceleError } = await supabase
    .from('parcele')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('id_parcela', { ascending: true });

  if (parceleError) {
    console.error('❌ [ParcelePage] Error parcele:', parceleError);
  } else {
    console.log('✅ [ParcelePage] Parcele loaded:', parcele?.length || 0);
  }

  // Fetch soiuri disponibile
  console.log('🔍 [ParcelePage] Fetching soiuri...');
  const { data: soiuriData, error: soiuriError } = await supabase
    .from('nomenclatoare')
    .select('valoare')
    .eq('tip', 'Soi')
    .order('valoare', { ascending: true });

  console.log('🔍 [ParcelePage] Soiuri RAW data:', soiuriData);
  console.log('🔍 [ParcelePage] Soiuri error:', soiuriError);

  if (soiuriError) {
    console.error('❌ [ParcelePage] Error soiuri:', {
      message: soiuriError.message,
      details: soiuriError.details,
      hint: soiuriError.hint,
      code: soiuriError.code,
    });
  }

  const soiuriDisponibile = soiuriData?.map((item) => item.valoare) || [];
  console.log('✅ [ParcelePage] Soiuri mapped:', soiuriDisponibile);
  console.log('✅ [ParcelePage] Soiuri count:', soiuriDisponibile.length);

  return (
    <ParcelaPageClient
      tenantId={tenantId}
      initialParcele={parcele || []}
      soiuriDisponibile={soiuriDisponibile}
    />
  );
}
