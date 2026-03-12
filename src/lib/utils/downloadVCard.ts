export function downloadVCard(name: string, phone: string) {
  const safeName = name.trim()
  const safePhone = phone.trim()
  if (!safeName || !safePhone) return

  const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${safeName}
TEL:${safePhone}
END:VCARD
`.trim()

  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'contact.vcf'
  document.body.appendChild(a)
  a.click()

  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
