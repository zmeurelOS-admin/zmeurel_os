'use client'

import dynamic from 'next/dynamic'

import { DashboardSidebarSkeleton } from '@/components/layout/DashboardSidebarSkeleton'

const Sidebar = dynamic(
  () => import('@/components/layout/Sidebar').then((m) => ({ default: m.Sidebar })),
  { ssr: false, loading: () => <DashboardSidebarSkeleton /> }
)

export function DashboardSidebarLoader() {
  return <Sidebar />
}
