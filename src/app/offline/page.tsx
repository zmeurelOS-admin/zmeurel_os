'use client'

import Image from 'next/image'

export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <div className="mb-6">
        <Image src="/icons/icon.svg" alt="Zmeurel" width={72} height={72} priority />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ești offline</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Ești offline. Verifică conexiunea. Când revii online, apasă butonul de mai jos pentru a
        reîncărca aplicația.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Reîncearcă
      </button>
    </main>
  )
}
