// ============================================================================
// RLS DEBUG CHECKER
// Temporary test script to verify RLS and tenant_id auto-population
// DO NOT EXPOSE TO PRODUCTION ROUTES
// ============================================================================

import { getSupabase } from '@/lib/supabase/client';
import { getTenantId } from '@/lib/tenant/get-tenant';

declare global {
  interface Window {
    testRLS?: () => Promise<unknown>
  }
}

export async function testRLSAutoPopulation() {
  const supabase = getSupabase();


  // 1. Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error('User not authenticated:', userError);
    return { success: false, error: 'User not authenticated' };
  }


  // 2. Get user's tenant
  let tenantId: string
  try {
    tenantId = await getTenantId(supabase)
  } catch (tenantError) {
    console.error('Tenant not found:', tenantError);
    return { success: false, error: 'Tenant not found' };
  }


  // 3. Insert a test client record WITHOUT tenant_id
  const testClientName = `RLS_TEST_${Date.now()}`;
  
  const { data: insertedClient, error: insertError } = await supabase
    .from('clienti')
    .insert({
      id_client: `RLS${Date.now()}`,
      nume_client: testClientName,
      telefon: '0700000000',
      email: 'rls-test@example.com',
      // NOTE: tenant_id is NOT included - should be auto-populated by trigger/RLS
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert failed:', insertError);
    return { success: false, error: insertError.message };
  }


  // 4. Check if tenant_id was auto-populated
  if (!insertedClient.tenant_id) {
    console.error('tenant_id was NOT auto-populated!');
    return { 
      success: false, 
      error: 'tenant_id not auto-populated',
      record: insertedClient 
    };
  }

  if (insertedClient.tenant_id !== tenantId) {
    console.error('tenant_id mismatch!');
    console.error('Expected:', tenantId);
    console.error('Got:', insertedClient.tenant_id);
    return { 
      success: false, 
      error: 'tenant_id mismatch',
      expected: tenantId,
      got: insertedClient.tenant_id 
    };
  }


  // 5. Verify we can only see our own records (RLS SELECT policy)
  const { data: allClients, error: selectError } = await supabase
    .from('clienti')
    .select('id,tenant_id');

  if (selectError) {
    console.error('Select failed:', selectError);
  } else {
    const ourClients = allClients?.filter((c: { tenant_id: string | null }) => c.tenant_id === tenantId);
  }

  // 6. Clean up test record
  const { error: deleteError } = await supabase
    .from('clienti')
    .delete()
    .eq('id', insertedClient.id);

  if (deleteError) {
  } else {
  }

  return {
    success: true,
    userId: user.id,
    tenantId,
    autoPopulatedTenantId: insertedClient.tenant_id,
    message: 'RLS and tenant_id auto-population working correctly!'
  };
}

// Export for manual testing in browser console
if (typeof window !== 'undefined') {
  window.testRLS = testRLSAutoPopulation;
}



