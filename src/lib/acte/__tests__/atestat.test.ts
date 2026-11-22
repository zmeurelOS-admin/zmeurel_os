import { describe, expect, it } from 'vitest'

import {
  ATESTAT_LABEL,
  CONFIRMARE_ATESTAT_DETALIU,
  notificareAsociatieAtestatExpirat,
  notificareAtestatExpirat,
  notificareAtestatExpiraCurand,
} from '@/lib/acte/atestat'
import { lipsuriActe, stareActe } from '@/lib/acte/stare'
import { LEGAL_TYPE_LABELS, LEGAL_TYPE_OPTIONS, legalDocsFormSchema } from '@/lib/legal-docs/shared'

describe('„Atestat de producător” (nu „Certificat”)', () => {
  it('forma juridică se numește atestat, valoarea din bază rămâne certificat_producator', () => {
    expect(ATESTAT_LABEL).toBe('Atestat de producător')
    expect(LEGAL_TYPE_LABELS.certificat_producator).toBe('Atestat de producător')
    expect(LEGAL_TYPE_OPTIONS[0]).toEqual({ value: 'certificat_producator', label: 'Atestat de producător' })
  })

  it('lipsurile spun „atestatului” și „valabilitatea”, nu „certificatului” / „viza”', () => {
    const etichete = lipsuriActe({ legal_type: 'certificat_producator' }).map((item) => item.eticheta)
    expect(etichete).toContain('numărul atestatului')
    expect(etichete).toContain('seria atestatului')
    expect(etichete).toContain('valabilitatea')
    expect(etichete).toContain('poza atestatului')
    expect(etichete.join(' ')).not.toMatch(/certificat|viz/i)
    expect(stareActe({ legal_type: 'certificat_producator' }).detaliu ?? '').not.toMatch(/certificat|viz/i)
  })

  it('erorile de validare vorbesc de atestat', () => {
    const parsed = legalDocsFormSchema.safeParse({
      full_name: 'Ana',
      legal_type: 'certificat_producator',
      locality: 'Văratec',
      phone: '0740123456',
      certificate_photo_url: 'x/y.png',
      accepted: true,
    })
    expect(parsed.success).toBe(false)
    const mesaje = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
    expect(mesaje).toContain('Seria atestatului este obligatorie.')
    expect(mesaje).toContain('Numărul atestatului este obligatoriu.')
    expect(mesaje.join(' ')).not.toMatch(/certificat|viz/i)
  })

  it('confirmarea spune exact ce apare public', () => {
    expect(CONFIRMARE_ATESTAT_DETALIU).toBe(
      'Când magazinul și asociația revin, public apar doar numele fermei, localitatea, seria și valabilitatea atestatului și telefonul de contact. Numărul și poza atestatului nu se afișează.',
    )
  })

  it('notificările din cron spun „atestat” și „valabil până la”', () => {
    const toate = [
      notificareAtestatExpiraCurand('2026-12-15'),
      notificareAtestatExpirat('2026-11-01'),
      notificareAsociatieAtestatExpirat('Ferma Ana', '2026-11-01'),
    ]
    for (const n of toate) {
      expect(`${n.title} ${n.body}`).toMatch(/atestat/i)
      expect(`${n.title} ${n.body}`).not.toMatch(/certificat|viz/i)
    }
    expect(notificareAtestatExpiraCurand('2026-12-15').body).toContain('valabil până la 15 decembrie 2026')
  })
})
