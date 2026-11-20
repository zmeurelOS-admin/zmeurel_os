'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crosshair, MapPin } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { BigInput, Button, Notice, kitText } from '@/components/kit'
import { IconBadge, PanelCard, ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { SAVE_ERROR_MESSAGE, saveTenantSettingsRow } from '@/lib/farm-settings'
import { getDevicePosition } from '@/lib/livrari/device'
import type { FarmProfile } from '@/lib/setari/farm-profile-server'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { isValidRomanianPhone, normalizePhone } from '@/lib/utils/phone'

type LocationState =
  | { kind: 'saved' }
  | { kind: 'none' }
  | { kind: 'just-saved'; accuracyM: number }

async function saveFarmName(farmName: string): Promise<string> {
  const response = await fetch('/api/gdpr/farm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmName }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: { message?: string } | string
    data?: { farmName?: string }
    farmName?: string
  }
  if (!response.ok || payload.ok === false) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
    throw new Error(message || 'Numele fermei nu s-a salvat.')
  }
  return payload.data?.farmName ?? payload.farmName ?? farmName
}

export function FermaPageClient({
  farm,
  savedLocation,
}: {
  farm: FarmProfile | null
  savedLocation: { lat: number; lng: number } | null
}) {
  const router = useRouter()
  const [saved, setSaved] = useState({
    name: farm?.numeFerma ?? '',
    phone: farm?.contactPhone ?? '',
    localitate: farm?.localitate ?? '',
  })
  const [name, setName] = useState(saved.name)
  const [phone, setPhone] = useState(saved.phone)
  const [localitate, setLocalitate] = useState(saved.localitate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [location, setLocation] = useState<LocationState>(savedLocation ? { kind: 'saved' } : { kind: 'none' })
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const nameTrim = name.trim()
  const phoneTrim = phone.trim()
  const localitateTrim = localitate.trim()
  const nameError = nameTrim.length < 2 ? 'Numele fermei are cel puțin 2 litere.' : undefined
  const phoneError = phoneTrim && !isValidRomanianPhone(phoneTrim) ? 'Numărul începe cu 07 și are 10 cifre.' : undefined
  const dirty = nameTrim !== saved.name || phoneTrim !== saved.phone || localitateTrim !== saved.localitate

  const save = async () => {
    if (!farm || !dirty || nameError || phoneError || saving) return
    setSaving(true)
    setError(null)
    try {
      let nextName = saved.name
      if (nameTrim !== saved.name) {
        nextName = await saveFarmName(nameTrim)
      }
      const nextPhone = phoneTrim ? (normalizePhone(phoneTrim) ?? phoneTrim) : ''
      if (nextPhone !== saved.phone || localitateTrim !== saved.localitate) {
        const { error: updateError } = await getSupabase()
          .from('tenants')
          .update({ contact_phone: nextPhone || null, localitate: localitateTrim || null })
          .eq('id', farm.tenantId)
        if (updateError) throw new Error('Telefonul și localitatea nu s-au salvat. Încearcă din nou.')
      }
      const next = { name: nextName, phone: nextPhone, localitate: localitateTrim }
      setSaved(next)
      setName(next.name)
      setPhone(next.phone)
      setLocalitate(next.localitate)
      toast.success('Datele fermei au fost salvate.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : SAVE_ERROR_MESSAGE)
    } finally {
      setSaving(false)
    }
  }

  const saveCurrentLocation = async () => {
    if (locating) return
    setLocating(true)
    setLocationError(null)
    try {
      // Mesajele pentru locație refuzată / prea lentă sunt cele din Livrări.
      const position = await getDevicePosition()
      try {
        await saveTenantSettingsRow({ latitudine_default: position.lat, longitudine_default: position.lng })
      } catch {
        throw new Error(SAVE_ERROR_MESSAGE)
      }
      setLocation({ kind: 'just-saved', accuracyM: Math.max(1, Math.round(position.accuracyM)) })
      toast.success('Locul fermei a fost salvat.')
    } catch (cause) {
      setLocationError(cause instanceof Error && cause.message ? cause.message : 'Locația nu e disponibilă acum.')
    } finally {
      setLocating(false)
    }
  }

  const locationTitle =
    location.kind === 'just-saved'
      ? `Salvat acum, cu precizie de ${location.accuracyM} m`
      : location.kind === 'saved'
        ? 'Locul e salvat'
        : 'Încă nu e salvat'

  return (
    <AppShell header={<ScreenHeader title="Ferma" backHref="/settings" />}>
      <ScreenBody className="space-y-4">
        {!farm ? <Notice tone="warning" title="Nu am găsit ferma contului.">Reîncarcă pagina. Dacă rămâne așa, scrie-ne.</Notice> : null}
        {error ? <Notice tone="danger" title={error} /> : null}

        <BigInput
          label="Numele fermei"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="organization"
          hint="Apare în magazin și pe bonurile comenzilor."
          error={name !== saved.name ? nameError : undefined}
        />
        <BigInput
          label="Telefon pentru clienți"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07XX XXX XXX"
          error={phoneError}
        />
        <BigInput
          label="Localitatea"
          value={localitate}
          onChange={(event) => setLocalitate(event.target.value)}
          autoComplete="address-level2"
          placeholder="ex. Văratec, Suceava"
        />

        <section className="space-y-2" aria-labelledby="loc-ferma">
          <h2 id="loc-ferma" className={cn('font-bold text-fg', kitText.secondary)}>
            Locul fermei pe hartă
          </h2>
          <PanelCard>
            <div className="flex items-start gap-3">
              <IconBadge tone={location.kind === 'none' ? 'neutral' : 'primary'} size="lg">
                <MapPin />
              </IconBadge>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={cn('font-semibold text-fg', kitText.base)}>{locationTitle}</p>
                <p className={cn('text-fg-muted', kitText.secondary)}>
                  De aici pornește traseul din Livrări și de aici e meteo de pe Acasă.
                </p>
              </div>
            </div>
            {locationError ? <Notice tone="danger" title={locationError} /> : null}
            <Button
              type="button"
              variant="neutral"
              size="touch"
              className="h-auto min-h-touch w-full whitespace-normal py-2 text-center"
              loading={locating}
              disabled={!farm}
              onClick={() => void saveCurrentLocation()}
            >
              <Crosshair aria-hidden />
              {location.kind === 'just-saved' ? 'Salvat' : 'Sunt la fermă: folosește locul de acum'}
            </Button>
          </PanelCard>
        </section>

        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          disabled={!farm || !dirty || Boolean(nameError) || Boolean(phoneError)}
          loading={saving}
          onClick={() => void save()}
        >
          Salvează
        </Button>
      </ScreenBody>
    </AppShell>
  )
}
