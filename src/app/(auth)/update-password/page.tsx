'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AuthFrame } from '@/components/auth/AuthFrame'
import { BigInput, Button, Notice } from '@/components/kit'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'

/** Parola nouă, după linkul din email. Logica e cea de dinainte (minimum 8 caractere, cele două la fel). */
export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabase(), [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    if (password.length < 8) {
      setEroare('Parola are cel puțin 8 caractere.')
      return
    }
    if (password !== confirmPassword) {
      setEroare('Parolele nu sunt la fel.')
      return
    }
    setLoading(true)
    setEroare(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setEroare(error.message || 'Parola nu s-a schimbat. Încearcă din nou.')
      return
    }
    toast.success('Parola a fost schimbată.')
    router.push('/dashboard')
  }

  return (
    <AuthFrame title="Parolă nouă" intro="Alege o parolă pentru cont.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <BigInput
          id="new-password"
          label="Parolă nouă"
          type="password"
          autoComplete="new-password"
          placeholder="cel puțin 8 caractere"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <BigInput
          id="confirm-password"
          label="Încă o dată"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {eroare ? <Notice tone="danger" title={eroare} /> : null}
        <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={loading}>
          Salvează parola
        </Button>
      </form>
    </AuthFrame>
  )
}
