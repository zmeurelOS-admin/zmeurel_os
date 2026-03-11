'use client'

import Link from 'next/link'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'

export default function PlanuriPage() {
  return (
    <AppShell header={<PageHeader title="Planuri" subtitle="Planuri și abonamente" />}>
      <div className="mx-auto mt-4 w-full max-w-3xl py-6 sm:mt-0">
        <section className="agri-card space-y-3 p-4">
          <h1 className="text-xl font-bold text-[var(--agri-text)]">Toate functionalitatile sunt deblocate in beta.</h1>
          <p className="text-sm text-[var(--agri-text-muted)]">
            Abonamentele ți limitarile de plan sunt suspendate temporar. Poti folosi toate modulele f?r? upgrade.
          </p>
          <Button asChild className="agri-cta w-full sm:w-auto">
            <Link href="/dashboard">Inapoi la dashboard</Link>
          </Button>
        </section>
      </div>
    </AppShell>
  )
}
