import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { RaportAnalizaView } from '@/components/analize/RaportAnalizaView'
import { origineAplicatie, raportPublicDupaToken } from '@/lib/analize/raport-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analiza la fructe',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Raportul public al unei analize: fără cont și fără sesiune (ruta e în `isPurePublicNoAuthBypassRoute` din
 * `proxy.ts`). Există doar pentru o analiză conformă cu linkul activ; altfel 404. Citire cu service role,
 * doar câmpurile permise (`src/lib/analize/raport-server.ts`).
 */
export default async function AnalizaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const h = await headers()
  const rezultat = await raportPublicDupaToken(token, origineAplicatie(h.get('x-forwarded-host') ?? h.get('host'), h.get('x-forwarded-proto')))
  if (!rezultat) notFound()

  return (
    <main className="min-h-dvh bg-page px-4 py-6 text-fg">
      <div className="mx-auto w-full max-w-xl space-y-3">
        <p className="text-[15px] font-semibold text-fg-muted">Analiza la fructe</p>
        <RaportAnalizaView raport={rezultat.raport} qrSvg={rezultat.qrSvg} />
        <p className="text-[13px] text-fg-muted">
          Raport făcut în Zmeurel din buletinul laboratorului. Substanțele, valorile și limitele sunt cele scrise de fermier din buletin.
        </p>
      </div>
    </main>
  )
}
