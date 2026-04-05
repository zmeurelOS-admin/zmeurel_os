'use client'

import { useState } from 'react'

import { M, PX } from './marketTokens'

import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import type { GustCheckoutSuccess } from '@/components/shop/association/cart/gustCartTypes'
import { GUSTA_MERCHANT_LEGAL_NAME_DEFAULT } from '@/lib/shop/association/brand-config'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'
import { formatQuantityForDisplay } from '@/lib/shop/utils'

type Props = {
  success: GustCheckoutSuccess
  publicSettings: AssociationPublicSettings
  onBackToShop: () => void
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function stripDiacritics(value: string): string {
  return value
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/ș/g, 's')
    .replace(/Ș/g, 'S')
    .replace(/ţ/g, 't')
    .replace(/Ţ/g, 'T')
    .replace(/ț/g, 't')
    .replace(/Ț/g, 'T')
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return window.btoa(binary)
}

async function fetchAsBase64(url: string): Promise<string | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  return toBase64(buffer)
}

function sanitizeDownloadPart(value: string | null | undefined): string {
  if (!value) return String(Date.now())
  return value.replace(/[^\p{L}\p{N}._-]+/gu, '-')
}

/* DRAFT_LEGAL_REVIEW — de revizuit cu avocat — mesaje post-comandă + confirmare tip document */
export function MarketSuccessOverlay({ success, publicSettings, onBackToShop }: Props) {
  const merchantResolved = resolveMerchantPublicInfo(publicSettings)
  const merchant = merchantResolved.legalName?.trim() || GUSTA_MERCHANT_LEGAL_NAME_DEFAULT
  const primaryOrderNumber = success.primaryOrderNumber ?? success.orderNumbers[0] ?? null
  const shortOrderLabel = primaryOrderNumber ?? success.orderIds[0] ?? 'N/A'
  const relatedOrderNumbers = success.orderNumbers.filter((value) => value !== primaryOrderNumber)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const communicationLabel =
    success.canalComunicare === 'whatsapp'
      ? 'WhatsApp'
      : success.canalComunicare === 'sms'
        ? 'SMS'
        : success.canalComunicare === 'apel'
          ? 'Apel telefonic'
          : null

  const downloadSummary = async () => {
    try {
      setDownloadingPdf(true)
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'a4')
      let canUseUnicode = true

      try {
        const [regularFontBase64, boldFontBase64] = await Promise.all([
          fetchAsBase64('/fonts/Roboto-Regular.ttf'),
          fetchAsBase64('/fonts/Roboto-Bold.ttf'),
        ])
        if (!regularFontBase64 || !boldFontBase64) {
          throw new Error('Roboto fonts missing')
        }
        doc.addFileToVFS('Roboto-Regular.ttf', regularFontBase64)
        doc.addFileToVFS('Roboto-Bold.ttf', boldFontBase64)
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
        doc.setFont('Roboto', 'normal')
      } catch (fontError) {
        canUseUnicode = false
        console.warn('[MarketSuccessOverlay] PDF font fallback:', fontError)
      }

      const pdfText = (value: string) => (canUseUnicode ? value : stripDiacritics(value))
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const left = 20
      const right = pageWidth - 20
      const usableWidth = right - left
      let y = 12

      const logoBase64 = await fetchAsBase64('/images/gusta-logo.png').catch(() => null)
      if (logoBase64) {
        const logoWidth = 25
        const logoHeight = 25
        doc.addImage(
          `data:image/png;base64,${logoBase64}`,
          'PNG',
          pageWidth / 2 - logoWidth / 2,
          y,
          logoWidth,
          logoHeight,
        )
        y += logoHeight + 6
      }

      const ensureSpace = (needed = 8) => {
        if (y + needed <= pageHeight - 20) return
        doc.addPage()
        y = 16
      }

      const writeText = (
        text: string,
        options?: {
          bold?: boolean
          size?: number
          align?: 'left' | 'center' | 'right'
          color?: [number, number, number]
          indent?: number
        },
      ) => {
        const indent = options?.indent ?? 0
        const prepared = pdfText(text)
        const maxWidth = usableWidth - indent
        const lines = doc.splitTextToSize(prepared, maxWidth)
        ensureSpace(lines.length * 5 + 2)
        doc.setFont(canUseUnicode ? 'Roboto' : 'helvetica', options?.bold ? 'bold' : 'normal')
        doc.setFontSize(options?.size ?? 10)
        if (options?.color) doc.setTextColor(...options.color)
        else doc.setTextColor(0, 0, 0)
        const x =
          options?.align === 'center' ? pageWidth / 2 : options?.align === 'right' ? right : left + indent
        doc.text(lines, x, y, options?.align ? { align: options.align } : undefined)
        y += lines.length * ((options?.size ?? 10) >= 12 ? 6 : 5)
      }

      doc.setFont(canUseUnicode ? 'Roboto' : 'helvetica', 'bold')
      doc.setFontSize(18)
      doc.text(pdfText('Confirmare comandă'), pageWidth / 2, y, { align: 'center' })
      y += 10

      writeText('Asociația Gustă din Bucovina', {
        align: 'center',
        size: 11,
      })
      y += 4

      doc.setDrawColor(13, 99, 66)
      doc.setLineWidth(0.5)
      doc.line(left, y, right, y)
      y += 10

      writeText('Date comandă:', { bold: true, size: 10 })
      writeText(`Număr: #${shortOrderLabel}`)
      if (relatedOrderNumbers.length > 0) {
        writeText(`Comenzi asociate: ${relatedOrderNumbers.join(', ')}`)
      }
      writeText(`Data plasării: ${success.placedAtLabel}`)
      writeText(`Client: ${success.clientName}`)
      writeText(`Telefon: ${success.clientTelefon}`)
      writeText(`Adresă: ${success.clientLocatie}`)
      if (communicationLabel) {
        writeText(`Canal confirmare: ${communicationLabel}`)
      }
      y += 4

      writeText('Produse comandate:', { bold: true, size: 10 })
      y += 2

      ensureSpace(10)
      doc.setFillColor(13, 99, 66)
      doc.rect(left, y - 4, usableWidth, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont(canUseUnicode ? 'Roboto' : 'helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(pdfText('Produs'), left + 2, y)
      doc.text(pdfText('Cant.'), left + 86, y)
      doc.text(pdfText('Preț'), left + 112, y)
      doc.text('Total', left + 145, y)
      y += 7

      success.summaryLines.forEach((line, index) => {
        const nameLines = doc.splitTextToSize(pdfText(`${line.productName} (${line.farmName})`), 80)
        const rowHeight = Math.max(nameLines.length * 5, 6)
        ensureSpace(rowHeight + 3)
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245)
          doc.rect(left, y - 4, usableWidth, rowHeight + 1, 'F')
        }
        doc.setTextColor(0, 0, 0)
        doc.setFont(canUseUnicode ? 'Roboto' : 'helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(nameLines, left + 2, y)
        doc.text(`${formatQuantityForDisplay(line.qty, line.unit)} ${line.unit}`, left + 86, y)
        doc.text(`${formatAmount(line.unitPrice)} ${line.currency}`, left + 112, y)
        doc.text(`${formatAmount(line.lineTotal)} ${line.currency}`, left + 145, y)
        y += rowHeight
      })

      y += 4
      writeText(`Subtotal: ${formatAmount(success.totalLei)} ${success.currency}`, {
        align: 'right',
      })
      writeText(
        `Livrare: ${
          success.deliveryFeeLei > 0
            ? `${formatAmount(success.deliveryFeeLei)} ${success.currency}`
            : 'Gratuită'
        }`,
        { align: 'right' },
      )
      writeText(`TOTAL: ${formatAmount(success.grandTotalLei)} ${success.currency}`, {
        align: 'right',
        bold: true,
        size: 12,
      })
      writeText('Plată: Cash la livrare', { align: 'right' })
      writeText(`Livrare estimată: ${success.deliveryDateLabel}`, { align: 'right' })

      y += 10
      doc.setDrawColor(220, 220, 220)
      doc.line(left, y, right, y)
      y += 8
      writeText(`Comerciant: ${merchant}`, {
        align: 'center',
        size: 8,
        color: [100, 100, 100],
      })
      if (merchantResolved.headquarters) {
        writeText(`Adresă comerciant: ${merchantResolved.headquarters}`, {
          align: 'center',
          size: 8,
          color: [100, 100, 100],
        })
      }
      writeText('Platformă tehnică: Zmeurel OS (zmeurel.ro)', {
        align: 'center',
        size: 8,
        color: [100, 100, 100],
      })
      writeText(`Generat la: ${new Date().toLocaleString('ro-RO')}`, {
        align: 'center',
        size: 8,
        color: [100, 100, 100],
      })

      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `comanda-gusta-${sanitizeDownloadPart(primaryOrderNumber ?? success.orderIds[0])}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error('PDF generation failed:', error)
      window.alert('Nu s-a putut genera PDF-ul. Încearcă din nou sau fă screenshot.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center"
      style={{ backgroundColor: M.green }}
    >
      <div className={PX}>
        <div className="mx-auto max-w-md">
          <p className="text-5xl sm:text-6xl" aria-hidden>
            ✅
          </p>
          <h2 className="assoc-heading mt-6 text-2xl font-extrabold text-[#FFF9E3] sm:text-3xl">
            Comanda ta a fost transmisă către {merchant}
          </h2>
          <p className="assoc-body mt-3 text-base font-medium leading-relaxed text-white/90 sm:text-lg">
            {merchant} va confirma comanda și te va contacta pentru detalii de livrare.
          </p>
          <p className="assoc-body mt-3 text-sm font-medium leading-relaxed text-white/90">
            Livrarea și încasarea (cash la livrare) sunt realizate de {merchant}.
          </p>
          {success.canalComunicare === 'whatsapp' ? (
            <p className="assoc-body mt-3 text-sm leading-relaxed text-white/90">
              Vei fi contactat pe WhatsApp la numărul {success.clientTelefon.trim()} pentru confirmarea și
              coordonarea comenzii.
            </p>
          ) : success.canalComunicare === 'sms' ? (
            <p className="assoc-body mt-3 text-sm leading-relaxed text-white/90">
              Vei primi confirmarea și detaliile comenzii prin SMS la numărul {success.clientTelefon.trim()}.
            </p>
          ) : (
            <p className="assoc-body mt-3 text-sm leading-relaxed text-white/90">
              Vei fi contactat telefonic la numărul indicat pentru confirmarea comenzii.
            </p>
          )}
          {success.farmCount > 1 ? (
            <p className="assoc-body mt-2 text-sm text-white/85">
              Comanda include produse de la mai mulți producători; coordonarea este făcută de asociație.
            </p>
          ) : null}
          {success.deliveryDateLabel ? (
            <p className="assoc-body mt-4 text-base font-bold text-[#FFF9E3]">
              Livrare estimată: {success.deliveryDateLabel}
            </p>
          ) : null}
          {success.deliveryFeeLei != null && Number.isFinite(success.deliveryFeeLei) ? (
            <p className="assoc-body mt-2 text-sm font-semibold text-white/95">
              Cost livrare:{' '}
              {success.deliveryFeeLei > 0
                ? `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(success.deliveryFeeLei)} ${success.currency ?? 'RON'}`
                : 'Livrare gratuită'}
            </p>
          ) : null}
          {success.grandTotalLei != null && Number.isFinite(success.grandTotalLei) ? (
            <p className="assoc-body mt-2 text-lg font-bold text-[#FFF9E3]">
              Total (cu livrare):{' '}
              {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(success.grandTotalLei)}{' '}
              {success.currency ?? 'RON'}
            </p>
          ) : null}
          <p className="assoc-body mt-4 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/95">
            Număr comandă: <span className="font-mono font-semibold">#{shortOrderLabel}</span>
          </p>
          {relatedOrderNumbers.length > 0 ? (
            <p className="assoc-body mt-2 text-xs leading-relaxed text-white/80">
              Comenzi asociate: {relatedOrderNumbers.join(', ')}
            </p>
          ) : null}
          <button
            type="button"
            onClick={downloadSummary}
            disabled={downloadingPdf}
            className="assoc-body mt-6 min-h-[52px] w-full max-w-xs rounded-[14px] border-2 border-white/40 bg-white/15 px-6 py-3 text-base font-bold text-[#FFF9E3] backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-wait disabled:opacity-70"
            style={{
              boxShadow: '0 10px 28px rgba(8, 47, 31, 0.16)',
            }}
          >
            {downloadingPdf ? '⏳ Se generează...' : '📄 Descarcă confirmare PDF'}
          </button>
          <button
            type="button"
            onClick={onBackToShop}
            className="assoc-body mt-4 min-h-[52px] w-full max-w-xs rounded-full border-2 border-[#FFF9E3] bg-[#FFF9E3] px-8 py-3.5 text-base font-bold text-[#0D6342] shadow-lg transition hover:bg-white active:scale-[0.98] sm:text-lg"
          >
            Înapoi la magazin
          </button>
        </div>
      </div>
    </div>
  )
}
