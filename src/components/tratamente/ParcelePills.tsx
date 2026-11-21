'use client'

import { FilterPills } from '@/components/kit'
import type { ParcelaFormular } from '@/lib/tratamente/formular'

/** Parcelele ca pastile bifabile („Unde”). */
export function ParcelePills({
  parcele,
  value,
  onChange,
}: {
  parcele: readonly ParcelaFormular[]
  value: readonly string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <FilterPills
      multiple
      wrap
      aria-label="Parcelele tratate"
      options={parcele.map((parcela) => ({ value: parcela.id, label: parcela.nume_parcela?.trim() || 'Parcelă fără nume' }))}
      value={value}
      onValueChange={onChange}
    />
  )
}
