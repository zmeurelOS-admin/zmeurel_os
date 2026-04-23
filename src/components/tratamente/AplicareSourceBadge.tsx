import { cn } from '@/lib/utils'

type AplicareSource = 'din_plan' | 'manuala'

export function AplicareSourceBadge({ source }: { source: string | null | undefined }) {
  const normalizedSource: AplicareSource = source === 'manuala' ? 'manuala' : 'din_plan'
  const label = normalizedSource === 'manuala' ? 'Manuală' : 'Din plan'
  const toneClass =
    normalizedSource === 'manuala'
      ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
      : 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClass
      )}
    >
      {label}
    </span>
  )
}
