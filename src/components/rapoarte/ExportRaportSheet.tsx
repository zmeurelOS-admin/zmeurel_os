'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, FlaskConical, Package, SprayCan } from 'lucide-react'

import { BottomSheet, Button, Notice, kitText } from '@/components/kit'
import { analizeInPerioada, documentAnalize } from '@/lib/analize/export'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { AnalizeIndisponibileError, getAnalize } from '@/lib/supabase/queries/analize'
import { documentMagazie } from '@/lib/magazie/export'
import { queryKeys } from '@/lib/query-keys'
import { getMagazieStocSauNimic, getMiscariMagazie } from '@/lib/supabase/queries/magazie'
import { dataRo, documentHtml, documentRaport, documentRegistru, numeFisier, type DocumentExport } from '@/lib/rapoarte/export'
import { cheltuieliPeCategorii, type DateRaport, type LunaRaport, type Perioada, type RandClient, type RandCulegator, type RandParcela, type SumarRaport } from '@/lib/rapoarte/raport'
import { registruTratamente } from '@/lib/rapoarte/registru-tratamente'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getProduseFitosanitare } from '@/lib/supabase/queries/tratamente'
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
  // Catalogul dă substanța activă când aplicarea nu a salvat-o; dacă nu se încarcă, coloana rămâne goală.
  const catalogQuery = useQuery({
    queryKey: queryKeys.produseFitosanitare,
    queryFn: getProduseFitosanitare,
    enabled: open,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  // „Analizele sezonului”: fără migrarea analizelor lista e goală (nu e o eroare).
  const analizeQuery = useQuery({
    queryKey: queryKeys.analize,
    queryFn: getAnalize,
    enabled: open,
    staleTime: 30_000,
    retry: (n, error) => !(error instanceof AnalizeIndisponibileError) && n < 1,
  })
  const analizeLista = useMemo(
    () => (analizeQuery.data ? analizeInPerioada(analizeQuery.data, perioada.start, perioada.end) : []),
    [analizeQuery.data, perioada.end, perioada.start],
  )
  const analizeGata = analizeQuery.isSuccess || analizeQuery.error instanceof AnalizeIndisponibileError

  // „Magazia” (promptul 28): stocul de azi + mișcările perioadei. Fără migrare: `null` (butonul spune de ce).
  const magazieStocQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStocSauNimic, enabled: open, staleTime: 30_000, retry: false })
  const magazieMiscariQuery = useQuery({ queryKey: queryKeys.magazieMiscari, queryFn: getMiscariMagazie, enabled: open, staleTime: 30_000, retry: false })
  const magazieGata = magazieStocQuery.isSuccess && magazieMiscariQuery.isSuccess
  const magazieLipsa = magazieStocQuery.isSuccess && magazieStocQuery.data === null

  const tratamenteGata = aplicariQuery.isSuccess && activitatiQuery.isSuccess && !catalogQuery.isLoading
  const tratamenteEroare = aplicariQuery.isError || activitatiQuery.isError

  const registru = useMemo(() => {
    if (!tratamenteGata) return []
    const numeParcele = new Map(date.parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă']))
    return registruTratamente({
      aplicari: aplicariQuery.data ?? [],
      activitati: activitatiQuery.data ?? [],
      numeParcele,
      substantePeProdus: new Map((catalogQuery.data ?? []).map((produs) => [produs.id, produs.substanta_activa])),
      start: perioada.start,
      end: perioada.end,
    })
  }, [tratamenteGata, aplicariQuery.data, activitatiQuery.data, catalogQuery.data, date.parcele, perioada.start, perioada.end])

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

  const exportaMagazia = () => {
    if (!magazieGata || !magazieStocQuery.data) return
    const doc = documentMagazie({ stoc: magazieStocQuery.data, miscari: magazieMiscariQuery.data ?? [], start: perioada.start, end: perioada.end })
    descarcaExcel(numeFisier('magazia', azi, 'xls'), doc)
    trackEvent('export_raport', { format: 'excel', reportType: 'magazie', rows: magazieStocQuery.data.length })
  }

  const exporta = (ce: 'raport' | 'registru' | 'analize', format: 'excel' | 'pdf') => {
    const doc =
      ce === 'raport'
        ? docRaport()
        : ce === 'analize'
          ? documentAnalize(analizeQuery.data ?? [], new Map(date.parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), perioada.start, perioada.end)
          : documentRegistru(registru, perioada.start, perioada.end)
    if (format === 'excel') {
      descarcaExcel(numeFisier(ce === 'raport' ? `raport ${perioada.eticheta}` : ce === 'analize' ? 'analizele sezonului' : 'registrul de tratamente', azi, 'xls'), doc)
    } else if (!tiparestePdf(doc)) {
      toast.error('Browserul a blocat fereastra de tipărire. Permite ferestrele noi pentru Zmeurel și încearcă din nou.')
      return
    }
    trackEvent('export_raport', {
      format,
      reportType: ce === 'raport' ? `raport_${perioada.tip}` : ce === 'analize' ? 'analize_sezon' : 'registru_tratamente',
      rows: ce === 'registru' ? registru.length : ce === 'analize' ? analizeLista.length : undefined,
    })
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

        <section className="space-y-2.5 border-t border-border pt-4" aria-labelledby="export-analize">
          <h3 id="export-analize" className={cn('flex items-center gap-2 font-bold text-fg', kitText.base)}>
            <FlaskConical aria-hidden className="size-5" />
            Analizele sezonului
          </h3>
          <p className={cn('text-fg-muted', kitText.secondary)}>
            {analizeGata
              ? analizeLista.length === 0
                ? 'Nicio analiză prelevată în perioada aleasă.'
                : `${analizeLista.length} ${analizeLista.length === 1 ? 'analiză' : 'analize'}: prelevarea, laboratorul, rezultatul, buletinul și substanțele.`
              : 'Se încarcă analizele…'}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button type="button" variant="neutral" size="touch" disabled={!analizeGata} loading={!analizeGata} onClick={() => exporta('analize', 'excel')}>
              <FileSpreadsheet aria-hidden />
              Excel
            </Button>
            <Button type="button" variant="neutral" size="touch" disabled={!analizeGata} onClick={() => exporta('analize', 'pdf')}>
              <FileText aria-hidden />
              PDF
            </Button>
          </div>
        </section>

        <section className="space-y-2.5 border-t border-border pt-4" aria-labelledby="export-magazie">
          <h3 id="export-magazie" className={cn('flex items-center gap-2 font-bold text-fg', kitText.base)}>
            <Package aria-hidden className="size-5" />
            Magazia
          </h3>
          <p className={cn('text-fg-muted', kitText.secondary)}>
            {magazieLipsa
              ? 'Magazia va merge după actualizarea bazei de date.'
              : magazieGata
                ? `Stocul de azi (${magazieStocQuery.data?.length ?? 0} produse, cu prețul mediu și valoarea) și mișcările din perioada aleasă.`
                : 'Se încarcă magazia…'}
          </p>
          <Button type="button" variant="neutral" size="touch" className="w-full" disabled={!magazieGata || magazieLipsa} loading={!magazieGata && !magazieStocQuery.isError} onClick={exportaMagazia}>
            <FileSpreadsheet aria-hidden />
            Excel
          </Button>
        </section>
      </div>
    </BottomSheet>
  )
}
