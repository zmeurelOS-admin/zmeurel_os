import type { AplicarePlanificataNotif } from './types'

function formatSingleBody(aplicare: AplicarePlanificataNotif): string {
  const doza = aplicare.doza ? ` ${aplicare.doza}` : ''
  return `${aplicare.produsNume} pe ${aplicare.parcelaNume}.${doza}`.trim()
}

function formatParceleList(aplicari: AplicarePlanificataNotif[]): string {
  return [...new Set(aplicari.map((aplicare) => aplicare.parcelaNume))].slice(0, 3).join(', ')
}

/**
 * Formatează titlul și body-ul notificării pentru aplicările programate azi și/sau mâine.
 * Exemplu: `formatNotificationPayload(azi, maine)`
 */
export function formatNotificationPayload(
  azi: AplicarePlanificataNotif[],
  maine: AplicarePlanificataNotif[]
): { title: string; body: string } | null {
  if (azi.length === 0 && maine.length === 0) {
    return null
  }

  if (azi.length > 0 && maine.length > 0) {
    const title = `Aplicări programate: ${azi.length} azi, ${maine.length} mâine`
    const body =
      azi.length === 1
        ? `${formatSingleBody(azi[0]!)} Mâine: ${maine.length} aplicări.`
        : `Azi: ${azi.length} aplicări pe ${formatParceleList(azi)}. Mâine: ${maine.length} aplicări.`

    return { title, body }
  }

  if (azi.length > 0) {
    if (azi.length === 1) {
      return {
        title: 'Aplicare programată azi',
        body: formatSingleBody(azi[0]!),
      }
    }

    return {
      title: `${azi.length} aplicări programate azi`,
      body: `Parcele: ${formatParceleList(azi)}. Intră în Zmeurel pentru detalii.`,
    }
  }

  if (maine.length === 1) {
    return {
      title: 'Aplicare programată mâine',
      body: formatSingleBody(maine[0]!),
    }
  }

  return {
    title: `${maine.length} aplicări programate mâine`,
    body: `Parcele: ${formatParceleList(maine)}. Pregătește stocul din timp.`,
  }
}

