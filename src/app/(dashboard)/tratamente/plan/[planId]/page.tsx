import { PlanIntregClient } from './PlanIntregClient'

type PageProps = {
  params: Promise<{ planId: string }>
}

/** „Planul întreg”: liniile pe stadii, cu starea pe an, parcelele și excepțiile. */
export default async function PlanIntregPage({ params }: PageProps) {
  const { planId } = await params
  return <PlanIntregClient planId={decodeURIComponent(planId ?? '').trim()} />
}
