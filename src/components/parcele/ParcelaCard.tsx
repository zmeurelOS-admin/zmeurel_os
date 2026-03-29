'use client'

import { CompactListCard } from '@/components/app/CompactListCard'
import { Badge } from '@/components/ui/badge'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import { formatM2ToHa } from '@/lib/utils/area'

interface ParcelaCardProps {
  parcela: Parcela
  onEdit: () => void
  onDelete: () => void
}

function getUnitateBadge(tipUnitate: string | null | undefined): { label: string; className: string } {
  const value = (tipUnitate ?? 'camp').toLowerCase()
  if (value === 'solar') {
    return {
      label: 'Solar',
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    }
  }
  if (value === 'livada') {
    return {
      label: 'Livada',
      className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    }
  }
  return {
    label: 'Camp',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-green-700 dark:bg-green-900/50 dark:text-green-400',
  }
}

export function ParcelaCard({ parcela, onEdit, onDelete }: ParcelaCardProps) {
  const unitate = getUnitateBadge(parcela.tip_unitate)

  return (
    <CompactListCard
      className="transition-opacity active:opacity-95"
      title={parcela.nume_parcela || 'Teren'}
      leftRows={[
        { label: 'Teren', value: parcela.nume_parcela || 'Teren' },
        { label: 'Tip cultura', value: parcela.tip_fruct || '-' },
        { label: 'Soi', value: parcela.soi_plantat || parcela.soi || '-' },
      ]}
      rightRows={[
        { label: 'An plantare', value: parcela.an_plantare || '-' },
        { label: 'Nr plante', value: parcela.nr_plante || '-' },
        { label: 'Suprafata', value: formatM2ToHa(parcela.suprafata_m2), emphasis: 'financial' },
        { label: 'Status REI', value: 'Date indisponibile' },
      ]}
      cornerBadge={<Badge variant="outline" className={unitate.className}>{unitate.label}</Badge>}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}
