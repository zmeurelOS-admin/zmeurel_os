import { GrupCapcaneClient } from './GrupCapcaneClient'

type PageProps = {
  params: Promise<{ grupId: string }>
}

/** Fișa unui grup de capcane: graficul pe săptămâni, tratamentele parcelei, verificările. */
export default async function GrupCapcanePage({ params }: PageProps) {
  const { grupId } = await params
  return <GrupCapcaneClient grupId={decodeURIComponent(grupId ?? '').trim()} />
}
