import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getActiveLivratorByToken } from '@/lib/livrator/access'

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function LivratorTokenPage({ params }: PageProps) {
  const { token } = await params
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
            Cere fermierului un link nou de acces pentru livrări.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#F16B6B] px-5 text-sm font-semibold text-white"
          >
            Înapoi la Zmeurel
          </Link>
        </section>
      </main>
    )
  }

  redirect(`/api/livrator/session?token=${encodeURIComponent(member.invite_token)}`)
}
