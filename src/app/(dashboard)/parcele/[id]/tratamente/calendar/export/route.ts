import { NextResponse } from 'next/server'

import { exportaFisaAnsvsaAction } from '@/app/(dashboard)/parcele/[id]/tratamente/calendar/actions'

type RouteProps = {
  params: Promise<{ id: string }>
}

function parseYear(raw: string | null): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return null
  return parsed
}

export async function GET(request: Request, { params }: RouteProps): Promise<NextResponse> {
  const { id } = await params
  const year = parseYear(new URL(request.url).searchParams.get('an'))
  if (!year) {
    return NextResponse.json({ error: 'An invalid.' }, { status: 400 })
  }

  return exportaFisaAnsvsaAction(id, year)
}

