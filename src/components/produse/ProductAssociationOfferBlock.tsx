'use client'

import { useCallback, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProductOfferUiState } from '@/lib/association/offer-queries'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

type Props = {
  productId: string
  productName: string
  pretUnitar: number | null
  moneda: string
  unitate: string
  status: 'activ' | 'inactiv'
  associationShopApproved: boolean
  offerState: ProductOfferUiState
  /** Rând compact în tabel (fără chenar). */
  variant?: 'block' | 'inline'
  onChanged: () => void
}

function parsePrice(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function ProductAssociationOfferBlock({
  productId,
  productName,
  pretUnitar,
  moneda,
  unitate,
  status,
  associationShopApproved,
  offerState,
  variant = 'block',
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [suggested, setSuggested] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const defaultSuggested = useMemo(() => {
    if (pretUnitar != null) return pretUnitar.toFixed(2)
    return ''
  }, [pretUnitar])

  const openDialog = useCallback(() => {
    setSuggested(defaultSuggested)
    setMsg('')
    setOpen(true)
  }, [defaultSuggested])

  const canShowAssociationUi = associationShopApproved

  const canSend =
    canShowAssociationUi &&
    status === 'activ' &&
    (offerState.kind === 'none' || offerState.kind === 'respinsa' || offerState.kind === 'retrasa')

  const submitOffer = useCallback(async () => {
    const sp = parsePrice(suggested)
    if (sp == null) {
      toast.error('Introdu un preț sugerat valid.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/association/offers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          suggestedPrice: sp,
          message: msg.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const m = json && typeof json === 'object' && json.error?.message
        toast.error(typeof m === 'string' ? m : 'Nu am putut trimite oferta.')
        return
      }
      toast.success('Oferta a fost trimisă către asociație.')
      setOpen(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [productId, suggested, msg, onChanged])

  const retract = useCallback(async () => {
    if (!offerState.offerId) return
    setBusy(true)
    try {
      const res = await fetch('/api/association/offers', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offerState.offerId }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const m = json && typeof json === 'object' && json.error?.message
        toast.error(typeof m === 'string' ? m : 'Nu am putut retrage oferta.')
        return
      }
      toast.success('Oferta a fost retrasă.')
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [offerState.offerId, onChanged])

  if (!canShowAssociationUi) {
    return null
  }

  const isInline = variant === 'inline'

  return (
    <div
      className={cn(
        'flex gap-2',
        isInline ? 'min-w-0 flex-col items-start sm:flex-row sm:items-center' : 'flex-col',
        !isInline && 'rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3'
      )}
    >
      {offerState.kind === 'trimisa' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warning-text)]">
            <span aria-hidden className="mr-1">
              📤
            </span>
            Trimis către asociație
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              void retract()
            }}
          >
            Retrage
          </Button>
        </div>
      ) : null}

      {offerState.kind === 'aprobata' ? (
        <span className="inline-flex w-fit items-center rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-success-text)]">
          <span aria-hidden className="mr-1">
            ✅
          </span>
          Listat în magazin (asociație)
        </span>
      ) : null}

      {offerState.kind === 'respinsa' ? (
        <span className="inline-flex w-fit items-center rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-danger-text)]">
          <span aria-hidden className="mr-1">
            ❌
          </span>
          Respinsă de asociație
        </span>
      ) : null}

      {offerState.kind === 'retrasa' ? (
        <span className="text-xs text-[var(--text-secondary)]">Ofertă retrasă. Poți trimite din nou.</span>
      ) : null}

      {canSend ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-fit shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            openDialog()
          }}
        >
          Trimite către asociație
        </Button>
      ) : null}

      {offerState.kind === 'blocked_inactiv' ? (
        <span className="text-xs text-[var(--text-secondary)]">Activează produsul pentru a trimite o ofertă.</span>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trimite ofertă către asociație</DialogTitle>
            <DialogDescription>
              Echipa Gustă din Bucovina va revizui oferta. Nu poți lista direct în magazinul asociației fără
              aprobare.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Produs</Label>
              <p className="text-sm font-medium text-[var(--text-primary)]">{productName}</p>
            </div>
            <div>
              <Label>Preț curent (fermă)</Label>
              <p className="text-sm text-[var(--text-primary)]">
                {pretUnitar != null ? `${pretUnitar.toFixed(2)} ${moneda} / ${unitate}` : '—'}
              </p>
            </div>
            <div>
              <Label htmlFor="assoc_sug">Preț sugerat pentru asociație ({moneda})</Label>
              <Input
                id="assoc_sug"
                inputMode="decimal"
                value={suggested}
                onChange={(e) => setSuggested(e.target.value)}
                placeholder={defaultSuggested || '0.00'}
              />
            </div>
            <div>
              <Label htmlFor="assoc_msg">Mesaj pentru asociație (opțional)</Label>
              <Textarea
                id="assoc_msg"
                rows={3}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Ex.: disponibilitate, ambalaj, livrare…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anulează
            </Button>
            <Button type="button" className="agri-cta" disabled={busy} onClick={() => void submitOffer()}>
              Trimite oferta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
