import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const disabledResponse = () =>
  NextResponse.json(
    { error: 'Google Contacts integration is disabled.' },
    { status: 410 }
  )

export async function GET() {
  return disabledResponse()
}

export async function PATCH() {
  return disabledResponse()
}

export async function POST() {
  return disabledResponse()
}
