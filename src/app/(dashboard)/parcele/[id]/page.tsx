import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

/** Detaliul vechi `/parcele/[id]` este consolidat în `/parcele?selected=…`. */
export default async function ParceleParcelaLegacyRedirect({ params }: PageProps) {
  const { id } = await params
  const trimmed = id?.trim()
  if (!trimmed) {
    redirect('/parcele')
  }
  redirect(`/parcele?selected=${encodeURIComponent(trimmed)}`)
}
