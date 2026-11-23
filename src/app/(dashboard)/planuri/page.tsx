import { Download, MessageCircle } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { StatHero, kitText } from '@/components/kit'
import { NavRow, RowGroup, ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { APP_NAME } from '@/lib/brand'
import { SUPPORT_WHATSAPP_URL } from '@/lib/support'
import { cn } from '@/lib/utils'

/**
 * „Planul tău” (promptul 31): cât e beta, fără prețuri și fără butoane de plată. Exportul e cel din Setări › Cont
 * (tabelele CSV, care se deschid în Excel).
 */
export default function PlanulTauPage() {
  return (
    <AppShell header={<ScreenHeader title="Planul tău" backHref="/mai-mult" />}>
      <ScreenBody className="space-y-4">
        <StatHero label={`Planul tău în ${APP_NAME}`} value="Gratuit în beta" footer={<p className={kitText.secondary}>toate modulele, fără limită de date</p>} />
        <p className={cn(kitText.base, 'text-fg')}>
          Când ies abonamentele, afli cu cel puțin o lună înainte. Datele rămân ale tale și le poți exporta oricând.
        </p>
        <RowGroup>
          <NavRow href="/settings/cont" label="Exportă tot în Excel" sub="tabelele fermei, câte unul pe modul" icon={<Download />} iconTone="primary" />
          <NavRow href={SUPPORT_WHATSAPP_URL} external label="Scrie-mi ce lipsește" sub="WhatsApp" icon={<MessageCircle />} iconTone="neutral" />
        </RowGroup>
      </ScreenBody>
    </AppShell>
  )
}
