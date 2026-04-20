'use server'

import { NextResponse } from 'next/server'

import { generateRaportConsolidat } from '@/lib/tratamente/pdf'

export async function exportaRaportConsolidatAction(an: number): Promise<NextResponse> {
  const bytes = await generateRaportConsolidat(an)
  const body = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="raport-consolidat-tratamente-${an}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
