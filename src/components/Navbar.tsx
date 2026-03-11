'use client';

import LogoutButton from './LogoutButton';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { getTenantByUserIdOrNull } from '@/lib/tenant/get-tenant';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [farmName, setFarmName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    // Verifica sesiunea la mount
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);

          const tenant = await getTenantByUserIdOrNull(supabase, session.user.id);

          if (tenant?.nume_ferma) {
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

    // Asculta schimbari autentificare
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Daca nu e logat, nu afisa navbar
  if (loading) return null;
  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo + Nume Ferma */}
          <div className="flex items-center gap-4">
            <Link href="/test" className="flex items-center gap-2">
              <span className="text-2xl">🫐</span>
              <span className="text-xl font-bold text-[#312E3F]">Zmeurel OS</span>
            </Link>
            {farmName && (
              <span className="text-sm text-gray-500 hidden sm:block">| {farmName}</span>
            )}
          </div>

          {/* User Info + Logout */}
          <div className="flex items-center gap-4">
            {user.email && (
              <span className="text-sm text-gray-600 hidden md:block">👤 {user.email}</span>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
}


