import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Tile, TileGroup, nextMultipleTileValue, nextSingleTileValue } from '@/components/kit'

describe('Tile — logica de selecție', () => {
  it('alegere unică: placa apăsată înlocuiește selecția', () => {
    expect(nextSingleTileValue(null, 'ana')).toBe('ana')
    expect(nextSingleTileValue('ana', 'ion')).toBe('ion')
  })

  it('alegere unică: aceeași placă rămâne aleasă, dacă deselectarea nu e permisă', () => {
    expect(nextSingleTileValue('ana', 'ana')).toBe('ana')
    expect(nextSingleTileValue('ana', 'ana', true)).toBeNull()
  })

  it('alegere multiplă: placa apăsată intră în listă sau iese din ea', () => {
    expect(nextMultipleTileValue([], 'ana')).toEqual(['ana'])
    expect(nextMultipleTileValue(['ana'], 'ion')).toEqual(['ana', 'ion'])
    expect(nextMultipleTileValue(['ana', 'ion'], 'ana')).toEqual(['ion'])
  })
})

function SingleGroup({ onChange }: { onChange: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <TileGroup
      type="single"
      aria-label="Culegător"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    >
      <Tile value="ana" title="Ana" />
      <Tile value="ion" title="Ion" />
      <Tile value="maria" title="Maria" disabled />
    </TileGroup>
  )
}

function MultipleGroup({ onChange }: { onChange: (value: string[]) => void }) {
  const [value, setValue] = useState<string[]>([])
  return (
    <TileGroup
      type="multiple"
      aria-label="Zile"
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    >
      <Tile value="luni" title="Luni" />
      <Tile value="marti" title="Marți" />
    </TileGroup>
  )
}

describe('Tile — în grup', () => {
  it('alegere unică: roluri de radio, nimic preselectat, o singură placă aleasă', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleGroup onChange={onChange} />)

    expect(screen.getByRole('radiogroup', { name: 'Culegător' })).toBeInTheDocument()
    const ana = screen.getByRole('radio', { name: 'Ana' })
    const ion = screen.getByRole('radio', { name: 'Ion' })
    expect(ana).toHaveAttribute('aria-checked', 'false')
    expect(ion).toHaveAttribute('aria-checked', 'false')

    await user.click(ana)
    expect(ana).toHaveAttribute('aria-checked', 'true')

    await user.click(ion)
    expect(ana).toHaveAttribute('aria-checked', 'false')
    expect(ion).toHaveAttribute('aria-checked', 'true')
    expect(onChange).toHaveBeenLastCalledWith('ion')
  })

  it('alegere unică: săgețile mută selecția și sar peste plăcile dezactivate', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleGroup onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Ana' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Ion' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Ion' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Ana' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Maria' })).toHaveAttribute('aria-checked', 'false')
  })

  it('alegere multiplă: roluri de checkbox, mai multe plăci alese deodată', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultipleGroup onChange={onChange} />)

    const luni = screen.getByRole('checkbox', { name: 'Luni' })
    const marti = screen.getByRole('checkbox', { name: 'Marți' })

    await user.click(luni)
    await user.click(marti)
    expect(luni).toHaveAttribute('aria-checked', 'true')
    expect(marti).toHaveAttribute('aria-checked', 'true')
    expect(onChange).toHaveBeenLastCalledWith(['luni', 'marti'])

    await user.click(luni)
    expect(luni).toHaveAttribute('aria-checked', 'false')
    expect(onChange).toHaveBeenLastCalledWith(['marti'])
  })

  it('fără grup, placa e un buton de acțiune', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Tile title="Culegător nou" dashed onClick={onClick} />)

    const tile = screen.getByRole('button', { name: 'Culegător nou' })
    expect(tile).not.toHaveAttribute('aria-checked')
    await user.click(tile)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
