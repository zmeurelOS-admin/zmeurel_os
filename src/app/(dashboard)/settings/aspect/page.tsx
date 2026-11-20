'use client'

import { useTheme } from 'next-themes'

import { AppShell } from '@/components/app/AppShell'
import { useDensity, type DensityMode } from '@/components/app/DensityProvider'
import { useHighContrast } from '@/components/app/HighVisibilityInit'
import { ListRow, Segments, ToggleRow, kitText } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useHydrated } from '@/components/setari/useHydrated'
import { cn } from '@/lib/utils'

type ThemeChoice = 'system' | 'light' | 'dark'

/**
 * Setări › Aspect. Toate alegerile rămân pe acest dispozitiv, ca înainte:
 * tema prin next-themes, mărimea prin `data-density` (DensityProvider), contrastul prin `high-visibility-mode`.
 * Previzualizarea folosește componentele reale, deci arată exact schimbarea.
 */
export default function SettingsAspectPage() {
  const { theme, setTheme } = useTheme()
  const { density, setDensity } = useDensity()
  const [highContrast, setHighContrast] = useHighContrast()
  const mounted = useHydrated()

  const themeValue: ThemeChoice = mounted && (theme === 'light' || theme === 'dark') ? theme : 'system'
  // Mărimea e citită din localStorage: până la hidratare arătăm valoarea de pe server.
  const densityValue: DensityMode = mounted ? density : 'normal'

  return (
    <AppShell header={<ScreenHeader title="Aspect" backHref="/settings" />}>
      <ScreenBody className="space-y-5">
        <section className="space-y-2">
          <h2 className={cn('font-bold text-fg', kitText.secondary)}>Zi sau noapte</h2>
          <Segments<ThemeChoice>
            aria-label="Zi sau noapte"
            value={themeValue}
            onValueChange={(value) => setTheme(value)}
            options={[
              { value: 'system', label: 'Automat' },
              { value: 'light', label: 'Zi' },
              { value: 'dark', label: 'Noapte' },
            ]}
          />
          <p className={cn('text-fg-muted', kitText.helper)}>Automat urmează telefonul: noaptea se întunecă singur.</p>
        </section>

        <section className="space-y-2">
          <h2 className={cn('font-bold text-fg', kitText.secondary)}>Mărimea textului și a butoanelor</h2>
          <Segments<DensityMode>
            aria-label="Mărimea textului și a butoanelor"
            value={densityValue}
            onValueChange={setDensity}
            options={[
              { value: 'normal', label: 'Normală' },
              { value: 'large', label: 'Mare' },
            ]}
          />
        </section>

        <ToggleRow
          title="Contrast ridicat"
          subtitle="Pentru soare puternic, afară"
          checked={highContrast}
          onCheckedChange={setHighContrast}
        />

        <section className="space-y-2">
          <h2 className={cn('font-bold text-fg', kitText.secondary)}>Așa arată</h2>
          <div className="space-y-2.5 rounded-card border border-border bg-page p-3.5" aria-hidden inert>
            <ListRow title="Elena Pop" detail="20 butași · 25 nov." avatar="EP" trailing={<span className={cn('font-extrabold text-fg', kitText.base)}>240 lei</span>} />
            <div className={cn('flex h-touch-lg items-center justify-center rounded-box bg-primary font-bold text-primary-contrast', kitText.base)}>
              Comandă nouă
            </div>
          </div>
        </section>
      </ScreenBody>
    </AppShell>
  )
}
