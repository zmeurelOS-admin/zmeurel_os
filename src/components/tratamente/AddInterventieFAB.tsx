'use client'

import type { ComponentProps } from 'react'

import { useParcelaInterventieSheets, type MarkAplicataSheetManualProps } from './useParcelaInterventieSheets'

export type AddInterventieFABProps = {
  parcelaId?: string
  parcele?: Array<{ id: string; nume_parcela: string; suprafata_ha: number | null }>
  fenofazaCurenta?: string | null
  className?: string
  hideFab?: boolean
  markAplicataProps: MarkAplicataSheetManualProps
}

export function AddInterventieFAB({
  parcelaId,
  parcele = [],
  fenofazaCurenta = null,
  className,
  hideFab = false,
  markAplicataProps,
}: AddInterventieFABProps) {
  const { renderFab, renderSheets } = useParcelaInterventieSheets({
    parcelaId,
    parcele,
    fenofazaCurenta,
    markAplicataProps,
  })

  return (
    <>
      {!hideFab ? renderFab(className) : null}
      {renderSheets()}
    </>
  )
}

export type { MarkAplicataSheetManualProps } from './useParcelaInterventieSheets'
