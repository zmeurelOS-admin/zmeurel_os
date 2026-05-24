import type { SelectorCapcanaActivaItem } from '@/components/tratamente/SelectorCapcaneActiveSheet'
import type { StageState } from '@/components/tratamente/StadiuCurentCard'
import type {
  AplicareTratamentDetaliu,
  InterventieRelevantaV2,
  PlanActivParcela,
  PlanTratamentLinieCuProdus,
  ProdusFitosanitar,
} from '@/lib/supabase/queries/tratamente'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

export type ParcelaTratamentePlansCollapsedProps = {
  an: number
  aplicateCount: number
  aplicariCount: number
  configurareSezon: ConfigurareSezon | null
  createPlanHref: string
  detailsHref: string | null
  dualStageState: { floricane: StageState; primocane: StageState } | null
  editPlanHref: string | null
  grupBiologic?: GrupBiologic | null
  interventiiRelevante: InterventieRelevantaV2[]
  isRubusMixt: boolean
  onAssignPlan: () => void
  onPlanificaInterventie: (interventie: InterventieRelevantaV2) => void
  onRecordStadiu: (cohort?: Cohorta) => void
  parcelaId: string
  planLinii: PlanTratamentLinieCuProdus[]
  planName: string | null
  pendingInterventieId: string | null
  planActiv: PlanActivParcela | null
  produseFitosanitare: ProdusFitosanitar[]
  singleStageState: StageState | null
  urmatoareleAplicari: AplicareTratamentDetaliu[]
}

export type ParcelaTratamenteMobileHubProps = ParcelaTratamentePlansCollapsedProps & {
  aplicariEfectuate: AplicareTratamentDetaliu[]
  capcaneActive: SelectorCapcanaActivaItem[]
  capcaneError: string | null
  capcaneLoading: boolean
  onApplyTreatment: () => void
  onMountCapcana: () => void
  onReloadCapcane: () => void
  onVerifyCapcana: () => void
  parcelaNume: string
}
