'use client'

import { useState, useTransition, type ReactNode } from 'react'

import { fetchAplicareEditAction, type AplicareEditData } from '@/app/(dashboard)/tratamente/actions'
import { Button } from '@/components/ui/button'
import { MarkAplicataSheet } from '@/components/tratamente/MarkAplicataSheet'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

type EditAplicareButtonProps = {
  aplicareId: string
  children?: ReactNode
  className?: string
  disabled?: boolean
  produseFitosanitare?: ProdusFitosanitar[]
  size?: 'sm' | 'default'
  variant?: 'ghost' | 'outline' | 'default'
}

export function EditAplicareButton({
  aplicareId,
  children = 'Vezi aplicarea',
  className,
  disabled = false,
  produseFitosanitare = [],
  size = 'sm',
  variant = 'outline',
}: EditAplicareButtonProps) {
  const [open, setOpen] = useState(false)
  const [aplicare, setAplicare] = useState<AplicareEditData | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleOpen = () => {
    startTransition(async () => {
      const result = await fetchAplicareEditAction(aplicareId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setAplicare(result.data)
      setOpen(true)
    })
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={disabled || isPending}
        onClick={handleOpen}
      >
        {isPending ? 'Se încarcă...' : children}
      </Button>

      {aplicare ? (
        <MarkAplicataSheet
          mode="edit"
          aplicareExistenta={aplicare}
          defaultCantitateMl={null}
          defaultOperator={aplicare.operator ?? ''}
          defaultStadiu={aplicare.stadiuLaAplicare}
          meteoSnapshot={null}
          onOpenChange={setOpen}
          onSubmit={async () => {}}
          open={open}
          produseFitosanitare={produseFitosanitare}
        />
      ) : null}
    </>
  )
}
