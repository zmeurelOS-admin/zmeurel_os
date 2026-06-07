import { cookies } from 'next/headers'

import {
  getActiveLivratorByToken,
  listLivratorOrdersInLivrare,
  LIVRATOR_TOKEN_COOKIE,
} from '@/lib/livrator/access'

import { LivratorLivrariClient } from './LivratorLivrariClient'

export const dynamic = 'force-dynamic'

export default async function LivratorLivrariPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(LIVRATOR_TOKEN_COOKIE)?.value ?? null
  const member = await getActiveLivratorByToken(token)

  if (!member) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF6F3] px-4">
        <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-[0_12px_36px_rgba(120,100,70,0.12)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE3DF] text-2xl">
            🚚
          </div>
          <h1 className="text-xl font-bold text-[#312E3F]">Link invalid sau expirat.</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
            Deschide linkul primit de la fermier sau cere unul nou.
          </p>
        </section>
      </main>
    )
  }

  const orders = await listLivratorOrdersInLivrare(member.tenant_id)

  return (
    <LivratorLivrariClient
      livratorName={member.name}
      token={member.invite_token}
      initialOrders={orders}
    />
  )
}
