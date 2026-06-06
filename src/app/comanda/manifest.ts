import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/comanda',
    name: 'Zmeurel — Fructe proaspete',
    short_name: 'Zmeurel',
    description: 'Fructe proaspete din Văratec, Suceava',
    start_url: '/comanda?source=pwa',
    scope: '/comanda',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFF6F3',
    theme_color: '#F16B6B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
