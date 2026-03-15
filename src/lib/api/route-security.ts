import { NextResponse } from 'next/server'

type StatusKey = 'ok' | 'success'

type ErrorResponseOptions = {
  statusKey?: StatusKey
}

function buildBody(statusKey: StatusKey, code: string, message: string) {
  return {
    [statusKey]: false,
    error: {
      code,
      message,
    },
  }
}

function getOrigin(value: string | null): string | null {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function sameOrigin(left: string, right: string) {
  try {
    const leftUrl = new URL(left)
    const rightUrl = new URL(right)

    if (leftUrl.origin === rightUrl.origin) {
      return true
    }

    return (
      leftUrl.protocol === rightUrl.protocol &&
      leftUrl.port === rightUrl.port &&
      isLoopbackHost(leftUrl.hostname) &&
      isLoopbackHost(rightUrl.hostname)
    )
  } catch {
    return false
  }
}

export function apiError(
  status: number,
  code: string,
  message: string,
  options: ErrorResponseOptions = {}
) {
  const statusKey = options.statusKey ?? 'ok'

  return NextResponse.json(buildBody(statusKey, code, message), {
    status,
  })
}

export function validateSameOriginMutation(
  request: Request,
  options: ErrorResponseOptions = {}
) {
  const requestOrigin = getOrigin(request.url)
  if (!requestOrigin) {
    return apiError(403, 'INVALID_ORIGIN', 'Cererea nu a fost acceptata.', options)
  }

  const origin = getOrigin(request.headers.get('origin'))
  if (origin && !sameOrigin(origin, requestOrigin)) {
    return apiError(403, 'INVALID_ORIGIN', 'Cererea nu a fost acceptata.', options)
  }

  const referer = getOrigin(request.headers.get('referer'))
  if (referer && !sameOrigin(referer, requestOrigin)) {
    return apiError(403, 'INVALID_ORIGIN', 'Cererea nu a fost acceptata.', options)
  }

  return null
}
