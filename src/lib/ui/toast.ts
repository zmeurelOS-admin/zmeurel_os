'use client'

import type { ReactNode } from 'react'
import { toast as sonnerToast, type ExternalToast } from 'sonner'

import { GENERIC_SAVE_MESSAGE, toUserFacingErrorMessage } from '@/lib/ui/error-messages'

const DEFAULT_TOAST_DURATION_MS = 2800

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function withDefaultDuration(options?: ExternalToast): ExternalToast {
  return {
    ...options,
    duration: options?.duration ?? DEFAULT_TOAST_DURATION_MS,
  }
}

function isDeleteIntent(message: string): boolean {
  return /sterg|sters|stears/.test(message)
}

function isUpdateIntent(message: string): boolean {
  return /actualiz|edit/.test(message)
}

function normalizeSuccessMessage(message: string): string {
  const key = normalize(message)

  if (key.includes('export') || key.includes('ascuns') || key.includes('multum') || key.includes('cont creat')) {
    return message
  }

  if (key.includes('recolt')) {
    return isDeleteIntent(key) ? 'Recoltare ștearsă' : 'Recoltare salvată'
  }

  if (key.includes('cheltu')) {
    return isDeleteIntent(key) ? 'Cheltuială ștearsă' : 'Cheltuială adăugată'
  }

  if (key.includes('parcel')) {
    if (isDeleteIntent(key)) return 'Parcelă ștearsă'
    if (isUpdateIntent(key)) return 'Parcelă actualizată'
    return 'Parcelă creată'
  }

  if (key.includes('comand')) {
    if (key.includes('redesch')) return 'Comandă redeschisă'
    if (isDeleteIntent(key)) return 'Comandă ștearsă'
    return 'Comandă înregistrată'
  }

  if (key.includes('vanzar') || key.includes('vanz')) {
    return isDeleteIntent(key) ? 'Vânzare ștearsă' : 'Vânzare înregistrată'
  }

  if (key.includes('activit')) {
    return isDeleteIntent(key) ? 'Activitate ștearsă' : 'Activitate salvată'
  }

  if (key.includes('client')) {
    return isDeleteIntent(key) ? 'Client șters' : 'Client salvat'
  }

  if (key.includes('culeg')) {
    return isDeleteIntent(key) ? 'Culegător șters' : 'Culegător salvat'
  }

  if (key.includes('investit')) {
    return isDeleteIntent(key) ? 'Investiție ștearsă' : 'Investiție salvată'
  }

  if (key.includes('stoc')) {
    return 'Ajustare stoc salvată'
  }

  return message
}

function normalizeErrorMessage(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return GENERIC_SAVE_MESSAGE

  return toUserFacingErrorMessage({ message: trimmed }, GENERIC_SAVE_MESSAGE)
}

function normalizeMessageByType(type: 'success' | 'error' | 'info' | 'warning' | 'default', message: ReactNode): ReactNode {
  if (typeof message !== 'string') return message
  if (type === 'success') return normalizeSuccessMessage(message)
  if (type === 'error') return normalizeErrorMessage(message)
  return message
}

type ToastFn = typeof sonnerToast

export const toast = Object.assign(
  ((message: ReactNode, options?: ExternalToast) =>
    sonnerToast(normalizeMessageByType('default', message), withDefaultDuration(options))) as ToastFn,
  {
    success: (message: ReactNode, options?: ExternalToast) =>
      sonnerToast.success(normalizeMessageByType('success', message), withDefaultDuration(options)),
    error: (message: ReactNode, options?: ExternalToast) =>
      sonnerToast.error(normalizeMessageByType('error', message), withDefaultDuration(options)),
    info: (message: ReactNode, options?: ExternalToast) =>
      sonnerToast.info(normalizeMessageByType('info', message), withDefaultDuration(options)),
    warning: (message: ReactNode, options?: ExternalToast) =>
      sonnerToast.warning(normalizeMessageByType('warning', message), withDefaultDuration(options)),
    loading: (message: ReactNode, options?: ExternalToast) =>
      sonnerToast.loading(message, withDefaultDuration(options)),
    message: (message: ReactNode, options?: ExternalToast) =>
      sonnerToast.message(message, withDefaultDuration(options)),
    dismiss: sonnerToast.dismiss,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
  }
)

export { DEFAULT_TOAST_DURATION_MS }
