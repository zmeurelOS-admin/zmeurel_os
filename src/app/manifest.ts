import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

const DEFAULT_SHOP_DOMAIN = 'comanda.zmeurel.ro'
const SHOP_DOMAIN = (process.env.SHOP_DOMAIN?.trim() || DEFAULT_SHOP_DOMAIN).toLowerCase()

function normalizeHost(host: string | null): string {
  return (host ?? '').split(':')[0]?.toLowerCase() ?? ''
}

const osIcons: MetadataRoute.Manifest['icons'] = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

const shopIcons: MetadataRoute.Manifest['icons'] = [
  { src: '/shop-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/shop-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  {
    src: '/shop-icon-512-maskable.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
]

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = normalizeHost((await headers()).get('host'))

  if (host === SHOP_DOMAIN) {
    return {
      id: '/',
      name: 'Zmeurel',
      short_name: 'Zmeurel',
      description: 'Produse proaspete din Văratec, Suceava',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#fff5f5',
      theme_color: '#e85d5d',
      icons: shopIcons,
    }
  }

  return {
    id: '/start',
    name: 'Zmeurel OS',
    short_name: 'Zmeurel OS',
    description: 'Evidență simplă pentru fermă',
    start_url: '/start?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0fdf4',
    theme_color: '#166534',
    icons: osIcons,
  }
}
