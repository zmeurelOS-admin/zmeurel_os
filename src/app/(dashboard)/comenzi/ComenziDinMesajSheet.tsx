'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/ui/toast'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { ClientTip } from '@/lib/supabase/queries/clienti'

export type ParsedOrder = {
  nume: string | null
  telefon: string | null
  cantitate_kg: number | null
  localitate: string | null
  data_livrare: string | null
  tip_client: ClientTip
  observatii: string | null
  incredere: 'mare' | 'medie' | 'mica'
}

type ClientFound = {
  client_id: string
  nume_client: string
  adresa: string | null
  tip: ClientTip
}

type ComenziDinMesajSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComandaCreata?: (comandaId: string, clientNou: ParsedOrder | null) => void
}

const CLIENT_TIP_LABELS: Record<ClientTip, string> = {
  standard: 'standard',
  patiserie: 'patiserie',
  magazin: 'magazin',
}

function normalizeClientTip(value: string | null | undefined): ClientTip {
  return value === 'patiserie' || value === 'magazin' ? value : 'standard'
}

function badgeVariantForTip(tip: ClientTip): 'secondary' | 'warning' | 'info' {
  if (tip === 'patiserie') return 'warning'
  if (tip === 'magazin') return 'info'
  return 'secondary'
}

function formatDeliveryDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function fallbackValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function cleanPhone(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/\D/g, '')
  return cleaned || null
}

