'use client'

import { useState } from 'react'

import { Button, Notice } from '@/components/kit'
import { buildAuthCallbackUrl } from '@/lib/auth/redirects'
import { getSupabase } from '@/lib/supabase/client'

function inviteAuthCallbackUrl(token: string) {
  const callback = new URL(buildAuthCallbackUrl('/comenzi', window.location.origin))
  callback.searchParams.set('invite_token', token)
  return callback.toString()
}

function mesajEroare(cod: string | undefined): string {
  switch (cod) {
    case 'used':
      return 'Linkul a fost deja folosit. Cere un link nou.'
    case 'expired':
      return 'Linkul a expirat. Cere un link nou.'
    case 'inactive':
      return 'Accesul tău a fost oprit. Cere un link nou.'
    case 'signed_in_as_other':
      return 'Ești logat în alt cont. Reîncarcă pagina și ieși întâi din el.'
    default:
      return 'Nu am putut intra în fermă. Încearcă din nou.'
  }
}

/** „Intră în fermă” (fără email și parolă) și, la prima invitație, „Intră cu Google”. */
export function InviteSignupClient({ token, allowGoogle }: { token: string; allowGoogle: boolean }) {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intra = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; redirect_to?: string } | null
      if (!res.ok || json?.success !== true) throw new Error(mesajEroare(json?.error))
      // Încărcare completă: sesiune nouă, nimic ținut minte din altă fermă.
      window.location.assign(json.redirect_to || '/comenzi')
    } catch (cause) {
      setLoading(false)
      setError(cause instanceof TypeError ? 'Fără internet. Încearcă din nou.' : cause instanceof Error ? cause.message : mesajEroare(undefined))
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: inviteAuthCallbackUrl(token),
          skipBrowserRedirect: true,
        },
      })
      if (oauthError) throw oauthError
      if (!data?.url) throw new Error('Nu am putut porni intrarea cu Google.')
      window.location.assign(data.url)
    } catch {
      setGoogleLoading(false)
      setError('Nu am putut porni intrarea cu Google.')
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Notice tone="danger" title="Nu ai intrat">
          {error}
        </Notice>
      ) : null}
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => void intra()} loading={loading} disabled={googleLoading}>
        Intră în fermă
      </Button>
      {allowGoogle ? (
        <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => void handleGoogle()} loading={googleLoading} disabled={loading}>
          Intră cu Google
        </Button>
      ) : null}
    </div>
  )
}
