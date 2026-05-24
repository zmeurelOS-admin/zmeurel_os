import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

function resolveTrigger(trigger: HTMLElement | string | RegExp): HTMLElement {
  if (typeof trigger === 'string' || trigger instanceof RegExp) {
    return screen.getByLabelText(trigger)
  }
  return trigger
}

async function openListbox(user: UserEvent, triggerEl: HTMLElement): Promise<HTMLElement> {
  await user.click(triggerEl)

  const listboxId = triggerEl.getAttribute('aria-controls')
  if (listboxId) {
    return waitFor(() => {
      const listbox = document.getElementById(listboxId)
      if (!listbox) {
        throw new Error(`Listbox ${listboxId} not found`)
      }
      return listbox
    })
  }

  return screen.findByRole('listbox')
}

function findOptionInListbox(listbox: HTMLElement, option: string): HTMLElement {
  const byValue = listbox.querySelector(`[role="option"][data-value="${CSS.escape(option)}"]`)
  if (byValue) return byValue as HTMLElement

  return within(listbox).getByRole('option', { name: option })
}

/**
 * Selectează o opțiune din AppSelect: deschide lista, apoi click pe opțiune (după value sau label).
 */
export async function selectAppOption(
  user: UserEvent,
  trigger: HTMLElement | string | RegExp,
  option: string
): Promise<void> {
  const triggerEl = resolveTrigger(trigger)
  const listbox = await openListbox(user, triggerEl)
  const optionEl = findOptionInListbox(listbox, option)
  await user.click(optionEl)
}

/**
 * Deschide AppSelect și returnează valorile `data-value` ale opțiunilor vizibile.
 */
export async function getAppSelectOptionValues(
  user: UserEvent,
  trigger: HTMLElement | string | RegExp
): Promise<string[]> {
  const triggerEl = resolveTrigger(trigger)
  const listbox = await openListbox(user, triggerEl)

  return within(listbox)
    .getAllByRole('option')
    .map((option) => option.getAttribute('data-value'))
    .filter((value): value is string => Boolean(value))
}
