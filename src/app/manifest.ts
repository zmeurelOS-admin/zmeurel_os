import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zmeurel OS',
    short_name: 'Zmeurel',
    description: 'Evidență simplă pentru fermă',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0fdf4',
    theme_color: '#166534',
    icons: [
      { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
      { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
      { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
