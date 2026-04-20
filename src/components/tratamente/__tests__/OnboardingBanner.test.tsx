import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OnboardingBanner } from '@/components/tratamente/OnboardingBanner'

describe('OnboardingBanner', () => {
  it('afișează bannerul și CTA-ul de start când niciun pas nu este completat', () => {
    render(<OnboardingBanner arePlan={false} areParceleCuPlan={false} areStadii={false} />)

    expect(screen.getByText('Bun venit în modulul Protecție & Nutriție!')).toBeInTheDocument()
    const startLink = screen.getByRole('link', { name: /Începe/i })
    expect(startLink).toHaveAttribute('href', '/tratamente/planuri/nou')
  })

  it('marchează primul pas completat și activează vizual pasul al doilea', () => {
    render(<OnboardingBanner arePlan areParceleCuPlan={false} areStadii={false} />)

    expect(screen.getByText('Asignează planul la o parcelă')).toBeInTheDocument()
    expect(screen.getByText('Creează primul plan de tratament')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Începe/i })).not.toBeInTheDocument()
  })

  it('dispare complet când toți pașii sunt finalizați', () => {
    const { container } = render(<OnboardingBanner arePlan areParceleCuPlan areStadii />)
    expect(container).toBeEmptyDOMElement()
  })

  it('trimite CTA-ul spre wizardul de planuri', () => {
    render(<OnboardingBanner arePlan={false} areParceleCuPlan={false} areStadii={false} />)
    expect(screen.getByRole('link', { name: /Începe/i })).toHaveAttribute('href', '/tratamente/planuri/nou')
  })
})
