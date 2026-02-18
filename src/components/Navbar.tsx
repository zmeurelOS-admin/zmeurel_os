'use client';

import LogoutButton from './LogoutButton';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [farmName, setFarmName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // Verifică sesiunea la mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Ia numele fermei
          const { data: tenant } = await supabase
            .from('tenants')
            .select('nume_ferma')
            .eq('owner_user_id', session.user.id)
            .single();
          
          if (tenant) {
            setFarmName(tenant.nume_ferma);
          }
        }
      } catch (error) {
        console.error('Eroare verificare sesiune:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Ascultă schimbări autentificare
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Dacă nu e logat, nu afișa navbar
  if (loading) return null;
  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo + Nume Fermă */}
          <div className="flex items-center gap-4">
            <Link href="/test" className="flex items-center gap-2">
              <span className="text-2xl">🍓</span>
              <span className="text-xl font-bold text-[#312E3F]">Zmeurel OS</span>
            </Link>
            {farmName && (
              <span className="text-sm text-gray-500 hidden sm:block">
                | {farmName}
              </span>
            )}
          </div>

          {/* User Info + Logout */}
          <div className="flex items-center gap-4">
            {user.email && (
              <span className="text-sm text-gray-600 hidden md:block">
                👤 {user.email}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
