import Image from 'next/image'

import { cn } from '@/lib/utils'

/** Imagine hero (produse proaspete) — sursă Unsplash, optimizată cu next/image. */
const HERO_IMAGE_SRC =
  'https://images.unsplash.com/photo-1466692476863-aef1dfb29e85?auto=format&fit=crop&w=1400&q=82'

export function AssociationHeroVisual({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-2xl border border-black/[0.07] bg-[#e5e0d8] md:max-w-none',
        className,
      )}
    >
      <Image
        src={HERO_IMAGE_SRC}
        alt="Produse proaspete — fructe și legume locale"
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover"
        priority
      />
    </div>
  )
}
