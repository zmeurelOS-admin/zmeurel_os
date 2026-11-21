import { redirect } from 'next/navigation'

/** „Documente legale” au devenit „Actele fermei”, sub Setări → Ferma. Legăturile vechi duc acolo. */
export default function LegalDocumentsPage() {
  redirect('/settings/ferma/acte')
}
