import { addDays, endOfDay, startOfDay } from 'date-fns'

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
  const intervalEnd = endOfDay(addDays(today, 7))

  const [aplicari, statistici, produseFitosanitare, parceleSelector, interventiiRelevante] = await Promise.all([
    listAplicariCrossParcelPentruInterval({
      dataStart: today,
      dataEnd: intervalEnd,
    }),
    getStatisticiAplicariCrossParcel({
      dataStart: today,
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
