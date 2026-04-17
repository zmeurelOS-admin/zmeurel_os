import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { Button } from '@/components/ui/button'

interface AplicareDetaliuHeaderProps {
  backHref: string
  parcelaName: string
}

export function AplicareDetaliuHeader({
  backHref,
  parcelaName,
}: AplicareDetaliuHeaderProps) {
  return (
    <CompactPageHeader
      title="Detaliu aplicare"
      subtitle={parcelaName}
      summary={
        <div className="flex items-center justify-start">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Înapoi la tratamente
            </Link>
          </Button>
        </div>
      }
    />
  )
}
