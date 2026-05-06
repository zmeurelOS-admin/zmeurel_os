'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WIZARD_STEP_LABELS = ['Verificare', 'Produse și doze', 'Detalii', 'Confirmare'] as const

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
    ? `${parcelaName} · Pas ${wizard.step + 1}/4 — ${WIZARD_STEP_LABELS[wizard.step] ?? ''}`
    : parcelaName

  if (wizard) {
    return (
      <CompactPageHeader
        title="Detaliu aplicare"
        subtitle={subtitle}
        showMobileRightSlot
        stackMobileRightSlotBelow
        rightSlot={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={wizard.draftDisabled}
            onClick={wizard.onSaveDraft}
          >
            Ciornă
          </Button>
        }
        summary={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={wizard.onBack}>
                <ArrowLeft className="h-4 w-4" />
                Înapoi
              </Button>
              <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href={backHref}>La hub tratamente</Link>
              </Button>
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
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
