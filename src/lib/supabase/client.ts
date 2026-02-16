import { createBrowserClient } from '@supabase/ssr';

if (typeof window !== 'undefined') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('🔍 [Supabase Client Debug]');
  console.log('URL exists:', !!url);
  console.log('URL prefix:', url?.substring(0, 20) + '...');
  console.log('Key exists:', !!key);
  console.log('Key prefix:', key?.substring(0, 20) + '...');
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '❌ Missing Supabase environment variables!\n' +
      `URL: ${!!supabaseUrl}\n` +
      `Key: ${!!supabaseAnonKey}`
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
