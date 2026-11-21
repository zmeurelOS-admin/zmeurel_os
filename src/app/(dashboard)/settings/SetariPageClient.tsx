'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Bell, Eye, FileText, FlaskConical, House, Star, Tag, UserRound, Users, Warehouse } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { useDensity } from '@/components/app/DensityProvider'
import { useHighContrast } from '@/components/app/HighVisibilityInit'
import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { NavRow, RowGroup, ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useHydrated } from '@/components/setari/useHydrated'
import { formatLeiKg } from '@/lib/format-ro'
import { titluLipsuri } from '@/lib/acte/stare'
import type { LegalDocsStatus } from '@/lib/legal-docs/shared'
import { cateSuntPornite, NOTIFICARI_CHEI, NOTIFICARI_PREFERINTE_IMPLICITE } from '@/lib/notifications/preferinte'
import { usePreferinteNotificari } from '@/lib/notifications/preferinte-client'
import { useFarmSettings, type PerioadaPret } from '@/lib/farm-settings'
import { PRET_SE_INCARCA, resolvePretStandard } from '@/lib/pret-standard'
import type { FarmProfile } from '@/lib/setari/farm-profile-server'
import { settingsRouteForLegacyHash } from '@/lib/setari/legacy-links'

export type LegalDocsSummary = LegalDocsStatus

const PERIOADA_SCURT: Record<PerioadaPret, string> = { inceput: 'început', varf: 'vârf', mediu: 'mediu' }

function formatDayMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

/** Textul de sub „Actele fermei”: complete / ce lipsește / când expiră (aceleași lipsuri ca pe ecranul actelor). */
function legalDocsSub(legal: LegalDocsSummary | null): { text: string; tone: 'muted' | 'warning' | 'danger' | 'success' } {
  if (!legal) return { text: 'Formularul pentru vânzarea prin asociație', tone: 'muted' }
  if (legal.isExpired && legal.expiryDate) return { text: `Certificatul a expirat pe ${formatDayMonth(legal.expiryDate)}`, tone: 'danger' }
  if (legal.isExpiringSoon && legal.expiryDate) return { text: `Certificatul expiră pe ${formatDayMonth(legal.expiryDate)}`, tone: 'warning' }
  if (legal.complete) return { text: 'Complete', tone: 'success' }
  if (legal.missingFields.length > 0) {
    const first = legal.missingFields.slice(0, 2).join(', ')
    const more = legal.missingFields.length > 2 ? ` și încă ${legal.missingFields.length - 2}` : ''
    return { text: `${titluLipsuri(legal.missingFields.length)}: ${first}${more}`, tone: 'warning' }
  }
  return { text: 'Necompletate', tone: 'warning' }
}

type FarmMemberSummary = { name: string | null }

async function fetchTeam(): Promise<FarmMemberSummary[]> {
  const response = await fetch('/api/farm-members', { credentials: 'same-origin' })
  const json = (await response.json().catch(() => null)) as { success?: boolean; members?: FarmMemberSummary[] } | null
  if (!response.ok || !json?.success) throw new Error('team')
  return json.members ?? []
}

function teamSub(members: FarmMemberSummary[] | undefined): string {
  if (!members) return 'Operatori și livratori cu acces limitat'
  if (members.length === 0) return 'Doar tu'
  if (members.length === 1) {
    const first = members[0].name?.trim().split(/\s+/)[0]
    return first ? `Tu și ${first}` : 'Tu și încă o persoană'
  }
  return `Tu și încă ${members.length} persoane`
}

