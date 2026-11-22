import { ProdusMagazieClient } from './ProdusMagazieClient'

type PageProps = {
  params: Promise<{ produsId: string }>
}

/** Fișa unui produs din Magazie. */
export default async function ProdusMagaziePage({ params }: PageProps) {
  const { produsId } = await params
  return <ProdusMagazieClient produsId={decodeURIComponent(produsId ?? '').trim()} />
}
