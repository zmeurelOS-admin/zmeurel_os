'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'

export function AnalyticsRefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0 gap-2 rounded-lg border-[var(--agri-border)]"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.refresh()
        })
      }}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
      Reîncarcă
    </Button>
  )
}
