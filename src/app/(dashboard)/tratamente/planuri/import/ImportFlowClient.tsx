'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, FileSpreadsheet } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/ui/button'
import type { ParseResult } from '@/app/(dashboard)/tratamente/planuri/import/actions'
import { ConfigurareStep } from './ConfigurareStep'
import { ReviewStep } from './ReviewStep'
import { UploadStep } from './UploadStep'

const STEPS = ['Configurare', 'Upload', 'Review'] as const

export function ImportFlowClient() {
  const [importConfig, setImportConfig] = useState<{
    parcelaId: string
    an: number
  } | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  const activeStep = !importConfig ? 0 : parseResult ? 2 : 1

  return (
    <AppShell
      header={
        <div className="rounded-b-[24px] bg-[#3D7A5F] px-[18px] py-[18px] text-white shadow-[0_16px_40px_rgba(61,122,95,0.18)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold tracking-tight text-white">Import plan din Excel</h1>
                <p className="text-sm text-white/70">Flux wizard pentru import rapid și review asistat</p>
              </div>

              <Button
                type="button"
                asChild
                className="min-h-10 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#3D7A5F] hover:bg-white/90"
              >
                <a href="/api/tratamente/template-download">
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                  Descarcă template Excel
                </a>
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 py-3">
        {/* --- SECTION: breadcrumb --- */}
        <nav aria-label="Breadcrumb" className="text-xs text-gray-400">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/tratamente" className="hover:text-gray-600">
                Tratamente
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/tratamente/planuri" className="hover:text-gray-600">
                Planuri
              </Link>
            </li>
            <li>/</li>
            <li className="font-medium text-gray-600">Import</li>
          </ol>
        </nav>

        {/* --- SECTION: stepper --- */}
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {STEPS.map((step, index) => {
              const isActive = index === activeStep
              const isCompleted = index < activeStep
              const isLast = index === STEPS.length - 1

              return (
                <div key={step} className="flex items-center gap-3 md:flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition ${
                        isCompleted || isActive
                          ? 'border-[#3D7A5F] bg-[#3D7A5F] text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                    </span>
                    <span
                      className={`text-sm transition ${
                        isActive ? 'font-bold text-[#3D7A5F]' : isCompleted ? 'font-semibold text-[#3D7A5F]' : 'text-gray-400'
                      }`}
                      >
                        {step}
                      </span>
                  </div>
                  {!isLast ? (
                    <div
                      className={`hidden h-px flex-1 md:block ${
                        index < activeStep ? 'bg-[#3D7A5F]' : 'bg-gray-200'
                      }`}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* --- SECTION: wizard body --- */}
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
          <UploadStep
            // --- FIX 4: pas înapoi prin state machine-ul existent ---
            onBack={() => {
              setParseResult(null)
              setImportConfig(null)
            }}
            onParsed={setParseResult}
          />
        )}
      </div>
    </AppShell>
  )
}
