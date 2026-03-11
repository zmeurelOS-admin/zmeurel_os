import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origin = process.env.APP_BASE_URL || url.origin
  return NextResponse.redirect(`${origin}/settings`)
}
