'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Printer, Share2 } from 'lucide-react'

import { BottomSheet, Button, Notice, ToggleRow, kitText } from '@/components/kit'
import { RaportAnalizaView } from '@/components/analize/RaportAnalizaView'
import { CHEI_OPTIUNI, ETICHETA_OPTIUNE, optiuniEfective, type AnalizaRow, type OptiuniPublice } from '@/lib/analize/model'
import { htmlAfisA4, htmlRaportPdf, type RaportAnaliza } from '@/lib/analize/raport'
import { queryKeys } from '@/lib/query-keys'
import { getOptiuniFerma, salveazaOptiuniAnaliza, salveazaOptiuniFerma } from '@/lib/supabase/queries/analize'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/brand'

type RaportCuQr = { raport: RaportAnaliza; qrSvg: string }

async function citesteRaport(id: string): Promise<RaportCuQr> {
  const response = await fetch(`/api/analize/${encodeURIComponent(id)}/raport`, { credentials: 'include' })
  const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: RaportCuQr; error?: { message?: string } } | null
  if (!response.ok || !json?.ok || !json.data) throw new Error(json?.error?.message ?? 'Raportul nu s-a încărcat.')
  return json.data
}

/** PDF / afiș prin fereastra de tipărire (ca exportul din Rapoarte). `false` dacă browserul a blocat fereastra. */
function tipareste(html: string): boolean {
  const fereastra = window.open('', '_blank', 'width=900,height=1100')
  if (!fereastra) return false
  fereastra.document.write(html)
  fereastra.document.close()
  fereastra.focus()
  // Lasă desenul QR-ului să se termine înainte de dialogul de tipărire.
  window.setTimeout(() => fereastra.print(), 250)
  return true
}

/** Web Share, cu WhatsApp ca rezervă. */
async function distribuie(raport: RaportAnaliza) {
  const titlu = `Analiza la fructe · ${raport.ferma.nume}`
  const text = 'Conform: nicio limită depășită. Raportul analizei:'
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titlu, text, url: raport.url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${raport.url}`)}`, '_blank', 'noopener,noreferrer')
}

export interface RaportSheetProps {
  analiza: AnalizaRow | null
  onClose: () => void
  poateScrie: boolean
  esteProprietar: boolean
  onSchimbat: () => void
}

/**
 * „Raportul analizei”: raportul (aceleași câmpuri ca pagina publică), „Distribuie linkul”, „Descarcă PDF”,
 * „Afiș A4 cu QR” și „Ce apare în raport” (comutatoarele pe analiză + linkul public activ). Implicitele se pot
 * salva pe fermă (doar proprietarul). Nu apar niciodată: numărul atestatului, poza PV-ului, numele inspectorului.
 */
