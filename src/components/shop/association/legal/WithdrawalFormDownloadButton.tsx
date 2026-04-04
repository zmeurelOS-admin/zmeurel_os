'use client'

import type { ResolvedMerchantPublic } from '@/lib/shop/association/merchant-info'
import { gustaBrandColors } from '@/lib/shop/association/brand-tokens'

type Props = {
  merchant: ResolvedMerchantPublic
}

/* DRAFT_LEGAL_REVIEW — formular model Anexa 2 OUG 34/2014 (draft) */
export function WithdrawalFormDownloadButton({ merchant }: Props) {
  const addr = merchant.headquarters?.trim() || '[adresă]'
  const em = merchant.email?.trim() || '[email]'
  const legal = merchant.legalName?.trim() || 'Asociația Gustă din Bucovina'

  const buildText = () =>
    [
      'FORMULAR DE RETRAGERE',
      '(completați și returnați acest formular doar dacă doriți retragerea din contract)',
      '',
      `Către: ${legal}, ${addr}, ${em}`,
      '',
      'Subsemnatul/Subsemnata ______________________ notifică/notificăm prin prezenta retragerea mea/noastră din contractul de vânzare a următoarelor produse: ______________________',
      '',
      'Comandate la data __________ / primite la data __________',
      '',
      'Numele consumatorului: ______________________',
      '',
      'Adresa consumatorului: ______________________',
      '',
      'Semnătura consumatorului (doar în caz de formular pe hârtie): ______________________',
      '',
      'Data: __________',
      '',
      '---',
      'Document informativ; revizuire juridică recomandată.',
    ].join('\r\n')

  const download = () => {
    const blob = new Blob([buildText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'formular-retragere-gusta-din-bucovina.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      className="assoc-body mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold transition hover:opacity-90"
      style={{ borderColor: gustaBrandColors.primary, color: gustaBrandColors.primary }}
    >
      Descarcă formular (text)
    </button>
  )
}
