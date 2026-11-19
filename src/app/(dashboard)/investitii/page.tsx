import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Investițiile stau acum pe pagina „Cheltuieli”, în fila a doua. Adresa veche rămâne bună
 * (meniu, semne de carte, linkurile din chatul AI): parametrii merg mai departe neschimbați.
 */
export default async function InvestitiiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const next = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (name === 'fila' || value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) next.append(name, item)
  }
  next.set('fila', 'investitii')
  redirect(`/cheltuieli?${next.toString()}`)
}
