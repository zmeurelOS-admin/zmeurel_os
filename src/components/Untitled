'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Eroare logout:', error);
        alert('Eroare la deconectare. Încearcă din nou.');
        return;
      }

      // Redirect la login
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Eroare logout:', err);
      alert('Eroare la deconectare. Încearcă din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? 'Se deconectează...' : '🚪 Ieșire'}
    </button>
  );
}
