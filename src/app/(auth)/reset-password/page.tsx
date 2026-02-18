'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      toast.error('Parolele nu coincid!');
      return;
    }

    if (password.length < 6) {
      toast.error('Parola trebuie să aibă minim 6 caractere!');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error('Eroare la schimbarea parolei. Încearcă din nou.');
    } else {
      toast.success('Parola schimbată cu succes!');
      router.push('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#312E3F]">🍓 Zmeurel OS</h1>
          <p className="text-gray-500 mt-2">Setează o parolă nouă</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <Label htmlFor="password">Parolă nouă</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minim 6 caractere"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="confirm">Confirmă parola</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repetă parola"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#F16B6B] hover:bg-[#e05555] text-white"
            disabled={loading}
          >
            {loading ? 'Se salvează...' : 'Salvează parola'}
          </Button>
        </form>
      </div>
    </div>
  );
}
