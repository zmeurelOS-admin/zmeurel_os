import { AMANARE_IMPLICITA, AMANARI_POSIBILE, ziAmanare } from '@/lib/analize/memento'
import { scrieStareMemento } from '@/lib/analize/memento-api'

export const runtime = 'nodejs'

/** „Amână 1 / 3 / 7 zile” (din foaie, din cardul din Acasă sau din butonul notificării; implicit 3). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { zile?: unknown } | null
  const zile = (AMANARI_POSIBILE as readonly number[]).includes(Number(body?.zile)) ? Number(body?.zile) : AMANARE_IMPLICITA
  return scrieStareMemento(request, (azi) => ({ amanat_pana: ziAmanare(azi, zile) }))
}
