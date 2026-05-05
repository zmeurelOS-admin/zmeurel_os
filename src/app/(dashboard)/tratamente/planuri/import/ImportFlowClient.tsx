'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import type { ParseResult } from '@/app/(dashboard)/tratamente/planuri/import/actions'
import { ConfigurareStep } from './ConfigurareStep'
import { ReviewStep } from './ReviewStep'
import { UploadStep } from './UploadStep'

export function ImportFlowClient() {
  const [importConfig, setImportConfig] = useState<{
    parcelaId: string
    an: number
  } | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  return (
    <AppShell
      header={
        <PageHeader
          title="Import plan din Excel"
          subtitle="Flux separat de wizard pentru import rapid și review asistat."
          expandRightSlotOnMobile
          stackMobileRightSlotBelowTitle
          rightSlot={
            <Button type="button" variant="outline" asChild>
              <a href="/api/tratamente/template-download">
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
                Descarcă template Excel
              </a>
            </Button>
          }
        />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 py-3">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Link href="/tratamente" className="hover:text-[var(--text-primary)]">
            Tratamente
          </Link>
          <span>/</span>
          <Link
            href="/tratamente/planuri"
            className="hover:text-[var(--text-primary)]"
          >
            Planuri
          </Link>
          <span>/</span>
          <span className="font-medium text-[var(--text-primary)]">Import</span>
        </nav>

        {!importConfig ? (
          <ConfigurareStep onConfigurate={setImportConfig} />
        ) : parseResult ? (
          <ReviewStep
            an={importConfig.an}
            parcelaId={importConfig.parcelaId}
            parseResult={parseResult}
            onReset={() => setParseResult(null)}
          />
        ) : (
          <UploadStep onParsed={setParseResult} />
        )}
      </div>
    </AppShell>
  )
}
