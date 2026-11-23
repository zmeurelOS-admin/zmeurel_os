import { APP_NAME } from '@/lib/brand'

/**
 * Ajutorul pe WhatsApp: același număr și același mesaj în widgetul beta și în Mai mult › Ajutor.
 * Numărul se schimbă doar aici.
 */
export const SUPPORT_WHATSAPP_URL = `https://wa.me/40752953048?text=${encodeURIComponent(`Salut Andrei, am o sugestie pentru ${APP_NAME}`)}`
