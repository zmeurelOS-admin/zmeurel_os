export const NOTIFICATION_CONFIG = {
  order_new: {
    icon: '📦',
    color: '#0D6342',
    toastDuration: 6000,
    showToast: true,
    playSound: true,
    /** Web Push pe telefon / background (VAPID). Doar comenzile noi sunt critice. */
    pushEnabled: true,
  },
  order_status_changed: {
    icon: '🔄',
    color: '#FF9E1B',
    toastDuration: 4000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
  product_listed: {
    icon: '✅',
    color: '#27AE60',
    toastDuration: 4000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
  product_unlisted: {
    icon: '❌',
    color: '#e85d5d',
    toastDuration: 4000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
  producer_approved: {
    icon: '🧑‍🌾',
    color: '#0D6342',
    toastDuration: 5000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
  producer_suspended: {
    icon: '⏸',
    color: '#e6a817',
    toastDuration: 5000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
  offer_new: {
    icon: '📨',
    color: '#0D6342',
    toastDuration: 6000,
    showToast: true,
    playSound: true,
    pushEnabled: true,
  },
  offer_approved: {
    icon: '✅',
    color: '#27AE60',
    toastDuration: 5000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  offer_rejected: {
    icon: '❌',
    color: '#e85d5d',
    toastDuration: 5000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  system: {
    icon: 'ℹ️',
    color: '#3D4543',
    toastDuration: 5000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
} as const

export type NotificationToastType = keyof typeof NOTIFICATION_CONFIG

export function getNotificationUiConfig(type: string) {
  if (type in NOTIFICATION_CONFIG) {
    return NOTIFICATION_CONFIG[type as NotificationToastType]
  }
  return NOTIFICATION_CONFIG.system
}

export function shouldSendWebPushForType(type: string): boolean {
  return getNotificationUiConfig(type).pushEnabled === true
}
