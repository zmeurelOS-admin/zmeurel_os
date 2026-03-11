import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(
    { error: 'Google Contacts integration is disabled.' },
    { status: 410 }
  )
}
