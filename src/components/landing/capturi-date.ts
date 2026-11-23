/**
 * Capturile reale din aplicație (un demo nou, Fructe de pădure, la 390 px, 2×), în `public/landing/`.
 * Se refac cu `scripts/landing-capturi.mjs` (scrie doar într-un demo nou).
 */
export interface Captura {
  src: string
  alt: string
  titlu: string
  width: number
  height: number
}

const W = 780
const H = 1560

export const CAPTURI: readonly Captura[] = [
  { src: '/landing/captura-acasa.webp', titlu: 'Acasă', alt: 'Ecranul Acasă: ce ai de livrat azi, stocul și ce e de făcut', width: W, height: H },
  { src: '/landing/captura-recoltari.webp', titlu: 'Recoltări', alt: 'Recoltările zilei, pe culegători, cu kilogramele și plata', width: W, height: H },
  { src: '/landing/captura-comenzi.webp', titlu: 'Comenzi', alt: 'Comenzile de livrat, pe zile, cu clientul și cantitatea', width: W, height: H },
  { src: '/landing/captura-tratamente.webp', titlu: 'Tratamente', alt: 'Tratamentele fermei, cu pauza până la recoltare', width: W, height: H },
  { src: '/landing/captura-stocuri.webp', titlu: 'Stoc', alt: 'Stocul pe cultură: cât e disponibil și cât e în livrare', width: W, height: H },
  { src: '/landing/captura-parcele.webp', titlu: 'Parcele', alt: 'Lista parcelelor, cu cultura, soiul și kilogramele din sezon', width: W, height: H },
]
