import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from '@/lib/brand'

const DEFAULT_SHOP_DOMAIN = 'comanda.zmeurel.ro'
const SHOP_DOMAIN = (process.env.SHOP_DOMAIN?.trim() || DEFAULT_SHOP_DOMAIN).toLowerCase()

function normalizeHost(host: string | null): string {
  return (host ?? '').split(':')[0]?.toLowerCase() ?? ''
}

/** Iconițele platformei (Caietul Fermei), ca în `docs/redesign/brand/caietul-fermei-logo/manifest-exemplu.json`. */
const osIcons: MetadataRoute.Manifest['icons'] = [
  { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((size) => ({
    src: `/icons/icon-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
  })),
  { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/badge-monocrom-96.png', sizes: '96x96', type: 'image/png', purpose: 'monochrome' },
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
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_TAGLINE,
    start_url: '/start?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf8ef',
    theme_color: '#3d7a5f',
    icons: osIcons,
    // „Distribuie” din aplicația Contacte → Caietul deschide comanda nouă de material săditor.
    share_target: {
      action: '/api/share/contact',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        files: [
          {
            name: 'contact',
            accept: ['text/vcard', 'text/x-vcard', 'text/directory', '.vcf'],
          },
        ],
      },
    },
  }
}
