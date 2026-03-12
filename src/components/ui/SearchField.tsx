'use client'

import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type SearchFieldProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  containerClassName?: string
}

export function SearchField({ containerClassName, className, ...props }: SearchFieldProps) {
  return (
    <div className={cn('relative', containerClassName)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--agri-text-muted)]"
        aria-hidden
      />
      <Input type="search" className={cn('agri-control h-12 pl-10', className)} {...props} />
    </div>
  )
}

