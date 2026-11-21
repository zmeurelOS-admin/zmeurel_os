import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Bannerul din aplicație când actele fermei nu sunt complete. Textul vine din `textBannerActe` (aceeași regulă ca ecranul). */
export function LegalDocsPersistentBanner({ mesaj }: { mesaj: string }) {
  return (
    <div className="border-b border-warning-border bg-warning-bg">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 text-warning-text md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-[15px] font-semibold">{mesaj} Fără ele nu poți vinde prin platformă.</p>
        </div>
        <Button size="touch" variant="neutral" className="w-full md:w-auto" asChild>
          <Link href="/settings/ferma/acte">Completează actele</Link>
        </Button>
      </div>
    </div>
  )
}
