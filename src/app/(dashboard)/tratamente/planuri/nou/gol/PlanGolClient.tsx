'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { creeazaPlanGolAction } from '@/app/(dashboard)/tratamente/planuri/actions'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/ui/toast'

export function PlanGolClient({ culturi }: { culturi: string[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [culture, setCulture] = useState(culturi[0] ?? 'zmeur')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Completează numele planului.')
      return
    }

    setSaving(true)
    try {
      const result = await creeazaPlanGolAction({ nume: name, culturaTip: culture })
      toast.success('Planul gol a fost creat.')
      router.push(`/tratamente/planuri/${result.planId}/editor`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Planul nu a putut fi creat.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell header={<PageHeader title="Plan gol" subtitle="Construiește de la zero" expandRightSlotOnMobile />}>
      <div className="mx-auto w-full max-w-2xl py-3 md:py-5">
        <AppCard className="rounded-[24px] p-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empty-plan-name">Nume plan</Label>
              <Input
                id="empty-plan-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Plan Maravilla 2026"
              />
            </div>
            <AppSelect
              id="empty-plan-culture"
              label="Cultură"
              value={culture}
              options={(culturi.length > 0 ? culturi : ['zmeur']).map((cultura) => ({
                value: cultura,
                label: cultura,
                emoji: '🌱',
              }))}
              triggerClassName="h-11 rounded-xl text-sm"
              onChange={setCulture}
            />
            <Button
              type="button"
              className="w-full bg-[var(--agri-primary)] text-white sm:w-auto"
              disabled={saving || !name.trim()}
              onClick={() => void handleSubmit()}
            >
              {saving ? 'Se creează...' : 'Creează plan gol'}
            </Button>
          </div>
        </AppCard>
      </div>
    </AppShell>
  )
}
