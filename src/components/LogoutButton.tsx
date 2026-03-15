'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'

import { getSupabase, resetSupabaseInstance } from '@/lib/supabase/client'

interface LogoutButtonProps {
  className?: string
  label?: string
  variant?: 'solid' | 'ghost'
}

export default function LogoutButton({ className, label, variant = 'solid' }: LogoutButtonProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const supabase = getSupabase()
      await supabase.auth.signOut({ scope: 'local' })
      resetSupabaseInstance()
      await queryClient.cancelQueries()
      queryClient.clear()
    } catch {
      // ignore — proceed with redirect regardless
    }
    // Force redirect — prevents back-button returning to dashboard
    if (typeof window !== 'undefined') {
      window.location.replace('/')
    }
  }

  const defaultClassName =
    variant === 'ghost'
      ? 'inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50'
      : 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={className ?? defaultClassName}
    >
      <LogOut className="h-4 w-4" />
      {isLoading ? 'Se deconecteaza...' : (label ?? 'Deconectare')}
    </button>
  )
}
