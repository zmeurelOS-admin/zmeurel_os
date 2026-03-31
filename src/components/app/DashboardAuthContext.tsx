'use client'

import { createContext, useContext } from 'react'

export interface DashboardAuthValue {
  userId: string | null
  email: string | null
  isSuperAdmin: boolean
  /** Din proxy (`x-zmeurel-tenant-id`); folosit la invoke edge (ex. meteo). */
  tenantId: string | null
}

const DashboardAuthContext = createContext<DashboardAuthValue>({
  userId: null,
  email: null,
  isSuperAdmin: false,
  tenantId: null,
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
