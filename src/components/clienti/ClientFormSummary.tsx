'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface ClientFormSummaryProps {
  name?: string
  phone?: string
  email?: string
  address?: string
  negotiatedPrice?: string
  notes?: string
}

function clipText(value: string | undefined, max = 110): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  return current.length <= max ? current : `${current.slice(0, max)}...`
}

function formatNegotiatedPrice(value: string | undefined): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  const parsed = Number(current.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) return current
  return `${parsed.toLocaleString('ro-RO')} lei/kg`
}

export function ClientFormSummary({
  name,
  phone,
  email,
  address,
  negotiatedPrice,
  notes,
}: ClientFormSummaryProps) {
  return (
    <DesktopFormAside title="Rezumat client" className="md:rounded-[22px] md:p-3.5 lg:p-4">
      <dl className="space-y-1 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Nume</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{name?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{phone?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Email</dt>
          <dd className="mt-0.5 break-words text-[var(--text-primary)]">{email?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Preț negociat</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{formatNegotiatedPrice(negotiatedPrice)}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Adresă</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-[var(--text-primary)]">{clipText(address)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Observații</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-[var(--text-primary)]">{clipText(notes)}</dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
