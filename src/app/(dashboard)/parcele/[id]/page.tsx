import { Suspense } from 'react'

import { ParcelaFisaClient } from './ParcelaFisaClient'

type PageProps = {
  params: Promise<{ id: string }>
}

/** Fișa parcelei (înainte era o redirecționare spre `/parcele?selected=…`; acum `?selected=` duce aici). */
export default async function ParcelaFisaPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={null}>
      <ParcelaFisaClient parcelaId={decodeURIComponent(id ?? '').trim()} />
    </Suspense>
  )
}