export function SetariPageClient({ farm, legal }: { farm: FarmProfile | null; legal: LegalDocsSummary | null }) {
  const router = useRouter()
  const { email, isSuperAdmin, farmName } = useDashboardAuth()
  const { settings, isLoading: settingsLoading } = useFarmSettings()
  const { theme } = useTheme()
  const { density } = useDensity()
  const [highContrast] = useHighContrast()
  const push = usePushSubscription()
  const { data: preferinte } = usePreferinteNotificari()
  const mounted = useHydrated()

  const isDemo = Boolean(email?.endsWith('@demo.zmeurel.local'))

  const { data: team } = useQuery({
    queryKey: ['farm-members', 'summary'],
    queryFn: fetchTeam,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  // Legăturile vechi (`/settings#gdpr`, `#tema` …) duc la subpagina nouă.
  useEffect(() => {
    const target = settingsRouteForLegacyHash(window.location.hash)
    if (target) router.replace(target)
  }, [router])

  const pret = resolvePretStandard(settings)
  // Până vin setările nu se arată valoarea de rezervă (35 lei/kg, „Automat”), ci un schelet.
  const pretSub = settingsLoading
    ? PRET_SE_INCARCA
    : pret.configurabil
      ? `Acum: ${PERIOADA_SCURT[pret.perioada]}, ${formatLeiKg(pret.activ)}`
      : `Acum: ${formatLeiKg(pret.activ)}`
  const acasaSub = settingsLoading
    ? PRET_SE_INCARCA
    : settings.acasaPerioadaMod === 'sezon'
      ? 'Mereu sezon'
      : settings.acasaPerioadaMod === 'extrasezon'
        ? 'Mereu extrasezon'
        : 'Automat: sezon sau extrasezon'

  const pornite = cateSuntPornite(preferinte ?? NOTIFICARI_PREFERINTE_IMPLICITE)
  const notifSub = `${push.isSubscribed ? 'Pornite pe telefon' : 'Doar în aplicație'} · ${pornite} din ${NOTIFICARI_CHEI.length}`

  const themeLabel = !mounted || !theme || theme === 'system' ? 'Automat zi/noapte' : theme === 'dark' ? 'Noapte' : 'Zi'
  const aspectSub = [themeLabel, mounted && density === 'large' ? 'text mare' : 'text normal', highContrast ? 'contrast ridicat' : null]
    .filter(Boolean)
    .join(' · ')

  const farmTitle = farm?.numeFerma ?? farmName ?? 'Ferma ta'
  const farmSub = [farm?.localitate, farm?.contactPhone].filter(Boolean).join(' · ') || 'Nume, telefon, localitate, locul pe hartă'
  const legalSub = legalDocsSub(legal)

  return (
    <AppShell header={<ScreenHeader title="Setări" backHref="/mai-mult" />}>
      <ScreenBody>
        <RowGroup title="Ferma">
          <NavRow href="/settings/ferma" label={farmTitle} sub={farmSub} icon={<Warehouse />} iconTone="primary" />
          <NavRow href="/settings/pret-standard" label="Prețul standard" sub={pretSub} icon={<Tag />} iconTone="primary" />
          <NavRow href="/settings/acasa" label="Ce arată Acasă" sub={acasaSub} icon={<House />} iconTone="primary" />
        </RowGroup>

        <RowGroup title="Aplicația">
          <NavRow href="/notificari/setari" label="Notificări" sub={notifSub} icon={<Bell />} iconTone="info" />
          <NavRow href="/settings/aspect" label="Aspect" sub={aspectSub} icon={<Eye />} iconTone="info" />
        </RowGroup>

        <RowGroup title="Echipă și acte">
          <NavRow href="/settings/echipa" label="Echipa" sub={teamSub(team)} icon={<Users />} iconTone="neutral" />
          <NavRow
            href="/settings/ferma/acte"
            label="Actele fermei"
            sub={legalSub.text}
            subTone={legalSub.tone}
            icon={<FileText />}
            iconTone={legalSub.tone === 'warning' || legalSub.tone === 'danger' ? 'warning' : 'neutral'}
          />
        </RowGroup>

        <RowGroup title="Contul tău">
          <NavRow
            href="/settings/cont"
            label={isDemo ? 'Cont demo' : (email ?? 'Contul tău')}
            sub="Parola, datele tale, ștergerea contului"
            icon={<UserRound />}
            iconTone="neutral"
          />
          <NavRow href="/planuri" label="Abonament" sub="Gratuit: toate modulele" icon={<Star />} iconTone="neutral" />
          {isDemo ? (
            <NavRow href="/settings/demo" label="Mod demo" sub="Reîncarcă exemplele sau creează-ți ferma" icon={<FlaskConical />} iconTone="warning" />
          ) : null}
          {isSuperAdmin ? (
            <NavRow href="/settings/schimba-ferma" label="Schimbă ferma" sub="Treci la altă fermă" icon={<ArrowLeftRight />} iconTone="neutral" />
          ) : null}
        </RowGroup>
      </ScreenBody>
    </AppShell>
  )
}
