import { Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

import { M } from './marketTokens'

export type FieldErrorKey = 'nume' | 'telefon' | 'locatie'

type Props = {
  cartGroupedByFarm: {
    tenantId: string
    farmName: string
    lines: { product: AssociationProduct; qty: number }[]
  }[]
  estimatedTotal: number
  nume: string
  setNume: (v: string) => void
  telefon: string
  setTelefon: (v: string) => void
  locatie: string
  setLocatie: (v: string) => void
  observatii: string
  setObservatii: (v: string) => void
  submitting: boolean
  onSubmit: () => void
  onClose: () => void
  /** Câmpuri marcate invalid după încercare de trimitere (validare vizibilă). */
  fieldErrors: Partial<Record<FieldErrorKey, boolean>>
}

function ringInvalid(active: boolean) {
  return active ? 'ring-2 ring-[#CF222E]/90 ring-offset-2' : ''
}

/**
 * Checkout — doar formular + rezumat; succesul este fullscreen separat.
 */
export function MarketCheckoutPanel({
  cartGroupedByFarm,
  estimatedTotal,
  nume,
  setNume,
  telefon,
  setTelefon,
  locatie,
  setLocatie,
  observatii,
  setObservatii,
  submitting,
  onSubmit,
  onClose,
  fieldErrors,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-5 pb-5 pt-6 sm:px-8" style={{ borderColor: M.border }}>
        <h2 className="assoc-heading text-left text-xl font-extrabold sm:text-2xl" style={{ color: M.green }}>
          Finalizează comanda
        </h2>
        <p className="assoc-body mt-2 max-w-md text-left text-sm leading-relaxed sm:text-base" style={{ color: M.muted }}>
          Completează datele de livrare — fără cont. Plată și detalii le stabilești cu fermierul.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <div
          className="mb-8 rounded-2xl border p-5 sm:p-6"
          style={{ backgroundColor: M.creamMid, borderColor: M.border }}
        >
          <p className="assoc-heading text-xs font-bold uppercase tracking-[0.12em]" style={{ color: M.green }}>
            Rezumat comandă
          </p>
          <div className="mt-4 space-y-5 text-sm">
            {cartGroupedByFarm.map((group) => (
              <div key={group.tenantId}>
                <p className="assoc-heading text-sm font-bold" style={{ color: M.green }}>
                  {group.farmName}
                </p>
                <ul className="mt-2 space-y-3 border-l-2 pl-4" style={{ borderColor: `${M.green}40` }}>
                  {group.lines.map(({ product: p, qty }) => {
                    const sub = Number(p.displayPrice) * qty
                    return (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span className="min-w-0">
                          <span className="font-semibold" style={{ color: M.text }}>
                            {p.nume}
                          </span>
                          <span className="assoc-body block text-xs" style={{ color: M.muted }}>
                            × {qty} {p.unitate_vanzare}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-bold" style={{ color: M.text }}>
                          {`${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(sub)} ${p.moneda}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div
            className="mt-6 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4"
            style={{ borderColor: M.border }}
          >
            <span className="assoc-heading text-base font-bold" style={{ color: M.text }}>
              Total estimativ
            </span>
            <span className="assoc-heading text-2xl font-extrabold tabular-nums" style={{ color: M.green }}>
              {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
                estimatedTotal,
              )}{' '}
              RON
            </span>
          </div>
          <p className="assoc-body mt-2 text-xs leading-relaxed" style={{ color: M.muted }}>
            Sumă orientativă; Asociația Gustă din Bucovina confirmă detaliile și prețul final la livrare.
          </p>
        </div>

        {cartGroupedByFarm.length > 1 ? (
          <div
            className="mb-8 rounded-2xl border p-4 sm:p-5"
            style={{ backgroundColor: 'rgba(13, 99, 66, 0.06)', borderColor: 'rgba(13, 99, 66, 0.22)' }}
          >
            <p className="assoc-heading text-sm font-bold" style={{ color: M.green }}>
              Mai mulți fermieri în coș
            </p>
            <p className="assoc-body mt-2 text-sm leading-relaxed" style={{ color: M.text }}>
              Comanda este transmisă producătorilor prin asociație; aceeași coordonare livrare și plată (cash) prin
              Asociația Gustă din Bucovina.
            </p>
          </div>
        ) : null}

        <form
          className="space-y-5 pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="assoc_nume" className="text-sm font-bold" style={{ color: M.text }}>
              Nume <span className="text-[#CF222E]">*</span>
            </Label>
            <Input
              id="assoc_nume"
              className={`h-12 rounded-xl border-2 text-base transition ${ringInvalid(!!fieldErrors.nume)}`}
              style={{ borderColor: fieldErrors.nume ? '#CF222E' : M.border, color: M.text }}
              value={nume}
              onChange={(e) => setNume(e.target.value)}
              autoComplete="name"
              aria-invalid={fieldErrors.nume}
            />
            {fieldErrors.nume ? (
              <p className="text-xs font-semibold text-[#CF222E]">Introdu numele (minim 2 caractere).</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc_tel" className="text-sm font-bold" style={{ color: M.text }}>
              Telefon <span className="text-[#CF222E]">*</span>
            </Label>
            <Input
              id="assoc_tel"
              type="tel"
              className={`h-12 rounded-xl border-2 text-base transition ${ringInvalid(!!fieldErrors.telefon)}`}
              style={{ borderColor: fieldErrors.telefon ? '#CF222E' : M.border, color: M.text }}
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              autoComplete="tel"
              aria-invalid={fieldErrors.telefon}
            />
            {fieldErrors.telefon ? (
              <p className="text-xs font-semibold text-[#CF222E]">Introdu un număr de telefon valid.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc_loc" className="text-sm font-bold" style={{ color: M.text }}>
              Localitate / adresă livrare <span className="text-[#CF222E]">*</span>
            </Label>
            <Textarea
              id="assoc_loc"
              className={`min-h-[100px] rounded-xl border-2 text-base transition ${ringInvalid(!!fieldErrors.locatie)}`}
              style={{ borderColor: fieldErrors.locatie ? '#CF222E' : M.border, color: M.text }}
              value={locatie}
              onChange={(e) => setLocatie(e.target.value)}
              placeholder="Ex.: Suceava, str. …"
              aria-invalid={fieldErrors.locatie}
            />
            {fieldErrors.locatie ? (
              <p className="text-xs font-semibold text-[#CF222E]">Introdu localitatea sau adresa (minim 3 caractere).</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc_obs" className="text-sm font-bold" style={{ color: M.text }}>
              Observații (opțional)
            </Label>
            <Textarea
              id="assoc_obs"
              className="min-h-[88px] rounded-xl border-2 text-base"
              style={{ borderColor: M.border, color: M.text }}
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              placeholder="Detalii despre livrare sau produse"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="assoc-body flex min-h-[52px] w-full items-center justify-center rounded-full text-base font-bold text-[#3D4543] shadow-lg transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-45 sm:text-lg"
            style={{ backgroundColor: M.orange, boxShadow: '0 8px 28px rgba(255, 158, 27, 0.4)' }}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
                <span>Se trimite comanda…</span>
              </>
            ) : (
              'Trimite comanda'
            )}
          </button>
          <button
            type="button"
            className="assoc-body w-full py-2 text-center text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: M.muted }}
            onClick={onClose}
          >
            Anulează
          </button>
        </form>
      </div>
    </div>
  )
}
