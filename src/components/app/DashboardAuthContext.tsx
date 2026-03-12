'use client'

import { createContext, useContext } from 'react'

export interface DashboardAuthValue {
  userId: string | null
  email: string | null
  isSuperAdmin: boolean
}

const DashboardAuthContext = createContext<DashboardAuthValue>({
  userId: null,
  email: null,
  isSuperAdmin: false,
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
