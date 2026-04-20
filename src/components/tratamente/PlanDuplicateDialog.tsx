'use client'

import { useEffect, useState } from 'react'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface PlanDuplicateDialogProps {
  initialName: string
  onOpenChange: (open: boolean) => void
  onSubmit: (numeNou: string) => Promise<void> | void
  open: boolean
  pending?: boolean
}

export function PlanDuplicateDialog({
  initialName,
  onOpenChange,
  onSubmit,
  open,
  pending = false,
}: PlanDuplicateDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [numeNou, setNumeNou] = useState(`${initialName} (copie)`)

  useEffect(() => {
    if (!open) return
    setNumeNou(`${initialName} (copie)`)
  }, [initialName, open])

  const content = (
    <div className="space-y-2">
      <Label htmlFor="duplicate-plan-name">Nume plan nou</Label>
      <Input
        id="duplicate-plan-name"
        value={numeNou}
        onChange={(event) => setNumeNou(event.target.value)}
        placeholder="Ex: Plan zmeur primăvară (copie)"
      />
    </div>
  )

  const footer = (
    <DialogFormActions
      onCancel={() => onOpenChange(false)}
      onSave={async () => {
        await onSubmit(numeNou)
      }}
      saving={pending}
      disabled={pending || numeNou.trim().length === 0}
      saveLabel="Duplică planul"
    />
  )

  if (isMobile) {
    return (
      <AppDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Duplică planul"
        description="Creează o copie a planului cu toate liniile lui."
        footer={footer}
      >
        {content}
      </AppDrawer>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Duplică planul"
      description="Creează o copie a planului cu toate liniile lui."
      footer={footer}
    >
      {content}
    </AppDialog>
  )
}
