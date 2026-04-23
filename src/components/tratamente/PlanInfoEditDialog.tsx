'use client'

import { useEffect, useState } from 'react'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface PlanInfoEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDescriere?: string | null
  initialNume: string
  onSubmit: (data: { nume: string; descriere?: string | null }) => Promise<void> | void
  pending?: boolean
}

export function PlanInfoEditDialog({
  open,
  onOpenChange,
  initialDescriere,
  initialNume,
  onSubmit,
  pending = false,
}: PlanInfoEditDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [nume, setNume] = useState(initialNume)
  const [descriere, setDescriere] = useState(initialDescriere ?? '')

  useEffect(() => {
    if (!open) return
    setNume(initialNume)
    setDescriere(initialDescriere ?? '')
  }, [initialDescriere, initialNume, open])

  const saveDisabled = pending || nume.trim().length === 0

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plan-info-nume">Nume plan</Label>
        <Input
          id="plan-info-nume"
          value={nume}
          onChange={(event) => setNume(event.target.value)}
          placeholder="Ex: Plan zmeur primăvară"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-info-descriere">Descriere</Label>
        <Textarea
          id="plan-info-descriere"
          value={descriere}
          onChange={(event) => setDescriere(event.target.value)}
          rows={4}
          placeholder="Note despre strategie, produse sau observații de sezon."
        />
      </div>
    </div>
  )

  const footer = (
    <DialogFormActions
      onCancel={() => onOpenChange(false)}
      onSave={async () => {
        await onSubmit({
          nume,
          descriere: descriere.trim() ? descriere.trim() : null,
        })
      }}
      saving={pending}
      disabled={saveDisabled}
      saveLabel="Salvează"
    />
  )

  if (isMobile) {
    return (
      <AppDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Editează planul"
        description="Actualizează numele și descrierea planului."
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
      title="Editează planul"
      description="Actualizează numele și descrierea planului."
      footer={footer}
    >
      {content}
    </AppDialog>
  )
}
