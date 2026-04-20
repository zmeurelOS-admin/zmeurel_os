import type { Cohorta } from '@/lib/tratamente/configurare-sezon'

export interface GeneratorInput {
  parcelaId: string
  an: number
  stadiuFiltru?: string
  offsetZile?: number
  dryRun?: boolean
}

export interface PropunereAplicare {
  linieId: string
  stadiuTrigger: string
  cohortTrigger?: Cohorta | null
  cohortLaAplicare?: Cohorta | null
  dataPlanificata: string
  produsId: string | null
  produsNumeManual: string | null
  dozaMlPerHl: number | null
  dozaLPerHa: number | null
  observatii: string | null
  motivSkip?: 'deja_existenta' | 'produs_lipsa_stoc' | 'phi_conflict_recoltare'
}

export interface GeneratorResult {
  propuneri: PropunereAplicare[]
  createdCount: number
  skippedCount: number
  dryRun: boolean
}

export interface PlanLinie {
  id: string
  planId?: string
  ordine?: number
  stadiuTrigger: string
  cohortTrigger?: Cohorta | null
  produsId: string | null
  produsNumeManual: string | null
  dozaMlPerHl: number | null
  dozaLPerHa: number | null
  observatii: string | null
}

export interface AplicareExistenta {
  id: string
  planLinieId: string | null
  status: string
}

export interface StadiuInregistrat {
  id?: string
  parcelaId?: string
  an?: number
  stadiu: string
  cohort?: Cohorta | null
  dataObservata: string
  sursa?: string
  observatii?: string | null
}

export interface LinieCuData extends PlanLinie {
  dataPlanificata: string
  cohortLaAplicare?: Cohorta | null
}