export function RaportSheet({ analiza, onClose, poateScrie, esteProprietar, onSchimbat }: RaportSheetProps) {
  const queryClient = useQueryClient()
  const open = Boolean(analiza)
  const raportKey = ['analize', 'raport', analiza?.id ?? '', analiza?.updated_at ?? ''] as const
  const raportQuery = useQuery({ queryKey: raportKey, queryFn: () => citesteRaport(analiza!.id), enabled: open && analiza?.status === 'conform', staleTime: 60_000, retry: 1 })
  const fermaQuery = useQuery({ queryKey: queryKeys.analizeOptiuniFerma, queryFn: getOptiuniFerma, enabled: open, staleTime: 5 * 60_000 })
  const [busy, setBusy] = useState<string | null>(null)

  const optiuni: OptiuniPublice = optiuniEfective(fermaQuery.data?.optiuni ?? null, analiza?.public_optiuni ?? null)

  const salveaza = async (cheie: string, valori: { public_activ?: boolean; public_optiuni?: Partial<OptiuniPublice> }) => {
    if (!analiza || busy) return
    setBusy(cheie)
    try {
      await salveazaOptiuniAnaliza(analiza.id, valori)
      onSchimbat()
      await queryClient.invalidateQueries({ queryKey: ['analize', 'raport', analiza.id] })
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nu s-a salvat.')
    } finally {
      setBusy(null)
    }
  }

  const ptFerma = async () => {
    if (busy) return
    setBusy('ferma')
    try {
      await salveazaOptiuniFerma(optiuni)
      await queryClient.invalidateQueries({ queryKey: queryKeys.analizeOptiuniFerma })
      toast.success('Alegerile se folosesc la toate analizele noi.')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nu s-a salvat.')
    } finally {
      setBusy(null)
    }
  }

  const date = raportQuery.data
  const tipar = (ce: 'pdf' | 'afis') => {
    if (!date) return
    if (!tipareste(ce === 'pdf' ? htmlRaportPdf(date.raport, date.qrSvg) : htmlAfisA4(date.raport, date.qrSvg))) {
      toast.error(`Browserul a blocat fereastra de tipărire. Permite ferestrele noi pentru ${APP_NAME} și încearcă din nou.`)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Raportul analizei"
      footer={
        date ? (
          <div className="flex flex-col gap-2.5">
            {analiza?.public_activ ? (
              <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => void distribuie(date.raport)}>
                <Share2 aria-hidden />
                Distribuie linkul
              </Button>
            ) : null}
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="neutral" size="touch" onClick={() => tipar('pdf')}>
                <FileText aria-hidden />
                Descarcă PDF
              </Button>
              <Button type="button" variant="neutral" size="touch" onClick={() => tipar('afis')}>
                <Printer aria-hidden />
                Afiș A4 cu QR
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        {raportQuery.isLoading ? (
          <div className="h-[320px] animate-pulse rounded-card bg-surface-muted" aria-busy="true" aria-label="Se face raportul" />
        ) : raportQuery.isError ? (
          <Notice tone="danger" title="Raportul nu s-a încărcat">
            {raportQuery.error instanceof Error ? raportQuery.error.message : 'Încearcă din nou.'}
          </Notice>
        ) : date ? (
          <>
            {!analiza?.public_activ ? (
              <Notice tone="warning" title="Linkul public e oprit">
                Raportul se vede doar aici și în PDF. Pornește linkul mai jos ca să-l poți distribui.
              </Notice>
            ) : null}
            <RaportAnalizaView raport={date.raport} qrSvg={date.qrSvg} qrMic />
            {analiza?.public_activ ? <p className={cn('break-all text-fg-muted', kitText.helper)}>{date.raport.url}</p> : null}
          </>
        ) : null}

        {analiza && poateScrie ? (
          <section className="space-y-2" aria-labelledby="ce-apare-titlu">
            <h3 id="ce-apare-titlu" className={cn('font-bold text-fg', kitText.base)}>
              Ce apare în raport
            </h3>
            {CHEI_OPTIUNI.map((cheie) => (
              <ToggleRow
                key={cheie}
                title={ETICHETA_OPTIUNE[cheie].titlu}
                subtitle={ETICHETA_OPTIUNE[cheie].detaliu}
                checked={optiuni[cheie]}
                disabled={busy !== null}
                onCheckedChange={(checked) => void salveaza(cheie, { public_optiuni: { ...optiuni, [cheie]: checked } })}
              />
            ))}
            <ToggleRow
              title="Linkul public e activ"
              subtitle="îl poți opri oricând"
              checked={analiza.public_activ}
              disabled={busy !== null}
              onCheckedChange={(checked) => void salveaza('activ', { public_activ: checked })}
            />
            <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Nu apar niciodată: numărul atestatului, poza PV-ului, numele inspectorului.</p>
            {esteProprietar && fermaQuery.data?.disponibil ? (
              <Button type="button" variant="quiet" size="touch" className="w-full" loading={busy === 'ferma'} onClick={() => void ptFerma()}>
                Folosește aceste alegeri la toate analizele
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>
    </BottomSheet>
  )
}
