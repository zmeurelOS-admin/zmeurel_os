import { addDays, endOfDay, startOfDay, subDays } from 'date-fns'

import { HubTratamenteClient } from '@/components/tratamente/HubTratamenteClient'
import {
  getStatisticiAplicariCrossParcel,
  listAplicariCrossParcelPentruInterval,
  listInterventiiRelevanteHub,
  listParceleTratamenteSelector,
  listProduseFitosanitare,
} from '@/lib/supabase/queries/tratamente'

export default async function TratamenteHubPage() {
  const today = startOfDay(new Date())
  const intervalStart = startOfDay(subDays(today, 30))
  const intervalEnd = endOfDay(addDays(today, 7))

  const [aplicari, statistici, produseFitosanitare, parceleSelector, interventiiRelevante] = await Promise.all([
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
  ])

  return (
    <HubTratamenteClient
      initialAplicari={aplicari}
      initialStatistici={statistici}
      produseFitosanitare={produseFitosanitare}
      parceleSelector={parceleSelector}
      interventiiRelevante={interventiiRelevante}
    />
  )
}
