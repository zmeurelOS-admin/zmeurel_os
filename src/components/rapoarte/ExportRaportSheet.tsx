'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, SprayCan } from 'lucide-react'

import { BottomSheet, Button, Notice, kitText } from '@/components/kit'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { queryKeys } from '@/lib/query-keys'
import { dataRo, documentHtml, documentRaport, documentRegistru, numeFisier, type DocumentExport } from '@/lib/rapoarte/export'
import { cheltuieliPeCategorii, type DateRaport, type LunaRaport, type Perioada, type RandClient, type RandCulegator, type RandParcela, type SumarRaport } from '@/lib/rapoarte/raport'
import { registruTratamente } from '@/lib/rapoarte/registru-tratamente'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { useAplicariTratament } from '@/lib/tratamente/hooks'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

function descarcaExcel(nume: string, doc: DocumentExport) {
  const blob = new Blob([documentHtml(doc)], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nume
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

/** PDF prin fereastra de tipărire a browserului („Salvează ca PDF”). `false` dacă fereastra a fost blocată. */
function tiparestePdf(doc: DocumentExport): boolean {
  const fereastra = window.open('', '_blank', 'width=960,height=720')
  if (!fereastra) return false
  fereastra.document.write(documentHtml(doc, true))
  fereastra.document.close()
  fereastra.focus()
  fereastra.print()
  return true
}

export interface ExportRaportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  azi: string
  perioada: Perioada
  date: DateRaport
  sumar: SumarRaport
  luni: LunaRaport[]
  parcele: RandParcela[]
  culegatori: RandCulegator[]
  clienti: RandClient[]
}

/** „Exportă”: raportul perioadei în Excel sau PDF, plus registrul de tratamente pentru aceeași perioadă. */
export function ExportRaportSheet({ open, onOpenChange, azi, perioada, date, sumar, luni, parcele, culegatori, clienti }: ExportRaportSheetProps) {
  // Tratamentele se citesc doar când foaia e deschisă (aceleași chei ca jurnalul Tratamente).
  const aplicariQuery = useAplicariTratament(open)
  const activitatiQuery = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    enabled: open,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const tratamenteGata = aplicariQuery.isSuccess && activitatiQuery.isSuccess
  const tratamenteEroare = aplicariQuery.isError || activitatiQuery.isError

  const registru = useMemo(() => {
    if (!tratamenteGata) return []
    const numeParcele = new Map(date.parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă']))
    return registruTratamente({
      aplicari: aplicariQuery.data ?? [],
      activitati: activitatiQuery.data ?? [],
      numeParcele,
      start: perioada.start,
      end: perioada.end,
    })
  }, [tratamenteGata, aplicariQuery.data, activitatiQuery.data, date.parcele, perioada.start, perioada.end])

  const docRaport = () =>
    documentRaport({
      eticheta: perioada.eticheta,
      start: perioada.start,
      end: perioada.end,
      incasat: sumar.incasat,
      cheltuieli: sumar.cheltuieli,
      profit: sumar.profit,
      recoltatKg: sumar.recoltatKg,
      investitiiLei: sumar.investitii.totalLei,
      luni,
      parcele,
      culegatori,
      clienti,
      cheltuieliPeCategorii: cheltuieliPeCategorii(date.cheltuieli, perioada),
      investitiiPeCategorii: sumar.investitii.peCategorii,
    })

  const exporta = (ce: 'raport' | 'registru', format: 'excel' | 'pdf') => {
    const doc = ce === 'raport' ? docRaport() : documentRegistru(registru, perioada.start, perioada.end)
    if (format === 'excel') {
      descarcaExcel(numeFisier(ce === 'raport' ? `raport ${perioada.eticheta}` : 'registrul de tratamente', azi, 'xls'), doc)
    } else if (!tiparestePdf(doc)) {
      toast.error('Browserul a blocat fereastra de tipărire. Permite ferestrele noi pentru Zmeurel și încearcă din nou.')
      return
    }
    trackEvent('export_raport', { format, reportType: ce === 'raport' ? `raport_${perioada.tip}` : 'registru_tratamente', rows: ce === 'registru' ? registru.length : undefined })
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Exportă" description={`Perioada: ${dataRo(perioada.start)} – ${dataRo(perioada.end)}`}>
      <div className="space-y-5">
        <section className="space-y-2.5" aria-labelledby="export-raport">
          <h3 id="export-raport" className={cn('font-bold text-fg', kitText.base)}>
            Raportul {perioada.eticheta}
          </h3>
          <p className={cn('text-fg-muted', kitText.secondary)}>Profitul, încasat, cheltuieli, recoltat, investiții, lunile, parcelele, culegătorii și clienții.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button type="button" variant="neutral" size="touch" onClick={() => exporta('raport', 'excel')}>
              <FileSpreadsheet aria-hidden />
              Excel
            </Button>
            <Button type="button" variant="neutral" size="touch" onClick={() => exporta('raport', 'pdf')}>
              <FileText aria-hidden />
              PDF
            </Button>
          </div>
        </section>

        <section className="space-y-2.5 border-t border-border pt-4" aria-labelledby="export-registru">
          <h3 id="export-registru" className={cn('flex items-center gap-2 font-bold text-fg', kitText.base)}>
            <SprayCan aria-hidden className="size-5" />
            Registrul de tratamente
          </h3>
          <p className={cn('text-fg-muted', kitText.secondary)}>
            {tratamenteGata
              ? registru.length === 0
                ? 'Niciun tratament în perioada aleasă.'
                : `${registru.length} ${registru.length === 1 ? 'rând' : 'rânduri'}: data, parcela, metoda, produsul, substanța, doza, cantitatea, pauza și ziua de la care se poate recolta. Include și tratamentele vechi din Activități.`
              : tratamenteEroare
                ? ''
                : 'Se încarcă tratamentele…'}
          </p>
          {tratamenteEroare ? <Notice tone="danger" title="Tratamentele nu s-au încărcat">Verifică internetul și deschide din nou foaia.</Notice> : null}
          <div className="grid grid-cols-2 gap-2.5">
            <Button type="button" variant="neutral" size="touch" disabled={!tratamenteGata} loading={!tratamenteGata && !tratamenteEroare} onClick={() => exporta('registru', 'excel')}>
              <FileSpreadsheet aria-hidden />
              Excel
            </Button>
            <Button type="button" variant="neutral" size="touch" disabled={!tratamenteGata} onClick={() => exporta('registru', 'pdf')}>
              <FileText aria-hidden />
              PDF
            </Button>
          </div>
        </section>
      </div>
    </BottomSheet>
  )
}
