import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListRow } from '@/components/kit/ListRow'

describe('ListRow', () => {
  it('titlul și detaliul se văd întregi, pe câte rânduri au nevoie, fără „…” (promptul 34, §6 și §9)', () => {
    render(<ListRow title="Analiza sezonului: netrimisă, memento pornit" detail="trimite o probă înainte de cules" />)
    const titlu = screen.getByText('Analiza sezonului: netrimisă, memento pornit')
    expect(titlu.className).toContain('break-words')
    expect(titlu.className).not.toMatch(/truncate|line-clamp/)
    expect(screen.getByText('trimite o probă înainte de cules').className).not.toMatch(/truncate|line-clamp/)
  })
})
