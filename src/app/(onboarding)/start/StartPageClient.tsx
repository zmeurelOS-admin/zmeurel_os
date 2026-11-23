'use client'

import { CircleCheck, Circle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AuthFrame, AuthSeparator } from '@/components/auth/AuthFrame'
import { GoogleMark } from '@/components/auth/GoogleMark'
import { Button, Notice, ProgressBar, Tile, TileGroup, buttonVariants, kitFocus, kitText } from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { buildAuthCallbackUrl, buildLoginUrl } from '@/lib/auth/redirects'
import {
  PASI_DEMO,
  asteaptaDemoGata,
  esteTipDemo,
  pasiVerificati,
  type NumaratoareDemo,
  type PasDemo,
  type TipDemo,
} from '@/lib/demo/demo-gata'
import { disableFarmSetupMode, enableDemoMode, markDemoSeedAttempted } from '@/lib/demo/onboarding-storage'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId, resetTenantIdCache } from '@/lib/tenant/get-tenant'
import { cn } from '@/lib/utils'

type Step = 'alegere' | 'tip' | 'asteptare'

const TIPURI: Record<TipDemo, { titlu: string; culturi: string; emoji: string; continut: string }> = {
  berries: {
    titlu: 'Fructe de pădure',
    culturi: 'zmeură, mure, afine',
    emoji: '🍓',
    continut: 'Parcele, culegători, comenzi, tratamente, o analiză și magazia, ca să vezi tot.',
  },
  solar: {
    titlu: 'Solarii',
    culturi: 'roșii, castraveți, ardei',
    emoji: '🍅',
    continut: 'Solarii, culegători, recoltări, comenzi și cheltuieli.',
  },
}

const DEMO_EMAIL_SUFFIX = '@demo.zmeurel.local'

/** Demo-ul pornit în tabul ăsta și încă negata (tipul lui), ca o reîncărcare a paginii să reia așteptarea. */
const CHEIE_DEMO_IN_LUCRU = 'zmeurel_demo_in_lucru'

function citesteDemoInLucru(): TipDemo | null {
  try {
    const valoare = window.sessionStorage.getItem(CHEIE_DEMO_IN_LUCRU)
    return esteTipDemo(valoare) ? valoare : null
  } catch {
    return null
  }
}

function scrieDemoInLucru(tip: TipDemo) {
  try {
    window.sessionStorage.setItem(CHEIE_DEMO_IN_LUCRU, tip)
  } catch {
    // fără sessionStorage: reluarea după o reîncărcare nu mai e posibilă, restul merge
  }
}

function stergeDemoInLucru() {
  try {
    window.sessionStorage.removeItem(CHEIE_DEMO_IN_LUCRU)
  } catch {
    // nimic de șters
  }
}

type SupabaseBrowser = ReturnType<typeof getSupabase>

/** Numărătoarea reală din ferma demo (ce vede utilizatorul prin RLS). */
async function numaraDemo(supabase: SupabaseBrowser, tenantId: string): Promise<NumaratoareDemo> {
  const [parcele, recoltari, comenzi] = await Promise.all([
    supabase.from('parcele').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('recoltari').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('comenzi').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])
  const eroare = parcele.error ?? recoltari.error ?? comenzi.error
  if (eroare) throw new Error(eroare.message || 'Nu am putut citi datele demo.')
  return { parcele: parcele.count ?? 0, recoltari: recoltari.count ?? 0, comenzi: comenzi.count ?? 0 }
}

function mesajDinRaspuns(payload: { error?: string | { message?: string } }, implicit: string): string {
  return typeof payload.error === 'string' ? payload.error : payload.error?.message || implicit
}

/** Contul demo: îl folosim pe cel din sesiune (la „Încearcă din nou”), altfel îl creăm. */
async function asiguraContDemo(supabase: SupabaseBrowser): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.email?.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX)) return

  const response = await fetch('/api/auth/beta-guest', { method: 'POST' })
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    accessToken?: string
    refreshToken?: string
    error?: string | { message?: string }
  }
  if (!response.ok || payload.ok === false || !payload.accessToken || !payload.refreshToken) {
    throw new Error(mesajDinRaspuns(payload, 'Nu am putut porni demo-ul.'))
  }
  const { error } = await supabase.auth.setSession({ access_token: payload.accessToken, refresh_token: payload.refreshToken })
  if (error) throw error
}

