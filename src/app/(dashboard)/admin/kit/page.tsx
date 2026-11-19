import type { Metadata } from 'next'

import { KitShowcase } from './KitShowcaseClient'
import { COMPUSE_TOC, PRIMITIVE_TOC } from './kit-demo-data'
import { CompuseSections } from './sections-compuse'
import { PrimitiveSections } from './sections-primitive'

export const metadata: Metadata = {
  title: 'Kit de componente',
  robots: { index: false, follow: false },
}

/** Pagina kitului. Accesul e verificat de `admin/layout.tsx` (doar superadmin). */
export default function AdminKitPage() {
  return (
    <KitShowcase toc={[...PRIMITIVE_TOC, ...COMPUSE_TOC]}>
      <PrimitiveSections />
      <CompuseSections />
    </KitShowcase>
  )
}
