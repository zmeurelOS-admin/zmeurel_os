'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'

import { prepareClientBeforeServerSignOut } from '@/lib/auth/server-sign-out-form'

interface LogoutButtonProps {
  className?: string
  label?: string
  variant?: 'solid' | 'ghost'
}

export default function LogoutButton({ className, label, variant = 'solid' }: LogoutButtonProps) {
  const queryClient = useQueryClient()

  const defaultClassName =
    variant === 'ghost'
      ? 'inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50'
      : 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <form
      action="/api/auth/sign-out"
      method="POST"
      className="inline w-full"
      onSubmit={() => prepareClientBeforeServerSignOut(queryClient)}
    >
      <button type="submit" className={className ?? defaultClassName}>
        <LogOut className="h-4 w-4" />
        {label ?? 'Deconectare'}
      </button>
    </form>
  )
}
