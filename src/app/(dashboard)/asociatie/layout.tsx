import type { Metadata } from 'next'

import { requireAssociationAccess } from '@/lib/association/auth'

export const metadata: Metadata = {
  title: 'Gustă din Bucovina — Administrare',
}

export default async function AsociatieLayout({ children }: { children: React.ReactNode }) {
  await requireAssociationAccess()
  return children
}
