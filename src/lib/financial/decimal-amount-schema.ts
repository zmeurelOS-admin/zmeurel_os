import * as z from 'zod'

/** Acceptă separatorul zecimal românesc și produce forma canonică pentru API/DB. */
export const decimalAmountSchema = (requiredMessage = 'Suma este obligatorie') =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .transform((value) => value.replace(',', '.'))
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'Suma trebuie să fie pozitivă',
    })
