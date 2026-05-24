import { addDays, endOfDay, startOfDay, subDays } from 'date-fns'

import { HubTratamenteClient } from '@/components/tratamente/HubTratamenteClient'
import {
  getStatisticiAplicariCrossParcel,
  getSugestieAstazi,
  listJurnalAplicari,
  listAplicariCrossParcelPentruInterval,
  listInterventiiRelevanteHub,
  listPlanuriTratament,
  listParceleTratamenteSelector,
  listProduseFitosanitare,
} from '@/lib/supabase/queries/tratamente'

export default async function TratamenteHubPage() {
  const today = startOfDay(new Date())
  const intervalStart = startOfDay(subDays(today, 30))
  const intervalEnd = endOfDay(addDays(today, 7))

  const [
    aplicari,
    statistici,
    produseFitosanitare,
    parceleSelector,
    interventiiRelevante,
    jurnalAplicari,
    sugestieAstazi,
    planuriActive,
  ] = await Promise.all([
    listAplicariCrossParcelPentruInterval({
      dataStart: intervalStart,
      dataEnd: intervalEnd,
    }),
    getStatisticiAplicariCrossParcel({
      dataStart: intervalStart,
      dataEnd: intervalEnd,
    }),
    listProduseFitosanitare({ activ: true }),
    listParceleTratamenteSelector(),
    listInterventiiRelevanteHub(today.getFullYear()),
    listJurnalAplicari({ limit: 10 }),
    getSugestieAstazi(),
    listPlanuriTratament({ activ: true }),
  ])

  return (
    <HubTratamenteClient
      initialAplicari={aplicari}
      initialStatistici={statistici}
      produseFitosanitare={produseFitosanitare}
      parceleSelector={parceleSelector}
      interventiiRelevante={interventiiRelevante}
      jurnalAplicari={jurnalAplicari}
      sugestieAstazi={sugestieAstazi}
      planuriActive={planuriActive}
    />
  )
}
