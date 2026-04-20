import { NextResponse } from 'next/server'

import { exportaRaportConsolidatAction } from '@/app/(dashboard)/tratamente/conformitate/actions'

function parseYear(raw: string | null): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return null
  return parsed
}

export async function GET(request: Request): Promise<NextResponse> {
  const year = parseYear(new URL(request.url).searchParams.get('an'))
  if (!year) {
    return NextResponse.json({ error: 'An invalid.' }, { status: 400 })
  }

  return exportaRaportConsolidatAction(year)
}
