'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NumericFieldProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  label: string
  error?: string
}

export function NumericField({ label, error, className, id, ...props }: NumericFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className={cn('agri-control h-12 px-3 text-base', className)}
        {...props}
      />
      {error ? <p className="text-xs text-[var(--status-danger-text)]">{error}</p> : null}
    </div>
  )
}
