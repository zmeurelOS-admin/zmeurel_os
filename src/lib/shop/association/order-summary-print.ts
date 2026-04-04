/** Rezumat comandă pentru print / „Descarcă” — confirmare electronică tip document (Legea 365/2002 orientativ). */

export type OrderSummaryPrintLine = {
  productName: string
  farmName: string
  qty: number
  unit: string
  unitPrice: number
  lineTotal: number
  currency: string
}

export type OrderSummaryPrintPayload = {
  orderIds: string[]
  placedAtLabel: string
  merchantLegalName: string
  merchantAddress?: string | null
  merchantEmail?: string | null
  merchantPhone?: string | null
  clientName: string
  clientPhone: string
  clientAddress: string
  lines: OrderSummaryPrintLine[]
  productsSubtotalLei: number
  deliveryFeeLei: number
  grandTotalLei: number
  deliveryDateLabel: string
  currency: string
  whatsappConsent: boolean
}

export function buildOrderSummaryHtml(p: OrderSummaryPrintPayload): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
  const rows = p.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.productName)}</td><td>${escapeHtml(l.farmName)}</td><td>${fmt(l.qty)} ${escapeHtml(l.unit)}</td><td>${fmt(l.unitPrice)} ${escapeHtml(l.currency)}</td><td>${fmt(l.lineTotal)} ${escapeHtml(l.currency)}</td></tr>`,
    )
    .join('')
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"/><title>Rezumat comandă</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#222}
h1{font-size:18px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
th,td{border:1px solid #ccc;padding:8px;text-align:left}
th{background:#f5f5f5}
.meta{font-size:13px;line-height:1.5}
.footer{margin-top:20px;font-size:12px;color:#444}
</style></head><body>
<h1>Rezumat comandă</h1>
<p class="meta"><strong>Număr comandă:</strong> ${escapeHtml(p.orderIds.join(', '))}<br/>
<strong>Data și ora plasării:</strong> ${escapeHtml(p.placedAtLabel)}</p>
<p class="meta"><strong>Comerciant:</strong> ${escapeHtml(p.merchantLegalName)}<br/>
${p.merchantAddress ? `${escapeHtml(p.merchantAddress)}<br/>` : ''}
${p.merchantEmail ? `Email: ${escapeHtml(p.merchantEmail)}<br/>` : ''}
${p.merchantPhone ? `Telefon: ${escapeHtml(p.merchantPhone)}<br/>` : ''}
</p>
<table><thead><tr><th>Produs</th><th>Producător</th><th>Cant.</th><th>Preț unitar</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
<p class="meta"><strong>Subtotal produse:</strong> ${fmt(p.productsSubtotalLei)} ${escapeHtml(p.currency)}<br/>
<strong>Cost livrare:</strong> ${fmt(p.deliveryFeeLei)} ${escapeHtml(p.currency)}<br/>
<strong>Total:</strong> ${fmt(p.grandTotalLei)} ${escapeHtml(p.currency)}<br/>
<strong>Livrare estimată:</strong> ${escapeHtml(p.deliveryDateLabel)}<br/>
<strong>Metodă plată:</strong> Cash la livrare</p>
<p class="meta"><strong>Date client:</strong><br/>
Nume: ${escapeHtml(p.clientName)}<br/>
Telefon: ${escapeHtml(p.clientPhone)}<br/>
Adresă / localitate: ${escapeHtml(p.clientAddress)}<br/>
Contact WhatsApp la numărul indicat: ${p.whatsappConsent ? 'da (consimțământ)' : 'nu'}</p>
<p class="footer">Comanda va fi confirmată de ${escapeHtml(p.merchantLegalName)}. Platforma Zmeurel OS (zmeurel.ro) este furnizor tehnic; contractul de vânzare se încheie cu comerciantul.</p>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function openOrderSummaryPrint(html: string): void {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  const printIt = () => {
    try {
      w.focus()
      w.print()
    } catch {
      /* ignore */
    }
  }
  w.onload = printIt
  window.setTimeout(printIt, 400)
}
