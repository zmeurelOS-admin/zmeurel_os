import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LegalDocsPersistentBanner } from '@/components/legal-docs/LegalDocsPersistentBanner'
import { bannerActeDinLayout } from '@/lib/acte/stare'

/** Rândul din `farmer_legal_docs`, cu certificat complet. */
const DOC_COMPLET = {
  full_name: 'Andrei Popa',
  legal_type: 'certificat_producator' as const,
  locality: 'Văratec',
  phone: '0744123456',
  certificate_photo_url: 't/doc.png',
  legal_accepted_at: '2026-03-01T10:00:00Z',
  certificate_series: 'SV',
  certificate_number: '123',
  certificate_expiry: '2027-04-03',
  cui: null,
}

/**
 * Exact ce face layout-ul: textul din `bannerActeDinLayout`, apoi `<LegalDocsPersistentBanner>` doar dacă e text.
 * Acoperă bannerul fără un demo cu acte incomplete (din aplicație nu se poate goli un act).
 */
function Layout(props: Parameters<typeof bannerActeDinLayout>[0]) {
  const text = bannerActeDinLayout(props)
  return <div data-testid="shell">{text ? <LegalDocsPersistentBanner mesaj={text} /> : null}</div>
}

describe('bannerul cu actele lipsă (layout)', () => {
  it('lipsesc seria și viza: textul spune ce lipsește și bannerul se vede, cu linkul spre acte', () => {
    const doc = { ...DOC_COMPLET, certificate_series: '', certificate_expiry: null }
    expect(bannerActeDinLayout({ memberRole: null, complete: false, doc })).toBe(
      'Actele fermei: lipsesc 2 date (seria atestatului și valabilitatea).',
    )

    render(<Layout memberRole={null} complete={false} doc={doc} />)
    expect(screen.getByText(/Actele fermei: lipsesc 2 date/)).toBeInTheDocument()
    expect(screen.getByText(/Fără ele nu poți vinde prin platformă/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Completează actele' })).toHaveAttribute('href', '/settings/ferma/acte')
  })

  it('fără niciun act salvat: banner cu toate datele lipsă', () => {
    const text = bannerActeDinLayout({ memberRole: null, complete: false, doc: null })
    expect(text).toMatch(/^Actele fermei: lipsesc \d+ date \(forma juridică, localitatea, numele, telefonul/)
  })

  it('acte validate în bază: niciun banner', () => {
    expect(bannerActeDinLayout({ memberRole: null, complete: true, doc: DOC_COMPLET })).toBeNull()
    render(<Layout memberRole={null} complete doc={DOC_COMPLET} />)
    expect(screen.getByTestId('shell')).toBeEmptyDOMElement()
  })

  it('operatorul nu vede bannerul, chiar dacă actele lipsesc (Setări îi sunt blocate)', () => {
    expect(bannerActeDinLayout({ memberRole: 'operator', complete: false, doc: null })).toBeNull()
    render(<Layout memberRole="operator" complete={false} doc={null} />)
    expect(screen.getByTestId('shell')).toBeEmptyDOMElement()
  })

  it('date complete în formular, dar nevalidate în bază: textul cere verificarea', () => {
    expect(bannerActeDinLayout({ memberRole: null, complete: false, doc: DOC_COMPLET })).toBe(
      'Actele fermei nu sunt încă validate. Verifică-le.',
    )
  })
})
