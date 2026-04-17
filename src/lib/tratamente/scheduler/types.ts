export interface AplicarePlanificataNotif {
  aplicareId: string
  parcelaId: string
  parcelaNume: string
  produsNume: string
  dataPlanificata: string
  zileRamase: 0 | 1
  doza: string | null
}

export interface SchedulerResult {
  tenantId: string
  azi: AplicarePlanificataNotif[]
  maine: AplicarePlanificataNotif[]
}

