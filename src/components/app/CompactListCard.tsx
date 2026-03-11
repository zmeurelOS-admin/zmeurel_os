'use client'

import { ActionIcons } from '@/components/app/ActionIcons'
import { CardLeftColumn, CardRightColumn } from '@/components/app/BaseCard'
import { useDensity } from '@/components/app/DensityProvider'
import { ListCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

export interface CompactCardRow {
  label: React.ReactNode
  value?: React.ReactNode
  emphasis?: 'primary' | 'financial'
  allowWrap?: boolean
  valueClassName?: string
  forceSingleLine?: boolean
  rowClassName?: string
}

interface CompactListCardProps {
  leftRows?: CompactCardRow[]
  rightRows?: CompactCardRow[]
  title: React.ReactNode
  subtitle?: React.ReactNode
  metadata?: React.ReactNode
  status?: React.ReactNode
  trailingMeta?: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
  borderTone?: 'default' | 'danger' | 'warning'
  cornerBadge?: React.ReactNode
  className?: string
  onClick?: () => void
}

function CardRow({
  label,
  value,
  emphasis = 'primary',
  allowWrap = false,
  valueClassName,
  forceSingleLine = false,
  rowClassName,
}: CompactCardRow) {
  if (value === undefined || value === null || value === '') return null

  return (
    <div className={cn('space-y-0.5 sm:space-y-1 lg:text-left', rowClassName)}>
      <p className="truncate overflow-hidden whitespace-nowrap text-sm leading-tight text-muted-foreground sm:text-sm">{label}</p>
      <div
        className={cn(
          'text-base leading-tight text-[var(--agri-text)] sm:text-base sm:leading-normal',
          emphasis === 'financial' ? 'font-semibold' : 'font-medium',
          forceSingleLine || !allowWrap ? 'truncate overflow-hidden whitespace-nowrap' : 'break-words',
          valueClassName
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function CompactListCard({
  leftRows,
  rightRows,
  title,
  subtitle,
  metadata,
  status,
  trailingMeta,
  onEdit,
  onDelete,
  borderTone = 'default',
  cornerBadge,
  className,
  onClick,
}: CompactListCardProps) {
  const { density } = useDensity()
  const contentDensity = density === 'compact' ? 'space-y-1 sm:space-y-2.5' : 'space-y-1.5 sm:space-y-2.5'
  const computedLeftRows = (leftRows ?? [
    { label: 'Titlu', value: title, emphasis: 'primary' as const },
    subtitle !== undefined ? { label: 'Detalii', value: subtitle, emphasis: 'primary' as const } : null,
    metadata !== undefined ? { label: 'Informatii', value: metadata, emphasis: 'primary' as const } : null,
  ].filter(Boolean) as CompactCardRow[]).slice(0, 4)
  const computedRightRows = (rightRows ?? [
    status !== undefined ? { label: 'Status', value: status, emphasis: 'primary' as const, allowWrap: true } : null,
    trailingMeta !== undefined ? { label: 'Valoare', value: trailingMeta, emphasis: 'financial' as const } : null,
  ].filter(Boolean) as CompactCardRow[]).slice(0, 4)

  return (
    <ListCard
      className={cn(
        'relative min-h-[146px] sm:min-h-[208px] lg:min-h-[208px] lg:text-left',
        borderTone === 'danger' && 'border-red-500',
        borderTone === 'warning' && 'border-amber-400',
        className
      )}
      onClick={onClick}
    >
      <ActionIcons onEdit={onEdit} onDelete={onDelete} />

      <div className="grid grid-cols-2 gap-1.5 pr-14 pt-6 sm:gap-3 sm:pr-16 sm:pt-6 lg:gap-4 lg:pr-14 lg:pt-6">
        <CardLeftColumn className={contentDensity}>
          {computedLeftRows.map((row, index) => (
            <CardRow key={`left-${index}`} {...row} forceSingleLine={row.forceSingleLine ?? true} />
          ))}
        </CardLeftColumn>

        <CardRightColumn className={contentDensity}>
          {computedRightRows.map((row, index) => (
            <CardRow key={`right-${index}`} {...row} forceSingleLine={row.forceSingleLine ?? true} />
          ))}
        </CardRightColumn>
      </div>

      {cornerBadge ? (
        <div className="absolute right-3 bottom-3">{cornerBadge}</div>
      ) : null}
    </ListCard>
  )
}
