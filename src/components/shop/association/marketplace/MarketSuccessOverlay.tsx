'use client'

import { M, PX } from './marketTokens'

import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import type { GustCheckoutSuccess } from '@/components/shop/association/cart/gustCartTypes'
import { GUSTA_MERCHANT_LEGAL_NAME_DEFAULT } from '@/lib/shop/association/brand-config'
import {
  buildOrderSummaryHtml,
  openOrderSummaryPrint,
  type OrderSummaryPrintPayload,
} from '@/lib/shop/association/order-summary-print'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'

type Props = {
  success: GustCheckoutSuccess
  publicSettings: AssociationPublicSettings
  onBackToShop: () => void
}

/* DRAFT_LEGAL_REVIEW — de revizuit cu avocat — mesaje post-comandă + confirmare tip document */
export function MarketSuccessOverlay({ success, publicSettings, onBackToShop }: Props) {
  const merchantResolved = resolveMerchantPublicInfo(publicSettings)
  const merchant = merchantResolved.legalName?.trim() || GUSTA_MERCHANT_LEGAL_NAME_DEFAULT
  const orderId = success.orderIds.join(', ')

  const downloadSummary = () => {
    const payload: OrderSummaryPrintPayload = {
      orderIds: success.orderIds,
      placedAtLabel: success.placedAtLabel,
      merchantLegalName: merchant,
      merchantAddress: merchantResolved.headquarters,
      merchantEmail: merchantResolved.email,
      merchantPhone: merchantResolved.phone,
      clientName: success.clientName,
      clientPhone: success.clientTelefon,
      clientAddress: success.clientLocatie,
      lines: success.summaryLines,
      productsSubtotalLei: success.totalLei,
      deliveryFeeLei: success.deliveryFeeLei,
      grandTotalLei: success.grandTotalLei,
      deliveryDateLabel: success.deliveryDateLabel,
      currency: success.currency,
      whatsappConsent: success.whatsappConsent,
    }
    openOrderSummaryPrint(buildOrderSummaryHtml(payload))
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
          {success.whatsappConsent ? (
            <p className="assoc-body mt-3 text-sm leading-relaxed text-white/90">
              Vei fi contactat pe WhatsApp la numărul {success.clientTelefon.trim()} pentru confirmarea și
              coordonarea comenzii.
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
            {orderId.includes(',') ? 'ID-uri comandă' : 'ID comandă'}:{' '}
            <span className="font-mono font-semibold">{orderId}</span>
          </p>
          <button
            type="button"
            onClick={downloadSummary}
            className="assoc-body mt-6 min-h-[52px] w-full max-w-xs rounded-full border-2 border-white/40 bg-white/15 px-6 py-3 text-base font-bold text-[#FFF9E3] backdrop-blur-sm transition hover:bg-white/25"
          >
            📥 Descarcă rezumatul comenzii (print / PDF)
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
