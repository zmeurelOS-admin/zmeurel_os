import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * „Activități agricole” s-a redenumit „Lucrări” (`/lucrari`). Legăturile vechi (inclusiv precompletările din
 * chatul AI: `?openForm=1&tip=…&parcela_id=…`) merg mai departe, cu toți parametrii păstrați.
 */
export default async function ActivitatiAgricoleRedirect({ searchParams }: PageProps) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else if (value !== undefined) query.append(key, value)
  }
  const text = query.toString()
  redirect(text ? `/lucrari?${text}` : '/lucrari')
}
