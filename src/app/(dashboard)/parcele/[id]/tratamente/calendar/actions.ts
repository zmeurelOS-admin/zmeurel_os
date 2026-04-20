'use server'

import { NextResponse } from 'next/server'

import { generateFisaANSVSA } from '@/lib/tratamente/pdf'

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

export async function exportaFisaAnsvsaAction(parcelaId: string, an: number): Promise<NextResponse> {
  const bytes = await generateFisaANSVSA(parcelaId, an)
  const safeParcela = sanitizeFilePart(parcelaId)
  const body = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fisa-ansvsa-${safeParcela}-${an}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
