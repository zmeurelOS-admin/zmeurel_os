'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WIZARD_STEP_LABELS = ['Aplică', 'Confirmă'] as const

export interface AplicareDetaliuHeaderProps {
  backHref: string
  parcelaName: string
  /** Wizard mobil: pas 0–3 și acțiuni dedicate. */
  wizard?: {
    step: number
    onBack: () => void
    onSaveDraft: () => void
    draftDisabled?: boolean
  } | null
}

export function AplicareDetaliuHeader({
  backHref,
  parcelaName,
  wizard,
}: AplicareDetaliuHeaderProps) {
  const subtitle = wizard
    ? `${parcelaName} · Pas ${wizard.step + 1}/2 — ${WIZARD_STEP_LABELS[wizard.step] ?? ''}`
    : parcelaName

  if (wizard) {
    return (
      <CompactPageHeader
        title="Detaliu aplicare"
        subtitle={subtitle}
        summary={
          <div className="flex h-10 items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={wizard.onBack}>
              <ArrowLeft className="h-4 w-4" />
              Înapoi
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden>
              {WIZARD_STEP_LABELS.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    index === wizard.step
                      ? 'bg-[var(--agri-primary)]'
                      : index < wizard.step
                        ? 'bg-[color:color-mix(in_srgb,var(--agri-primary)_45%,var(--border-muted))]'
                        : 'bg-[var(--surface-card-muted)]',
                  )}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0"
              disabled={wizard.draftDisabled}
              onClick={wizard.onSaveDraft}
            >
              Ciornă
            </Button>
          </div>
        }
      />
    )
  }

  return (
    <CompactPageHeader
      title="Detaliu aplicare"
      subtitle={subtitle}
      summary={
        <div className="flex items-center justify-start">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Înapoi la hub
            </Link>
          </Button>
        </div>
      }
    />
  )
}
