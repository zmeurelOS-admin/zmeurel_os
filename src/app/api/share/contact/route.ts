import { NextResponse } from 'next/server'

import { parseSharedContact } from '@/lib/vanzari-butasi/shared-contact'

export const runtime = 'nodejs'

const TARGET = '/vanzari-butasi'
const MAX_FILE_BYTES = 256 * 1024

/**
 * Web Share Target (manifest → share_target): primește un contact distribuit din aplicația Contacte
 * și deschide comanda nouă de material săditor cu numele și telefonul completate.
 * Nu scrie nimic în baza de date și nu cere autentificare: doar citește contactul trimis
 * și redirecționează către pagină (care e protejată). Datele merg în fragmentul URL (#),
 * care nu ajunge la server și e șters de pagină imediat după citire.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const parts: string[] = []

    for (const value of form.getAll('contact')) {
      if (typeof value !== 'string' && value.size > 0 && value.size <= MAX_FILE_BYTES) {
        parts.push(await value.text())
      }
    }
    for (const key of ['text', 'title']) {
      const value = form.get(key)
      if (typeof value === 'string' && value.trim()) parts.push(value)
    }

    // Preferăm vCard-ul; altfel textul.
    const contact =
      parts.map((p) => (/BEGIN:VCARD/i.test(p) ? parseSharedContact(p) : null)).find(Boolean) ??
      parseSharedContact(parts.join('\n'))

    const fragment = contact
      ? `#contact=${encodeURIComponent(JSON.stringify({ n: contact.name, t: contact.phone }))}`
      : '#contact-eroare'
    return NextResponse.redirect(new URL(`${TARGET}${fragment}`, request.url), 303)
  } catch {
    return NextResponse.redirect(new URL(`${TARGET}#contact-eroare`, request.url), 303)
  }
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL(TARGET, request.url), 303)
}
