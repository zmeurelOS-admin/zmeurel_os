import type { Metadata } from 'next'

import { KitShowcase } from './KitShowcaseClient'
import { PRIMITIVE_TOC } from './kit-demo-data'
import { PrimitiveSections } from './sections-primitive'

export const metadata: Metadata = {
  title: 'Kit de componente',
  robots: { index: false, follow: false },
}

/** Pagina kitului. Accesul e verificat de `admin/layout.tsx` (doar superadmin). */
export default function AdminKitPage() {
  return (
    <KitShowcase toc={PRIMITIVE_TOC}>
      <PrimitiveSections />
    </KitShowcase>
  )
}
