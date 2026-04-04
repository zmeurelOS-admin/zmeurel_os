import Image from 'next/image'

import { cn } from '@/lib/utils'

type Props = {
  src: string | null
  alt: string
  className?: string
  priority?: boolean
  sizes?: string
}

/** Imagine produs — `next/image` cu `unoptimized` pentru URL-uri storage arbitrare. */
export function AssociationProductImage({ src, alt, className, priority, sizes }: Props) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-[#F5EDCA] text-4xl opacity-50',
          className,
        )}
        aria-hidden
      >
        🫐
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      sizes={sizes ?? '(max-width: 640px) 50vw, 25vw'}
      className={cn('object-cover', className)}
    />
  )
}
