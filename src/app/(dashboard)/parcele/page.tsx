import { Suspense } from 'react'

import { ParceleListClient } from './ParceleListClient'

export default function ParcelePage() {
  return (
    <Suspense fallback={null}>
      <ParceleListClient />
    </Suspense>
  )
}
