import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Magazin fermier',
  description: 'Catalog public de produse — comandă direct de la fermă.',
}

export default function MagazinLayout({ children }: { children: React.ReactNode }) {
  return children
}
