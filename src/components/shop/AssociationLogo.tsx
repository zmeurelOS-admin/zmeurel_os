import Image from 'next/image'

import { cn } from '@/lib/utils'

export type AssociationLogoProps = {
  /** `light` = pe fundal crem (text verde); `dark` = pe fundal verde închis sau brand (text crem). */
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

export function AssociationLogo({
  variant = 'light',
  size = 'md',
  showTagline = false,
  className,
}: AssociationLogoProps) {
  const width = size === 'sm' ? 120 : size === 'lg' ? 190 : 160
  const height = size === 'sm' ? 30 : size === 'lg' ? 48 : 40
  const src =
    variant === 'dark'
      ? '/images/gusta-logo-white.png'
      : '/images/gusta-logo-horizontal.png'

  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1', className)}>
      <Image
        src={src}
        alt="Gustă din Bucovina"
        width={width}
        height={height}
        className="h-auto w-auto max-w-full"
        priority={size !== 'sm'}
      />
      {showTagline ? (
        <p className="truncate text-[0.7rem] font-medium text-white/70 sm:text-xs">
          Magazin asociație
        </p>
      ) : null}
    </div>
  )
}
