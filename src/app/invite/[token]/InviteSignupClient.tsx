'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { BigInput, Button, kitText } from '@/components/kit'
import { buildAuthCallbackUrl } from '@/lib/auth/redirects'
import { getSupabase } from '@/lib/supabase/client'
import { resetTenantIdCache } from '@/lib/tenant/get-tenant'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function inviteAuthCallbackUrl(token: string) {
  const callback = new URL(buildAuthCallbackUrl('/comenzi', window.location.origin))
  callback.searchParams.set('invite_token', token)
  return callback.toString()
}

export function InviteSignupClient({ token }: { token: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (trimmedName.length < 2) {
      toast.error('Introdu numele complet.')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast.error('Email invalid.')
      return
    }
    if (password.length < 8) {
      toast.error('Parola trebuie să aibă minimum 8 caractere.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Parolele nu coincid.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        redirect_to?: string
      } | null
      if (!res.ok || json?.success !== true) {
        const message =
          json?.error === 'email_already_registered'
            ? 'Există deja un cont cu acest email. Folosește Google sau cere un link nou pentru alt email.'
            : 'Nu am putut accepta invitația.'
        throw new Error(message)
      }

      // Sesiune nouă, altă fermă: tenantul ținut minte în browser nu mai e valabil.
      resetTenantIdCache()
      toast.success('Cont creat. Intri în fermă.')
      router.replace(json.redirect_to || '/comenzi')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut accepta invitația.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: inviteAuthCallbackUrl(token),
          skipBrowserRedirect: true,
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('Nu am putut porni autentificarea cu Google.')
      window.location.assign(data.url)
    } catch (error) {
      setGoogleLoading(false)
      toast.error(error instanceof Error ? error.message : 'Nu am putut porni autentificarea cu Google.')
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <BigInput label="Nume" autoComplete="name" autoCapitalize="words" value={name} onChange={(event) => setName(event.target.value)} required />
        <BigInput label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <BigInput
          label="Parolă"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Minimum 8 caractere."
          required
        />
        <BigInput
          label="Confirmă parola"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={loading} disabled={googleLoading}>
          Creează cont
        </Button>
      </form>

      <div className="flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-border" />
        <span className={cn('font-semibold uppercase tracking-wide text-fg-muted', kitText.helper)}>sau</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={handleGoogle} loading={googleLoading} disabled={loading}>
        Continuă cu Google
      </Button>
    </div>
  )
}
