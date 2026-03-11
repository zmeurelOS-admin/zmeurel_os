'use client'

import { CompactListCard } from '@/components/app/CompactListCard'
import { SyncBadge } from '@/components/app/SyncBadge'
import { Badge } from '@/components/ui/badge'
import { computeActivityRemainingDays, getPauseVisualTone } from '@/lib/parcele/pauza'
import { ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'

interface ActivitateAgricolaCardProps {
  activitate: ActivitateAgricola
  parcelaNume?: string
  onEdit: (activitate: ActivitateAgricola) => void
  onDelete: (activitate: ActivitateAgricola) => void
}

export function ActivitateAgricolaCard({ activitate, parcelaNume, onEdit, onDelete }: ActivitateAgricolaCardProps) {
  const remainingDays = computeActivityRemainingDays(activitate)
  const pauseTone = getPauseVisualTone(remainingDays)
  const hasActivePause = remainingDays > 0

  return (
    <CompactListCard
      title={activitate.tip_activitate || 'Activitate'}
      borderTone={pauseTone}
      cornerBadge={
        hasActivePause ? (
          <div className="sm:hidden inline-flex rounded-md border border-red-500 bg-white px-2 py-1 text-xs font-semibold text-red-700">
            {remainingDays} zile
          </div>
        ) : null
      }
      leftRows={[
        { label: 'Activitate', value: activitate.tip_activitate || 'Nespecificata' },
        { label: 'Data', value: new Date(activitate.data_aplicare).toLocaleDateString('ro-RO') },
        { label: 'Parcelă', value: parcelaNume || 'Nespecificat' },
        { label: 'Produs / doza', value: `${activitate.produs_utilizat || '-'} - ${activitate.doza || '-'}` },
      ]}
      rightRows={[
        ...(hasActivePause
          ? [
              {
                label: 'Pauză activa',
                value: (
                  <Badge className={pauseTone === 'warning' ? 'badge-consistent bg-amber-500 text-white' : 'badge-consistent bg-red-600 text-white'}>
                    Pauză activa
                  </Badge>
                ),
                allowWrap: true,
                rowClassName: 'sm:hidden',
              },
            ]
          : []),
        {
          label: 'Sync',
          value: <div className="badge-consistent inline-flex"><SyncBadge status={activitate.sync_status} /></div>,
          allowWrap: true,
          rowClassName: 'hidden sm:block',
        },
        { label: 'Pauză', value: `${activitate.timp_pauza_zile || 0} zile`, rowClassName: 'hidden sm:block' },
        { label: 'Ramase', value: `${remainingDays} zile`, emphasis: 'financial', rowClassName: 'hidden sm:block' },
      ]}
      onEdit={() => onEdit(activitate)}
      onDelete={() => onDelete(activitate)}
    />
  )
}