export function ComenziDinMesajSheet({
  open,
  onOpenChange,
  onComandaCreata,
}: ComenziDinMesajSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mesaj, setMesaj] = useState('')
  const [parsed, setParsed] = useState<ParsedOrder | null>(null)
  const [clientFound, setClientFound] = useState<ClientFound | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const canCreate = useMemo(() => Boolean(parsed), [parsed])

  const resetResult = () => {
    setParsed(null)
    setClientFound(null)
    setLookupDone(false)
  }

  const lookupClient = async (result: ParsedOrder) => {
    setLookupDone(false)
    setClientFound(null)

    try {
      const supabase = getSupabase()
      const tenantId = await getTenantId(supabase)
      const phone = cleanPhone(result.telefon)

      let query = supabase
        .from('clienti')
        .select('id,nume_client,adresa,tip')
        .eq('tenant_id', tenantId)
        .limit(1)

      if (phone) {
        query = query.eq('telefon', phone)
      } else if (result.nume?.trim()) {
        query = query.ilike('nume_client', `%${result.nume.trim()}%`)
      } else {
        setLookupDone(true)
        return
      }

      const { data, error } = await query
      if (error) throw error

      const first = data?.[0]
      if (first) {
        setClientFound({
          client_id: first.id,
          nume_client: first.nume_client,
          adresa: first.adresa ?? null,
          tip: normalizeClientTip(first.tip),
        })
      }
    } catch (error) {
      console.error('[parse-order] Nu am putut căuta clientul.', error)
      toast.warning('Datele au fost extrase, dar clientul nu a putut fi verificat.')
    } finally {
      setLookupDone(true)
    }
  }

  const handleParse = async () => {
    const text = mesaj.trim()
    if (!text) {
      toast.error('Lipește mesajul clientului înainte de extragere.')
      return
    }

    setLoading(true)
    resetResult()

    try {
      const response = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await response.json()

      if (!response.ok) {
        const message = json?.error?.message ?? json?.error ?? 'Nu am putut extrage datele.'
        throw new Error(message)
      }

      const result: ParsedOrder = {
        nume: typeof json.nume === 'string' ? json.nume : null,
        telefon: cleanPhone(typeof json.telefon === 'string' ? json.telefon : null),
        cantitate_kg: typeof json.cantitate_kg === 'number' ? json.cantitate_kg : null,
        localitate: typeof json.localitate === 'string' ? json.localitate : null,
        data_livrare: typeof json.data_livrare === 'string' ? json.data_livrare : null,
        tip_client: normalizeClientTip(json.tip_client),
        observatii: typeof json.observatii === 'string' ? json.observatii : null,
        incredere: json.incredere === 'mare' || json.incredere === 'medie' || json.incredere === 'mica'
          ? json.incredere
          : 'medie',
      }

      setParsed(result)
      await lookupClient(result)
    } catch (error) {
      console.error('[parse-order] Extragerea datelor a eșuat.', error)
      toast.error(error instanceof Error ? error.message : 'Nu am putut extrage datele.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrder = () => {
    if (!parsed) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    nextParams.delete('edit')
    nextParams.set('openForm', '1')

    if (clientFound) {
      nextParams.set('client_id', clientFound.client_id)
      nextParams.set('client_label', clientFound.nume_client)
    } else if (parsed.nume) {
      nextParams.set('nume_client', parsed.nume)
      nextParams.set('client_label', parsed.nume)
    }

    if (parsed.telefon) nextParams.set('telefon', parsed.telefon)
    if (parsed.localitate) nextParams.set('locatie_livrare', parsed.localitate)
    if (parsed.data_livrare) nextParams.set('data_livrare', parsed.data_livrare)
    if (typeof parsed.cantitate_kg === 'number') {
      nextParams.set('cantitate_kg', String(parsed.cantitate_kg))
    }
    if (parsed.observatii) nextParams.set('observatii', parsed.observatii)

    onComandaCreata?.('', clientFound ? null : parsed)
    onOpenChange(false)
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92svh] pb-0">
        <SheetHeader>
          <SheetTitle>Din mesaj</SheetTitle>
          <SheetDescription>
            Lipește mesajul clientului și extrage automat datele pentru comandă.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4 sm:px-5">
          <Textarea
            rows={5}
            value={mesaj}
            onChange={(event) => {
              setMesaj(event.target.value)
              resetResult()
            }}
            placeholder="Lipește mesajul clientului (WhatsApp, SMS, orice...)"
            className="agri-control min-h-32"
          />

          <Button
            type="button"
            className="h-11 w-full"
            onClick={handleParse}
            disabled={loading || !mesaj.trim()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {loading ? 'Se extrag datele...' : '🔍 Extrage datele'}
          </Button>

          {parsed ? (
            <div className="space-y-3 rounded-2xl bg-[var(--surface-card-muted)] p-3 shadow-[var(--shadow-sm)]">
              <PreviewRow label="👤 Nume" value={fallbackValue(parsed.nume)} />
              <PreviewRow label="📞 Telefon" value={fallbackValue(parsed.telefon)} />
              <PreviewRow
                label="🍓 Cantitate"
                value={typeof parsed.cantitate_kg === 'number' ? `${parsed.cantitate_kg} kg` : '—'}
              />
              <PreviewRow label="📍 Localitate" value={fallbackValue(parsed.localitate)} />
              <PreviewRow label="📅 Dată livrare" value={formatDeliveryDate(parsed.data_livrare)} />
              <PreviewRow label="💬 Observații" value={fallbackValue(parsed.observatii)} />
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">🏪 Tip client</span>
                <ClientTipBadge tip={parsed.tip_client} />
              </div>
            </div>
          ) : null}

          {parsed && lookupDone ? (
            clientFound ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-[var(--status-success-text)]">
                  ✓ {clientFound.nume_client} găsit
                </span>
                <ClientTipBadge tip={clientFound.tip} />
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]">
                Client nou · va fi salvat automat după creare
              </div>
            )
          ) : null}
        </div>

        <SheetFooter className="sticky bottom-0">
          <Button type="button" className="h-11 w-full" disabled={!canCreate} onClick={handleCreateOrder}>
            ✓ Creează comanda
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ClientTipBadge({ tip }: { tip: ClientTip }) {
  return (
    <Badge variant={badgeVariantForTip(tip)} className="shrink-0">
      {CLIENT_TIP_LABELS[tip]}
    </Badge>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="max-w-[58%] text-right font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  )
}
