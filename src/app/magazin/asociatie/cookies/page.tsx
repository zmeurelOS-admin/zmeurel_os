import type { Metadata } from 'next'

import { AssociationLegalDoc, AssociationLegalSection } from '@/components/shop/association/AssociationLegalDoc'

/* DRAFT_LEGAL_REVIEW */

const title = 'Politica de cookies — Magazinul Gustă din Bucovina'
const description = 'Informații despre cookie-uri în magazinul online al Asociației Gustă din Bucovina.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
}

export default function MagazinAsociatieCookiesPage() {
  return (
    <AssociationLegalDoc title="Politica de cookies — Magazinul Gustă din Bucovina">
      <AssociationLegalSection title="1. Ce sunt cookie-urile">
        <p>
          Cookie-urile sunt fișiere de mici dimensiuni plasate pe dispozitivul dumneavoastră atunci când vizitați un
          site. Ne ajută să menținem funcții esențiale (ex. coș de cumpărături) și, unde este cazul, să înțelegem în mod
          agregat cum este folosit site-ul.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="2. Ce folosim în acest magazin">
        <p>
          <strong>Cookie-uri tehnice / necesare:</strong> necesare pentru funcționarea magazinului (de exemplu
          menținerea sesiunii coșului sau preferințelor minime de afișare).
        </p>
        <p>
          <strong>Cookie-uri de analiză (dacă sunt activate):</strong> pot fi folosite pentru statistici agregate de
          trafic (fără a identifica direct persoana fizică), în conformitate cu setările site-ului și legislația
          aplicabilă.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="3. Gestionarea preferințelor">
        <p>
          La prima vizită poate fi afișat un mesaj scurt prin care puteți înțelege utilizarea cookie-urilor. Puteți
          șterge sau bloca cookie-urile din setările browserului; rețineți că unele funcții ale magazinului pot fi
          afectate.
        </p>
      </AssociationLegalSection>
    </AssociationLegalDoc>
  )
}
