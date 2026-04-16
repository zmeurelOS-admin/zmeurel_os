import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function LegalDocsPersistentBanner() {
  return (
    <div className="border-b border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 text-[var(--status-warning-text)] md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium">
            Completează documentele legale pentru a putea vinde prin platformă.
          </p>
        </div>
        <Button size="sm" variant="outline" className="w-full md:w-auto" asChild>
          <Link href="/settings/documente-legale">Completează acum</Link>
        </Button>
      </div>
    </div>
  )
}
