import type { Page } from '@playwright/test'

/**
 * Verificarea „text care iese din chenar” (promptul 34, §9), rulată în pagină.
 *
 * Pică la:
 *   - text tăiat: `text-overflow: ellipsis` sau `overflow` ascuns pe orizontală, cu `scrollWidth > clientWidth + 1`;
 *     `-webkit-line-clamp`, cu `scrollHeight > clientHeight + 1` (acolo derularea nu e permisă);
 *   - text ieșit din chenar: dreptunghiul textului (Range) depășește cu peste 1 px chenarul lui (butonul, placa,
 *     linkul, eticheta, rândul de listă în care stă);
 *   - pagina se derulează pe orizontală.
 *
 * Câmpurile (`input`, `textarea`) se sar: textul lung derulează în ele, așa sunt făcute. Textul ascuns pentru
 * cititoarele de ecran (`sr-only`) se sare.
 */

export interface ProblemaText {
  tip: 'taiat' | 'iesit' | 'derulare-orizontala'
  element: string
  text: string
  depasire: number
}

/** Excepțiile, cu motiv. Selectorul se potrivește cu `element.closest(selector)`. */
export const EXCEPTII_TEXT: ReadonlyArray<{ selector: string; motiv: string }> = []

export async function cautaTextIesit(page: Page): Promise<ProblemaText[]> {
  return page.evaluate((exceptii) => {
    const probleme: Array<{ tip: 'taiat' | 'iesit' | 'derulare-orizontala'; element: string; text: string; depasire: number }> = []
    const CHENAR = 'button, a, [role="radio"], [role="checkbox"], [role="tab"], [role="switch"], [role="option"], label, li, h1, h2, h3'

    const descrie = (el: Element) => {
      const rol = el.getAttribute('role')
      const eticheta = el.getAttribute('aria-label')
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
      return `${el.tagName.toLowerCase()}${rol ? `[role=${rol}]` : ''}${eticheta ? `[aria-label="${eticheta.slice(0, 40)}"]` : ''} „${text}”`
    }
    const vizibil = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) return false
      const cs = getComputedStyle(el)
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
    }
    const ascunsPentruOchi = (el: Element) => Boolean(el.closest('.sr-only, [aria-hidden="true"] .sr-only'))
    const exceptat = (el: Element) => exceptii.some((exceptie) => el.closest(exceptie.selector))
    const areTextPropriu = (el: Element) => [...el.childNodes].some((nod) => nod.nodeType === Node.TEXT_NODE && (nod.textContent ?? '').trim().length > 0)

    const radacini = [...document.querySelectorAll('main, [role="dialog"], nav, aside, header')]
    const vazute = new Set<Element>()
    for (const radacina of radacini) {
      for (const el of radacina.querySelectorAll('*')) {
        if (vazute.has(el)) continue
        vazute.add(el)
        if (el.closest('input, textarea, select, svg')) continue
        if (!areTextPropriu(el) || !vizibil(el) || ascunsPentruOchi(el) || exceptat(el)) continue
        const cs = getComputedStyle(el)
        const html = el as HTMLElement

        // 1. Tăiat.
        const tăiatOrizontal =
          (cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden' || cs.overflowX === 'clip') && html.scrollWidth > html.clientWidth + 1
        const clamp = cs.getPropertyValue('-webkit-line-clamp')
        const tăiatVertical = clamp && clamp !== 'none' && html.scrollHeight > html.clientHeight + 1
        if (tăiatOrizontal || tăiatVertical) {
          probleme.push({
            tip: 'taiat',
            element: descrie(el),
            text: (el.textContent ?? '').trim().slice(0, 80),
            depasire: Math.max(html.scrollWidth - html.clientWidth, html.scrollHeight - html.clientHeight),
          })
          continue
        }

        // 2. Ieșit din chenar.
        const chenar = el.closest(CHENAR)
        if (!chenar) continue
        const range = document.createRange()
        range.selectNodeContents(el)
        const t = range.getBoundingClientRect()
        const c = chenar.getBoundingClientRect()
        if (t.width === 0) continue
        // Pe verticală, literele cu diacritice („Ă”) trec puțin peste rândul strâns al titlurilor mari; contează doar o
        // depășire mai mare de un sfert din litera textului.
        const marimeLitera = Number.parseFloat(cs.fontSize) || 16
        const peOrizontala = Math.max(t.right - c.right, c.left - t.left)
        const peVerticala = Math.max(t.bottom - c.bottom, c.top - t.top)
        const depasire = Math.max(peOrizontala, peVerticala > marimeLitera / 4 ? peVerticala : 0)
        if (depasire > 1) {
          probleme.push({ tip: 'iesit', element: `${descrie(el)} în ${descrie(chenar)}`, text: (el.textContent ?? '').trim().slice(0, 80), depasire: Math.round(depasire) })
        }
      }
    }

    const doc = document.scrollingElement ?? document.documentElement
    if (doc.scrollWidth > window.innerWidth + 1) {
      probleme.push({ tip: 'derulare-orizontala', element: 'pagina', text: location.pathname, depasire: doc.scrollWidth - window.innerWidth })
    }
    return probleme
  }, EXCEPTII_TEXT)
}

export function descrieProbleme(ecran: string, probleme: readonly ProblemaText[]): string {
  return probleme.map((p) => `[${ecran}] ${p.tip} (+${p.depasire}px): ${p.element}`).join('\n')
}
