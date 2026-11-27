import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListRow } from '@/components/kit/ListRow'

describe('ListRow', () => {
  it('titlul trece pe cel mult două rânduri, nu se taie cu „…” pe un rând (promptul 34, §6)', () => {
    render(<ListRow title="Analiza sezonului: netrimisă, memento pornit" detail="trimite o probă înainte de cules" />)
    const titlu = screen.getByText('Analiza sezonului: netrimisă, memento pornit')
    expect(titlu.className).toContain('line-clamp-2')
    expect(titlu.className).toContain('break-words')
    expect(titlu.className).not.toContain('truncate')
  })
})
