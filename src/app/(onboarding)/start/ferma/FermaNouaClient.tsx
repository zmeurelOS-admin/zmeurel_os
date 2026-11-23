'use client'

import { FormEvent, useState } from 'react'

import { AuthFrame } from '@/components/auth/AuthFrame'
import { BigInput, Button, Notice, kitText } from '@/components/kit'
import { getSupabase } from '@/lib/supabase/client'
import { resetTenantIdCache } from '@/lib/tenant/get-tenant'
import { cn } from '@/lib/utils'

/** Numele merge unde stă deja (`tenants.nume_ferma`, prin `/api/gdpr/farm`), localitatea în `tenants.localitate`. */
async function salveazaFerma(tenantId: string, nume: string, localitate: string): Promise<void> {
  const response = await fetch('/api/gdpr/farm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmName: nume }),
  })
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string | { message?: string } }
  if (!response.ok || payload.ok === false) {
    throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'Numele fermei nu s-a salvat.')
  }
  if (localitate) {
    const { error } = await getSupabase().from('tenants').update({ localitate }).eq('id', tenantId)
    if (error) throw new Error('Localitatea nu s-a salvat. Încearcă din nou.')
  }
}

export function FermaNouaClient({
  numeInitial,
  localitateInitiala,
  tenantId,
}: {
  numeInitial: string
  localitateInitiala: string
  tenantId: string
}) {
  const [nume, setNume] = useState(numeInitial)
  const [localitate, setLocalitate] = useState(localitateInitiala)
  const [incercat, setIncercat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  const numeCurat = nume.trim()
  const eroareNume = incercat && numeCurat.length < 2 ? 'Scrie numele fermei (cel puțin 2 litere).' : undefined

  const intra = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIncercat(true)
    if (saving || numeCurat.length < 2) return
    setSaving(true)
    setEroare(null)
    try {
      await salveazaFerma(tenantId, numeCurat, localitate.trim())
      resetTenantIdCache()
      window.location.assign('/dashboard')
    } catch (cause) {
      setSaving(false)
      setEroare(cause instanceof Error && cause.message ? cause.message : 'Nu s-a salvat. Încearcă din nou.')
    }
  }

  return (
    <AuthFrame title="Ferma ta">
      <form onSubmit={intra} className="flex flex-col gap-3" noValidate>
        <BigInput
          label="Cum se numește ferma?"
          placeholder="ex. Ferma de la deal"
          value={nume}
          onChange={(event) => setNume(event.target.value)}
          maxLength={120}
          autoComplete="organization"
          error={eroareNume}
          required
        />
        <BigInput
          label="Localitatea"
          placeholder="ex. Văratec, Suceava"
          value={localitate}
          onChange={(event) => setLocalitate(event.target.value)}
          maxLength={120}
          autoComplete="address-level2"
        />
        <p className={cn(kitText.helper, 'text-fg-muted')}>Numele apare pe rapoarte și pe actele fermei. Le poți schimba din Setări.</p>
        {eroare ? <Notice tone="danger" title={eroare} /> : null}
        <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={saving}>
          Intră în fermă
        </Button>
      </form>
    </AuthFrame>
  )
}
