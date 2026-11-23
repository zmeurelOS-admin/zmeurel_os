import { StartPageClient } from './StartPageClient'

/** /start: demo fără cont (întâi), cont nou (Google, email), „Am deja cont”. `?demo=1` deschide direct tipul de demo. */
export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  return <StartPageClient deschideDemo={params.demo === '1'} />
}
