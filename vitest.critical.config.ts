import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { installVitestEnv } from './vitest.env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  installVitestEnv(mode, __dirname)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'server-only': path.resolve(__dirname, './src/test/server-only.ts'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: [
        'src/app/api/paste-to-cheltuieli/__tests__/*.test.ts',
        'src/app/api/paste-to-investitii/__tests__/*.test.ts',
        'src/app/api/paste-to-recoltari/__tests__/*.test.ts',
        'src/app/api/parse-order/__tests__/*.test.ts',
        'src/app/api/shop/__tests__/*.test.ts',
        // Parantezele drepte din `[id]` se scriu ca `[[]id[]]`, altfel modelul le ia drept clasă de caractere.
        'src/app/api/shop/b2c/orders/[[]id[]]/__tests__/*.test.ts',
        'src/app/api/shop/b2c/notify/__tests__/*.test.ts',
        'src/app/api/gdpr/__tests__/*.test.ts',
        'src/app/api/invite/__tests__/*.test.ts',
        'src/app/api/farm-members/__tests__/*.test.ts',
        'src/app/api/farm/__tests__/*.test.ts',
        'src/app/api/livrator/__tests__/*.test.ts',
        'src/app/api/demo/__tests__/*.test.ts',
        'src/app/api/legal-docs/__tests__/*.test.ts',
        'src/app/api/chat/__tests__/*.test.ts',
        'src/app/api/cron/__tests__/*.test.ts',
        'src/app/api/integrations/google/__tests__/*.test.ts',
        'src/components/cheltuieli/__tests__/*.test.tsx',
        'src/components/investitii/__tests__/*.test.tsx',
        'src/components/kit/__tests__/*.test.{ts,tsx}',
        // Parantezele din `(dashboard)` se scriu ca `[(]` și `[)]`: altfel modelul le ia drept grup și nu găsește nimic.
        'src/app/[(]dashboard[)]/comenzi/__tests__/*.test.tsx',
        'src/components/comenzi/__tests__/*.test.tsx',
        'src/lib/__tests__/*.test.ts',
        // Navigarea operatorului (bara de jos, butonul „+”); restul testelor din folder nu sunt aici.
        'src/components/app/__tests__/BottomTabBar.operator.test.tsx',
        'src/lib/comenzi/__tests__/*.test.ts',
        'src/lib/livrari/__tests__/*.test.ts',
        'src/lib/vanzari/__tests__/*.test.ts',
        'src/app/api/livrari/__tests__/*.test.ts',
        'src/lib/auth/__tests__/*.test.ts',
        'src/lib/vanzari-butasi/__tests__/*.test.ts',
        'src/lib/integrations/__tests__/*.test.ts',
        'src/lib/logging/__tests__/*.test.ts',
        'src/lib/notifications/__tests__/preferinte.test.ts',
        'src/lib/notifications/__tests__/create.test.ts',
        'src/lib/notifications/__tests__/navigation.test.ts',
        'src/lib/notifications/zilnice/__tests__/*.test.ts',
        'supabase/functions/_shared/__tests__/*.test.ts',
        'src/lib/recoltari/__tests__/*.test.ts',
        'src/lib/tratamente/__tests__/*.test.ts',
        'src/lib/magazie/__tests__/*.test.ts',
        'src/lib/capcane/__tests__/*.test.ts',
        'src/lib/plan/__tests__/*.test.ts',
        'src/lib/analize/__tests__/*.test.ts',
        'src/lib/lucrari/__tests__/*.test.ts',
        'src/lib/echipa/__tests__/*.test.ts',
        'src/lib/acte/__tests__/*.test.{ts,tsx}',
        'src/lib/parcele/__tests__/parcela-fisa.test.ts',
        'src/lib/parcele/__tests__/formular-parcela.test.ts',
        'src/lib/parcele/__tests__/culturi-ferma.test.ts',
        'src/lib/demo/__tests__/demo-gata.test.ts',
        'src/lib/dashboard/__tests__/primii-pasi.test.ts',
        'src/components/acasa/__tests__/PrimiiPasiCard.test.tsx',
        'src/components/acasa/__tests__/NeincasatePeste30Acasa.test.tsx',
        'src/lib/rapoarte/__tests__/*.test.ts',
        'src/lib/stocuri/__tests__/*.test.ts',
        'src/lib/produse/__tests__/*.test.ts',
        'src/lib/security/__tests__/*.test.ts',
        'src/lib/supabase/queries/__tests__/financial-saves.test.ts',
        'src/lib/supabase/queries/__tests__/livreaza-si-copiaza.test.ts',
        'src/lib/supabase/queries/__tests__/client-sync-id.test.ts',
        'src/lib/supabase/queries/__tests__/ajustari-stoc-cheie.test.ts',
        'src/lib/supabase/queries/__tests__/produse-cultura.test.ts',
        'src/lib/tenant/__tests__/destructive-cleanup.test.ts',
        'src/lib/tenant/__tests__/demo-cleanup.test.ts',
        'src/lib/tenant/__tests__/tenant-cache.test.ts',
      ],
      exclude: ['node_modules', 'e2e', 'tests', '.next'],
    },
  }
})
