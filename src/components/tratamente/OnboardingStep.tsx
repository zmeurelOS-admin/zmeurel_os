import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type OnboardingStepStatus = 'completed' | 'active' | 'pending'

interface OnboardingStepProps {
  step: 1 | 2 | 3
  label: string
  status: OnboardingStepStatus
  description?: string
  ctaHref?: string
  ctaLabel?: string
}

const STATUS_STYLES: Record<OnboardingStepStatus, string> = {
  completed:
    'border-[color:color-mix(in_srgb,var(--agri-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,var(--surface-card))] text-[var(--agri-primary)]',
  active:
    'border-[color:color-mix(in_srgb,var(--agri-primary)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_4%,var(--surface-card))] text-[var(--text-primary)]',
  pending:
    'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]',
}

export function OnboardingStep({
  step,
  label,
  status,
  description,
  ctaHref,
  ctaLabel,
}: OnboardingStepProps) {
  const Icon = status === 'completed' ? CheckCircle2 : Circle

  return (
    <div
      className={`rounded-2xl border px-4 py-3 shadow-[var(--shadow-soft)] transition ${STATUS_STYLES[status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,currentColor_10%,transparent)] text-sm [font-weight:750]">
            {step}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm [font-weight:650]">{label}</p>
            </div>
            {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
          </div>
        </div>

        {status === 'active' && ctaHref && ctaLabel ? (
          <Button asChild size="sm" className="shrink-0 bg-[var(--agri-primary)] text-white">
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
