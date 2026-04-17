export interface PhiGuardInput {
  parcelaId: string
  dataRecoltareEstimata: string | Date
}

export interface PhiConflict {
  aplicareId: string
  produsNume: string
  dataAplicata: string
  phiZile: number
  phiDeadline: string
  zilelamasepotDelay: number
}

export interface PhiGuardResult {
  safe: boolean
  earliestSafeDate: string | null
  conflicts: PhiConflict[]
  mesaj: string
}

