import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { KgField, kgFieldLabel, useKeypadFields } from '@/components/kit/KgField'
import { NumericKeypad } from '@/components/kit/NumericKeypad'

function Cantar() {
  const fields = useKeypadFields({ fields: ['cal1', 'cal2'] as const })
  return (
    <>
      <KgField
        label="Calitatea 1"
        value={fields.values.cal1}
        active={fields.active === 'cal1'}
        onActivate={() => fields.setActive('cal1')}
      />
      <KgField
        label="Calitatea 2"
        size="md"
        value={fields.values.cal2}
        active={fields.active === 'cal2'}
        onActivate={() => fields.setActive('cal2')}
      />
      <NumericKeypad onKey={fields.press} />
      <output data-testid="numere">{JSON.stringify(fields.numbers)}</output>
      <button type="button" onClick={fields.reset}>
        Golește
      </button>
      <button type="button" onClick={() => fields.setValue('cal1', 27.35)}>
        Pune valoarea salvată
      </button>
      <button type="button" onClick={() => fields.setValue('cal2', 'nu e număr')}>
        Pune text nevalid
      </button>
    </>
  )
}

const press = async (user: ReturnType<typeof userEvent.setup>, keys: string[]) => {
  const keypad = screen.getByRole('group', { name: 'Tastatură numerică' })
  for (const key of keys) {
    const name = key === ',' ? 'virgulă' : key === 'backspace' ? 'Șterge ultima cifră' : key
    const button = Array.from(keypad.querySelectorAll('button')).find(
      (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent) === name,
    )
    if (!button) throw new Error(`Tasta „${key}” nu există`)
    await user.click(button)
  }
}

describe('KgField cu tastatura din aplicație', () => {
  it('pornește gol, fără valoare propusă, cu primul câmp activ', () => {
    render(<Cantar />)

    expect(screen.getByRole('button', { name: 'Calitatea 1, necompletat, activ' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Calitatea 2, necompletat' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('numere')).toHaveTextContent('{"cal1":null,"cal2":null}')
  })

  it('tastele scriu în câmpul activ, cu o singură virgulă și cel mult 2 zecimale', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await press(user, ['2', '7', ',', ',', '3', '5', '9'])

    expect(screen.getByRole('button', { name: 'Calitatea 1, 27,35 kg, activ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calitatea 2, necompletat' })).toBeInTheDocument()
    expect(screen.getByTestId('numere')).toHaveTextContent('{"cal1":27.35,"cal2":null}')
  })

  it('după schimbarea câmpului activ, tastele ajung în celălalt câmp', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await press(user, ['2', '7'])
    await user.click(screen.getByRole('button', { name: 'Calitatea 2, necompletat' }))
    await press(user, ['3', ',', '5'])

    expect(screen.getByRole('button', { name: 'Calitatea 1, 27 kg' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Calitatea 2, 3,5 kg, activ' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('numere')).toHaveTextContent('{"cal1":27,"cal2":3.5}')
  })

  it('ștergerea scoate ultima cifră din câmpul activ', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await press(user, ['2', '7', 'backspace'])
    expect(screen.getByRole('button', { name: 'Calitatea 1, 2 kg, activ' })).toBeInTheDocument()

    await press(user, ['backspace'])
    expect(screen.getByRole('button', { name: 'Calitatea 1, necompletat, activ' })).toBeInTheDocument()
  })

  it('merge și cu tastatura fizică', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await user.keyboard('12.5')
    expect(screen.getByRole('button', { name: 'Calitatea 1, 12,5 kg, activ' })).toBeInTheDocument()

    await user.keyboard('{Backspace}')
    expect(screen.getByRole('button', { name: 'Calitatea 1, 12, kg, activ' })).toBeInTheDocument()
  })

  it('setValue pune o valoare existentă, iar tastele scriu în continuarea ei', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await user.click(screen.getByRole('button', { name: 'Pune valoarea salvată' }))
    expect(screen.getByRole('button', { name: 'Calitatea 1, 27,35 kg, activ' })).toBeInTheDocument()
    expect(screen.getByTestId('numere')).toHaveTextContent('{"cal1":27.35,"cal2":null}')

    await press(user, ['backspace', '8'])
    expect(screen.getByRole('button', { name: 'Calitatea 1, 27,38 kg, activ' })).toBeInTheDocument()
  })

  it('setValue cu o valoare nevalidă lasă câmpul necompletat și nu atinge celelalte câmpuri', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await press(user, ['9'])
    await user.click(screen.getByRole('button', { name: 'Pune text nevalid' }))

    expect(screen.getByRole('button', { name: 'Calitatea 1, 9 kg, activ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calitatea 2, necompletat' })).toBeInTheDocument()
  })

  it('golirea readuce toate câmpurile la necompletat și primul câmp activ', async () => {
    const user = userEvent.setup()
    render(<Cantar />)

    await press(user, ['9'])
    await user.click(screen.getByRole('button', { name: 'Calitatea 2, necompletat' }))
    await press(user, ['4'])
    await user.click(screen.getByRole('button', { name: 'Golește' }))

    expect(screen.getByRole('button', { name: 'Calitatea 1, necompletat, activ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calitatea 2, necompletat' })).toBeInTheDocument()
  })
})

describe('KgField — accesibilitate', () => {
  it('eticheta spune câmpul, valoarea și starea', () => {
    expect(kgFieldLabel('Calitatea 1', '27,35', 'kg', true)).toBe('Calitatea 1, 27,35 kg, activ')
    expect(kgFieldLabel('Calitatea 1', '27,35', 'kg', false)).toBe('Calitatea 1, 27,35 kg')
    expect(kgFieldLabel('Calitatea 2', '', 'kg', true)).toBe('Calitatea 2, necompletat, activ')
  })

  it('valoarea se anunță politicos la fiecare schimbare', async () => {
    const user = userEvent.setup()
    const { container } = render(<Cantar />)

    const regions = container.querySelectorAll('[aria-live="polite"]')
    expect(regions).toHaveLength(2)
    const [cal1Region, cal2Region] = Array.from(regions)
    expect(cal1Region).toHaveAttribute('aria-atomic', 'true')

    await press(user, ['2'])
    expect(cal1Region).toHaveTextContent('Calitatea 1: 2 kg')

    await press(user, ['7', ',', '3'])
    expect(cal1Region).toHaveTextContent('Calitatea 1: 27,3 kg')

    // Câmpul inactiv tace; după activare anunță el.
    expect(cal2Region).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: 'Calitatea 2, necompletat' }))
    expect(cal1Region).toBeEmptyDOMElement()
    expect(cal2Region).toHaveTextContent('Calitatea 2: necompletat')
  })

  it('câmpul nu e un <input>, deci tastatura telefonului nu se deschide', () => {
    const { container } = render(<Cantar />)
    expect(container.querySelector('input')).toBeNull()
  })
})
