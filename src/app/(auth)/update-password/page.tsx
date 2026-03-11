'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabase } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabase(), [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password.length < 8) {
      toast.error('Parola trebuie să aibă minim 8 caractere.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Parolele nu coincid.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Parola a fost actualizată.')
    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <h1 className="text-2xl font-bold text-[#312E3F]">Actualizare parolă</h1>
        <p className="mt-2 text-sm text-gray-500">Setează o parolă nouă pentru cont.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Parolă nouă</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Minim 8 caractere"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmă parola</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repetă parola"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full bg-[#F16B6B] text-white hover:bg-[#e05555]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se actualizeaza...
              </>
            ) : (
              'Salvează parola'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}




