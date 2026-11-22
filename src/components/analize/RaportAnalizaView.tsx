import { Check } from 'lucide-react'

import { kitText } from '@/components/kit/text'
import { dataScurtaAnaliza } from '@/lib/analize/lista'
import { numarMgKg, textAtestat, textParceleRaport, textPrelevare, type RaportAnaliza } from '@/lib/analize/raport'
import { cn } from '@/lib/utils'

/**
 * Raportul unei analize (pagina publică `/a/<token>` și raportul din aplicație). Fără stare: primește raportul
 * deja filtrat (`construiesteRaport`) și SVG-ul codului QR (făcut pe server cu `qrcode`, nu din datele utilizatorului).
 */
export function RaportAnalizaView({ raport, qrSvg, qrMic = false }: { raport: RaportAnaliza; qrSvg: string; qrMic?: boolean }) {
  const atestat = textAtestat(raport)
  return (
    <article className="space-y-3 rounded-card border border-border bg-surface p-4 text-fg">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className={cn('font-extrabold leading-tight', kitText.section)}>
            {raport.ferma.nume}
            {raport.ferma.localitate ? ` · ${raport.ferma.localitate}` : ''}
          </h1>
          {atestat ? <p className={cn('text-fg-muted', kitText.secondary)}>{atestat}</p> : null}
        </div>
        <span
          className={cn('shrink-0 rounded-control bg-surface p-1 [&_svg]:size-full', qrMic ? 'size-20' : 'size-28')}
          role="img"
          aria-label="Cod QR spre acest raport"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </header>

      <p className={cn('flex items-center gap-2 rounded-box bg-success-bg px-3 py-2.5 font-bold text-success-text', kitText.base)}>
        <Check className="size-5 shrink-0" aria-hidden strokeWidth={2.6} />
        Conform: nicio limită depășită
      </p>

      <div className={cn('space-y-1.5 text-fg-muted', kitText.secondary)}>
        <p>{textParceleRaport(raport)}</p>
        {raport.analizat ? <p>Analiza: {raport.analizat}</p> : null}
        <p>{textPrelevare(raport)}</p>
      </div>

      {raport.substante && raport.substante.length > 0 ? (
        <table className={cn('w-full border-collapse', kitText.secondary)}>
          <caption className="sr-only">Substanțele găsite, în mg/kg</caption>
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th className="py-1.5 pr-2 font-semibold">Substanță</th>
              <th className="py-1.5 pr-2 font-semibold">Găsit (mg/kg)</th>
              <th className="py-1.5 font-semibold">Limita (mg/kg)</th>
            </tr>
          </thead>
          <tbody>
            {raport.substante.map((s, index) => (
              <tr key={`${s.substanta}-${index}`} className="border-b border-border-subtle">
                <td className="py-1.5 pr-2">{s.substanta}</td>
                <td className="py-1.5 pr-2">{numarMgKg(s.gasit)}</td>
                <td className="py-1.5">{numarMgKg(s.limita)}</td>
              </tr>
            ))}
            {raport.restNedetectate ? (
              <tr>
                <td colSpan={3} className="py-1.5">
                  Restul substanțelor analizate: nedetectate
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : raport.restNedetectate ? (
        <p className={cn('text-fg-muted', kitText.secondary)}>Substanțele analizate: nedetectate.</p>
      ) : null}

      {raport.tratamente ? (
        <p className={cn('text-fg-muted', kitText.secondary)}>
          Tratamente în cele 30 de zile dinainte:{' '}
          {raport.tratamente.length
            ? raport.tratamente.map((t) => `${t.nume} (${dataScurtaAnaliza(t.zi, raport.prelevare.data)}, ${t.pauza}${t.respectata ? ' ✓' : ''})`).join('; ')
            : 'niciunul'}
        </p>
      ) : null}

      {raport.pozaBuletinUrl ? (
        <p className={kitText.secondary}>
          <a href={raport.pozaBuletinUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
            Vezi buletinul de analiză
          </a>
        </p>
      ) : null}

      {raport.telefon ? (
        <p className={cn('font-semibold', kitText.base)}>
          Comenzi:{' '}
          <a href={`tel:${raport.telefon.replace(/\s+/g, '')}`} className="text-primary underline underline-offset-2">
            {raport.telefon}
          </a>
        </p>
      ) : null}
    </article>
  )
}