async function puneDateleDemo(tip: TipDemo): Promise<void> {
  const response = await fetch('/api/demo/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demo_type: tip }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    status?: string
    errors?: Array<{ table?: string; message?: string; error?: string }>
    error?: string | { message?: string }
  }
  if (!response.ok || payload.success === false || payload.status !== 'seeded') {
    const tabele = (payload.errors ?? [])
      .map((e) => e.table)
      .filter(Boolean)
      .join(', ')
    throw new Error(tabele ? `Datele demo nu s-au pus complet (${tabele}).` : mesajDinRaspuns(payload, 'Nu am putut pune datele demo.'))
  }
}

export function StartPageClient({ deschideDemo }: { deschideDemo: boolean }) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabase(), [])
  const [step, setStep] = useState<Step>(deschideDemo ? 'tip' : 'alegere')
  const [tip, setTip] = useState<TipDemo>('berries')
  const [facute, setFacute] = useState<Set<PasDemo>>(() => new Set())
  const [numaratoare, setNumaratoare] = useState<NumaratoareDemo | null>(null)
  const [eroare, setEroare] = useState<string | null>(null)
  const [google, setGoogle] = useState(false)
  const [eroareGoogle, setEroareGoogle] = useState<string | null>(null)
  const inDemo = useRef(false)

  const bifeaza = (pas: PasDemo) => setFacute((curent) => new Set(curent).add(pas))

  /** Așteaptă datele reale, apoi intră în Acasă cu pagină nouă. Aruncă la limita de timp sau la eroare. */
  const verificaSiIntra = async (tipDemo: TipDemo, limitaMs?: number) => {
    const tenantId = await getTenantId(supabase)
    const rezultat = await asteaptaDemoGata({
      tip: tipDemo,
      citeste: () => numaraDemo(supabase, tenantId),
      laFiecare: setNumaratoare,
      limitaMs,
    })
    if (!rezultat.ok) {
      // „Încearcă din nou” pune atunci datele din nou (seed-ul de demo își șterge întâi rândurile lui).
      setFacute((curent) => {
        const urmator = new Set(curent)
        urmator.delete('date')
        return urmator
      })
      throw new Error(
        rezultat.motiv === 'eroare' ? 'Nu am putut verifica datele demo. Verifică internetul.' : 'Datele demo nu au apărut la timp.',
      )
    }
    enableDemoMode()
    disableFarmSetupMode()
    markDemoSeedAttempted()
    track('demo_started', { demo_type: tipDemo })
    stergeDemoInLucru()
    // Intrare cu pagină nouă: memoria aplicației (React Query, tenantul ținut minte) pornește goală,
    // deci nicio pagină nu rămâne cu ce citise înainte de date.
    resetTenantIdCache()
    window.location.assign('/dashboard')
  }

  // Un utilizator deja intrat merge în aplicație. Excepție: demo-ul pornit chiar acum, dacă pagina s-a reîncărcat
  // în timpul pregătirii (seed-ul continuă pe server): reluăm așteptarea, nu intrăm pe pagini goale.
  useEffect(() => {
    let activ = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!activ || !data.session || inDemo.current) return
      const tipInLucru = citesteDemoInLucru()
      if (tipInLucru && data.session.user.email?.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX)) {
        inDemo.current = true
        setTip(tipInLucru)
        setFacute(new Set<PasDemo>(['cont', 'date']))
        setStep('asteptare')
        verificaSiIntra(tipInLucru, 60_000).catch((cause: unknown) => {
          if (activ) setEroare(cause instanceof Error && cause.message ? cause.message : 'Nu am putut porni demo-ul.')
        })
        return
      }
      router.replace('/dashboard')
    })
    return () => {
      activ = false
    }
    // Doar la deschiderea paginii.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase])

  const pornesteDemo = async () => {
    if (inDemo.current && !eroare) return
    inDemo.current = true
    setStep('asteptare')
    setEroare(null)
    scrieDemoInLucru(tip)
    try {
      if (!facute.has('cont')) {
        await asiguraContDemo(supabase)
        resetTenantIdCache()
        bifeaza('cont')
      }
      if (!facute.has('date')) {
        await puneDateleDemo(tip)
        bifeaza('date')
      }
      await verificaSiIntra(tip)
    } catch (cause) {
      setEroare(cause instanceof Error && cause.message ? cause.message : 'Nu am putut porni demo-ul.')
    }
  }

  const pornesteGoogle = async () => {
    if (google) return
    setGoogle(true)
    setEroareGoogle(null)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: buildAuthCallbackUrl('/dashboard', window.location.origin), skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data?.url) throw new Error('Nu am putut porni contul cu Google.')
      window.location.assign(data.url)
    } catch (cause) {
      setGoogle(false)
      setEroareGoogle(cause instanceof Error && cause.message ? cause.message : 'Nu am putut porni contul cu Google.')
    }
  }

  if (step === 'asteptare') {
    const verificati = pasiVerificati(numaratoare, tip)
    const gata = new Set<PasDemo>([...facute, ...verificati])
    const curent = PASI_DEMO.find(({ pas }) => !gata.has(pas))?.pas ?? null
    return (
      <AuthFrame>
        <section aria-live="polite" className="flex flex-col items-center gap-4 pt-8 text-center">
          {eroare ? null : <Loader2 aria-hidden className="size-14 animate-spin text-primary" />}
          <h1 className={cn(kitText.section, 'font-extrabold text-fg')}>{eroare ? 'Demo-ul nu a pornit' : 'Pregătim ferma demo…'}</h1>
          <ul className="w-full space-y-1.5 text-left">
            {PASI_DEMO.map(({ pas, text }) => {
              const bifat = gata.has(pas)
              return (
                <li
                  key={pas}
                  className={cn(kitText.base, 'flex min-h-touch items-center gap-3 rounded-box border border-border bg-surface px-4', bifat ? 'text-fg' : 'text-fg-muted')}
                >
                  {bifat ? (
                    <CircleCheck aria-hidden className="size-6 shrink-0 text-success" />
                  ) : pas === curent && !eroare ? (
                    <Loader2 aria-hidden className="size-6 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle aria-hidden className="size-6 shrink-0 text-fg-subtle" />
                  )}
                  <span className="font-bold">{text}</span>
                  <span className="sr-only">{bifat ? 'gata' : 'în lucru'}</span>
                </li>
              )
            })}
          </ul>
          <ProgressBar value={gata.size} max={PASI_DEMO.length} aria-label="Cât e gata din demo" className="w-full" />
          {eroare ? (
            <Notice
              tone="danger"
              title={eroare}
              className="w-full text-left"
              action={
                <div className="flex flex-col gap-2.5">
                  <Button type="button" variant="primary" size="touch-lg" onClick={() => void pornesteDemo()}>
                    Încearcă din nou
                  </Button>
                  <Link href="/" className={buttonVariants({ variant: 'quiet', size: 'touch' })}>
                    Înapoi la prima pagină
                  </Link>
                </div>
              }
            >
              Datele care s-au pus rămân. Reîncercarea continuă de unde a rămas.
            </Notice>
          ) : (
            <p className={cn(kitText.helper, 'text-fg-muted')}>Durează câteva secunde. Intri singur când e gata.</p>
          )}
        </section>
      </AuthFrame>
    )
  }

  if (step === 'tip') {
    return (
      <AuthFrame
        title="Ce fel de fermă?"
        onBack={() => setStep('alegere')}
        footer={
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => void pornesteDemo()}>
            Pornește demo-ul
          </Button>
        }
      >
        <TileGroup type="single" aria-label="Tipul fermei demo" value={tip} onValueChange={(value) => esteTipDemo(value) && setTip(value)}>
          {(['berries', 'solar'] as const).map((valoare) => (
            <Tile key={valoare} value={valoare} leading={TIPURI[valoare].emoji} title={TIPURI[valoare].titlu} subtitle={TIPURI[valoare].culturi} />
          ))}
        </TileGroup>
        <p className={cn(kitText.secondary, 'text-fg-muted')}>{TIPURI[tip].continut} Se șterg după o zi.</p>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Cum vrei să începi?">
      <Tile
        leading="🍓"
        title="Încearcă o fermă demo"
        subtitle="Fără cont. Date de exemplu, le poți schimba. Se șterg după o zi."
        onClick={() => setStep('tip')}
        className="border-primary"
      />
      <AuthSeparator />
      <Button type="button" variant="neutral" size="touch" className="w-full" loading={google} onClick={() => void pornesteGoogle()}>
        {google ? null : <GoogleMark />}
        Îmi fac cont cu Google
      </Button>
      <Link href={buildLoginUrl({ mode: 'register', next: '/dashboard' })} className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}>
        Îmi fac cont cu email
      </Link>
      {eroareGoogle ? <Notice tone="danger" title={eroareGoogle} /> : null}
      <p className={cn(kitText.secondary, 'text-fg-muted')}>
        Am deja cont ·{' '}
        <Link href="/login" className={cn('inline-flex min-h-touch items-center rounded-control font-bold text-primary underline', kitFocus)}>
          Intră
        </Link>
      </p>
    </AuthFrame>
  )
}
