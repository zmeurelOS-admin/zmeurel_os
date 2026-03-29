'use client'

import { useState } from 'react'

import { Investitie } from '@/lib/supabase/queries/investitii'

interface InvestitieCardProps {
  investitie: Investitie
  parcelaNume?: string
  onEdit: (investitie: Investitie) => void
  onDelete: (investitie: Investitie) => void
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function categoryEmoji(category: string | null | undefined): string {
  const value = normalizeText(category)
  if (value.includes('echip') || value.includes('utilaj')) return '🔧'
  if (value.includes('infra') || value.includes('solar') || value.includes('tunel') || value.includes('depoz')) return '🏗️'
  if (value.includes('saditor') || value.includes('butas')) return '🌿'
  return '📦'
}

export function InvestitieCard({ investitie, parcelaNume, onEdit, onDelete }: InvestitieCardProps) {
  const [expanded, setExpanded] = useState(false)
  const categorie = investitie.categorie || 'Altele'
  const emoji = categoryEmoji(categorie)
  const dataLabel = investitie.data ? new Date(investitie.data).toLocaleDateString('ro-RO') : '-'

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="w-full p-5 text-left"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--agri-surface-muted)] text-lg">
            {emoji}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="truncate text-sm font-semibold text-[var(--agri-text)]">
              {investitie.descriere || 'Investiție'}
            </div>
            <div className="truncate text-sm text-[var(--agri-text-muted)]">
              {[categorie, investitie.furnizor].filter(Boolean).join(' · ') || '-'}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-[var(--agri-text)]">{Number(investitie.suma_lei || 0).toFixed(0)} RON</div>
            <div className="text-[10px] text-[var(--agri-text-muted)]">{dataLabel}</div>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--surface-divider)] bg-[var(--agri-surface)] px-5 py-5">
          <div className="space-y-2 text-sm text-[var(--agri-text-muted)]">
            <div>
              <strong className="text-[var(--agri-text)]">Parcelă:</strong> {parcelaNume || '-'}
            </div>
            <div>
              <strong className="text-[var(--agri-text)]">Furnizor:</strong> {investitie.furnizor || '-'}
            </div>
            <div>
              <strong className="text-[var(--agri-text)]">Categorie:</strong> {categorie}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(investitie)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 text-sm font-semibold text-[var(--status-warning-text)]"
            >
              Editează
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(investitie)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-sm font-semibold text-[var(--status-danger-text)]"
            >
              Șterge
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
