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
  weekly_sales_summary: {
    icon: '🧾',
    color: '#0D6342',
    toastDuration: 5000,
    showToast: true,
    playSound: false,
    pushEnabled: false,
  },
  butasi_delivery_reminder: {
    icon: '🌱',
    color: '#3D7A5F',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    /** Memento livrare material săditor — trebuie să ajungă pe telefon. */
    pushEnabled: true,
  },
  // Verificarea zilnică (cronurile `notificari-seara` și `notificari-dimineata`). Push pornit pentru toate:
  // comutatoarele din „Ce primești” (maine, rest, meteo) și liniștea de noapte decid mai departe.
  comenzi_maine: {
    icon: '🚚',
    color: '#3D7A5F',
    /** Informare: comenzile de mâine încă nepuse în livrare. */
    ton: 'informare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  incasari_restante: {
    icon: '💰',
    color: '#e6a817',
    /** Avertizare: bani de încasat de 7 sau 14 zile (de la 30, `incasari_peste_30`). */
    ton: 'avertizare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  incasari_peste_30: {
    icon: '💰',
    color: '#e6a817',
    /** Avertizare: comenzi neîncasate de peste 30 de zile (cumulat, cel mult o dată la 7 zile). */
    ton: 'avertizare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  tratament_planificat: {
    icon: '🧪',
    color: '#3D7A5F',
    /** Informare: tratamentele planificate azi (cronul `notificari-dimineata`). */
    ton: 'informare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  magazie_pe_terminate: {
    icon: '📦',
    color: '#e6a817',
    /** Avertizare: produsele din Magazie pe terminate (luni, cronul `notificari-dimineata`, doar proprietarul). */
    ton: 'avertizare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  capcane_verificare: {
    icon: '🪰',
    color: '#e6a817',
    /** Mementoul „Verifică capcanele” (cronul `notificari-dimineata`; proprietarul și operatorii cu „Scrie”). */
    ton: 'avertizare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  plan_tratament: {
    icon: '🗓️',
    color: '#3D7A5F',
    /** Planul pe stadii: „E timpul pentru <stadiu> la <parcele>” (cronul `notificari-dimineata`; proprietarul și operatorii cu „Scrie”). */
    ton: 'informare',
    toastDuration: 6000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  capcane_peste_prag: {
    icon: '🪰',
    color: '#e6a817',
    /** Alerta „Peste prag”, imediat după o verificare care trece pragul (`/api/capcane/alerta`, doar proprietarul). */
    ton: 'avertizare',
    toastDuration: 8000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  analize_memento: {
    icon: '🧪',
    color: '#e6a817',
    /** Avertizare: analiza la fructe dinainte de cules (cronul `notificari-dimineata`, doar proprietarul). */
    ton: 'avertizare',
    toastDuration: 8000,
    showToast: true,
    playSound: false,
    pushEnabled: true,
  },
  meteo_inghet: {
    icon: '❄️',
    color: '#e6a817',
    /** Avertizare: îngheț sau ger la noapte. */
    ton: 'avertizare',
    toastDuration: 8000,
    showToast: true,
    playSound: true,
    pushEnabled: true,
  },
  meteo_grindina: {
    icon: '⛈️',
    color: '#e6a817',
    /** Avertizare: furtună cu grindină mâine. */
    ton: 'avertizare',
    toastDuration: 8000,
    showToast: true,
    playSound: true,
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

export function shouldSendWebPushForType(
  type: string,
  data?: Record<string, unknown> | null,
): boolean {
  if (type === 'order_new' && data?.channel === 'association_shop') {
    return false
  }
  return getNotificationUiConfig(type).pushEnabled === true
}
