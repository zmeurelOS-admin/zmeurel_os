import { scrieStareMemento } from '@/lib/analize/memento-api'

export const runtime = 'nodejs'

/** „Nu fac analize anul acesta” (doar sezonul curent) sau repornirea mementoului pe sezon. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { dezactivat?: unknown } | null
  const dezactivat = body?.dezactivat !== false
  return scrieStareMemento(request, () => ({ dezactivat }))
}
