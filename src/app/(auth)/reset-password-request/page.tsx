'use client'

import { FormEvent, useMemo, useState } from 'react'

import { AuthFrame } from '@/components/auth/AuthFrame'
import { BigInput, Button, Notice } from '@/components/kit'
import { isHiddenOperatorEmail } from '@/lib/farm-members/operator-link'
import { getSupabase } from '@/lib/supabase/client'

function getRedirectBase() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** „Ai uitat parola?”: trimite pe email linkul pentru o parolă nouă. Logica e cea de dinainte. */
export default function ResetPasswordRequestPage() {
  const supabase = useMemo(() => getSupabase(), [])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setEroare(null)

    // Conturile ascunse ale operatorilor din link n-au parolă și nu primesc email: nu trimitem nimic.
    if (isHiddenOperatorEmail(email)) {
      setLoading(false)
      setSent(true)
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getRedirectBase()}/update-password`,
    })
    setLoading(false)
    if (error) {
      setEroare(error.message || 'Emailul nu s-a trimis. Încearcă din nou.')
      return
    }
    setSent(true)
  }

  return (
    <AuthFrame title="Ai uitat parola?" intro="Îți trimitem pe email un link pentru o parolă nouă." backHref="/login">
      {sent ? (
        <Notice tone="success" title="Verifică emailul.">
          Dacă adresa are cont, ai primit linkul pentru parola nouă.
        </Notice>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <BigInput
          id="reset-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nume@exemplu.ro"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {eroare ? <Notice tone="danger" title={eroare} /> : null}
        <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={loading}>
          Trimite linkul
        </Button>
      </form>
    </AuthFrame>
  )
}
