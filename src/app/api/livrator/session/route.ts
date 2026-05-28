import { NextResponse, type NextRequest } from 'next/server'

import {
  getActiveLivratorByToken,
  LIVRATOR_TOKEN_COOKIE,
  LIVRATOR_TOKEN_MAX_AGE_SECONDS,
} from '@/lib/livrator/access'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const member = await getActiveLivratorByToken(token)

  if (!member) {
    return NextResponse.redirect(new URL('/livrator/invalid', request.url), 303)
  }

  const response = NextResponse.redirect(new URL('/livrator/livrari', request.url), 303)
  response.cookies.set(LIVRATOR_TOKEN_COOKIE, member.invite_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/livrator',
    maxAge: LIVRATOR_TOKEN_MAX_AGE_SECONDS,
  })

  return response
}
