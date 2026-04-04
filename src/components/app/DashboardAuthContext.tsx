'use client'

import { createContext, useContext } from 'react'

import type { AssociationRole } from '@/lib/association/auth'

export interface DashboardAuthValue {
  userId: string | null
  email: string | null
  isSuperAdmin: boolean
  /** Din proxy (`x-zmeurel-tenant-id`); folosit la invoke edge (ex. meteo). */
  tenantId: string | null
  /** Tenant aprobat pentru magazin asociație (hub public). */
  associationShopApproved: boolean
  /** Rol în `association_members`, dacă există. */
  associationRole: AssociationRole | null
  /** `nume_ferma` pentru tenantul curent (context switcher). */
  farmName: string | null
}

const DashboardAuthContext = createContext<DashboardAuthValue>({
  userId: null,
  email: null,
  isSuperAdmin: false,
  tenantId: null,
  associationShopApproved: false,
  associationRole: null,
  farmName: null,
})

export function DashboardAuthProvider({
  value,
  children,
}: {
  value: DashboardAuthValue
  children: React.ReactNode
}) {
  return <DashboardAuthContext.Provider value={value}>{children}</DashboardAuthContext.Provider>
}

export function useDashboardAuth() {
  return useContext(DashboardAuthContext)
}
