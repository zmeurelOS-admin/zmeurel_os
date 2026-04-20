import {
  appendFisaAnsvsaToDocument,
  applyPageFooters,
  collectFisaAnsvsaDocumentData,
  createPdfDocument,
} from '@/lib/tratamente/pdf/fisa-ansvsa'
import { getAplicariAnualToateParcelele } from '@/lib/supabase/queries/tratamente'

export async function generateRaportConsolidat(an: number): Promise<Uint8Array> {
  const groups = await getAplicariAnualToateParcelele(an)
  const target = await createPdfDocument()

  target.setProperties({
    title: `RAPORT CONSOLIDAT TRATAMENTE ${an}`,
    subject: 'Raport consolidat tratamente',
    author: 'Zmeurel OS',
  })
  target.setFontSize(18)
  target.text(`Raport consolidat tratamente · ${an}`, 105, 24, { align: 'center' })
  target.setFontSize(10)
  target.text(`Parcele incluse: ${groups.length}`, 105, 34, { align: 'center' })
  const generatedAt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  target.text(`Generat la: ${generatedAt}`, 105, 40, { align: 'center' })

  let footerOperator = 'N/A'
  for (const group of groups) {
    const data = await collectFisaAnsvsaDocumentData(group.parcela.id, an)
    footerOperator = data.tenant.operatorResponsabil
    appendFisaAnsvsaToDocument(target, data, { addNewPage: true })
  }

  applyPageFooters(target, footerOperator, generatedAt)
  return new Uint8Array(target.output('arraybuffer'))
}
