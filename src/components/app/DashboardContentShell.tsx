import { cn } from '@/lib/utils'

export type DashboardContentShellVariant = 'centered' | 'workspace' | 'analytics'

function getDashboardContentMaxWidthClass(variant: DashboardContentShellVariant) {
  switch (variant) {
    case 'workspace':
      return 'max-w-[96rem]'
    case 'analytics':
      return 'max-w-[100rem]'
    case 'centered':
    default:
      return 'max-w-7xl'
  }
}

export function getDashboardContentInnerClassName(variant: DashboardContentShellVariant) {
  return cn('mx-auto w-full px-4 lg:px-6 xl:px-8', getDashboardContentMaxWidthClass(variant))
}

export function getDashboardShellBleedClassName() {
  return '-mx-[var(--shell-content-px)] sm:-mx-5 md:-mx-6'
}

export function getDashboardHeaderBleedClassName() {
  return '-mx-[var(--shell-content-px)] sm:-mx-5 md:-mx-6 lg:-mx-8 xl:-mx-10'
}

type DashboardContentShellProps = {
  variant: DashboardContentShellVariant
  className?: string
  children: React.ReactNode
}

export function DashboardContentShell({
  variant,
  className,
  children,
}: DashboardContentShellProps) {
  return (
    <div className={getDashboardShellBleedClassName()}>
      <div className={cn(getDashboardContentInnerClassName(variant), className)}>{children}</div>
    </div>
  )
}
