'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AuthFrame } from '@/components/auth/AuthFrame'
import { BigInput, Button, Notice } from '@/components/kit'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'

/** Pagina veche de parolă nouă (linkurile mai vechi duc aici). Aceeași logică ca înainte: minimum 6 caractere. */
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabase(), [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    if (password !== confirm) {
      setEroare('Parolele nu sunt la fel.')
      return
    }
    if (password.length < 6) {
      setEroare('Parola are cel puțin 6 caractere.')
      return
    }
    setLoading(true)
    setEroare(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setEroare('Parola nu s-a schimbat. Încearcă din nou.')
      return
    }
    toast.success('Parola a fost schimbată.')
    router.push('/dashboard')
  }

  return (
    <AuthFrame title="Parolă nouă" intro="Alege o parolă pentru cont.">
      <form onSubmit={handleReset} className="flex flex-col gap-3">
        <BigInput
          id="password"
          label="Parolă nouă"
          type="password"
          autoComplete="new-password"
          placeholder="cel puțin 6 caractere"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <BigInput
          id="confirm"
          label="Încă o dată"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
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
