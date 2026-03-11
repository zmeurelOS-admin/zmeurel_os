'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/lib/ui/toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabase } from '@/lib/supabase/client'

function getRedirectBase() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export default function ResetPasswordRequestPage() {
  const supabase = useMemo(() => getSupabase(), [])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    const redirectBase = getRedirectBase()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${redirectBase}/update-password`,
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    setSent(true)
    toast.success('Email de reset trimis.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <h1 className="text-2xl font-bold text-[#312E3F]">Resetare parolă</h1>
        <p className="mt-2 text-sm text-gray-500">Primește pe email link-ul pentru setarea unei parole noi.</p>

        {sent ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Dacă adresa există, ai primit un email cu link de resetare.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="email@exemplu.ro"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full bg-[#F16B6B] text-white hover:bg-[#e05555]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se trimite...
              </>
            ) : (
              'Trimite email resetare'
            )}
          </Button>
        </form>

        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
          Înapoi la login
        </Link>
      </div>
    </div>
  )
}



