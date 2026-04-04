import type { Metadata } from 'next'

import { AssociationLegalDoc, AssociationLegalSection } from '@/components/shop/association/AssociationLegalDoc'
import { loadAssociationSettingsCached } from '@/lib/association/public-settings'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'

/* DRAFT_LEGAL_REVIEW — conținut provizoriu */

const title = 'Politica de confidențialitate — Magazinul Gustă din Bucovina'
const description = 'Politica de confidențialitate pentru magazinul online al Asociației Gustă din Bucovina.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
}

export default async function MagazinAsociatieConfidentialitatePage() {
  const settings = await loadAssociationSettingsCached()
  const m = resolveMerchantPublicInfo(settings)

  const contactAssoc = (
    <div className="space-y-2">
      <p className="font-semibold">{m.legalName}</p>
      {m.email ? (
        <p>
          Email: <a href={`mailto:${m.email}`}>{m.email}</a>
        </p>
      ) : null}
      {m.phone ? (
        <p>
          Telefon: <a href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a>
        </p>
      ) : null}
      {m.headquarters ? <p>Sediu: {m.headquarters}</p> : null}
    </div>
  )

  return (
    <AssociationLegalDoc title="Politica de confidențialitate — Magazinul Gustă din Bucovina">
      <AssociationLegalSection title="1. Cine colectează datele">
        <p>
          Datele furnizate la comandă (ex. nume, telefon, adresă de livrare, observații) sunt colectate în scopul
          derulării relației comerciale cu <strong>{m.legalName}</strong>, care acționează ca operator al datelor
          comenzii în sensul GDPR, în limitele descrise mai jos.
        </p>
        <p>
          Platforma <strong>Zmeurel OS</strong> procesează aceste date în calitate de împuternicit / furnizor tehnic
          (procesare pe infrastructura aplicației), strict pentru funcționarea magazinului și transmiterea comenzii
          către comerciant.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="2. Ce date colectăm">
        <p>În funcție de fluxul de comandă, pot fi prelucrate următoarele categorii de date:</p>
        <ul>
          <li>Date de identificare și contact: nume, telefon;</li>
          <li>Adresă / locație de livrare sau punct de predare;</li>
          <li>Observații legate de livrare sau produs;</li>
          <li>Istoricul comenzilor plasate prin platformă (în sistemul comerciantului).</li>
        </ul>
        <p>
          Nu colectăm prin acest magazin date de plată electronică pentru carduri: plata este ramburs la livrare,
          conform termenilor afișați.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="3. Scopul prelucrării">
        <ul>
          <li>Preluarea, confirmarea și onorarea comenzilor;</li>
          <li>Comunicări legate de comandă (ex. confirmare, clarificări de livrare);</li>
          <li>Respectarea obligațiilor legale aplicabile (ex. evidențe comerciale, fiscalitate, unde e cazul).</li>
        </ul>
      </AssociationLegalSection>

      <AssociationLegalSection title="4. Drepturile tale (GDPR art. 15–22)">
        <p>
          Aveți dreptul de acces la date, rectificare, ștergere, restricționarea prelucrării, portabilitate și opoziție,
          în condițiile legii. Pentru exercitarea drepturilor, contactați:
        </p>
        <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-4">{contactAssoc}</div>
      </AssociationLegalSection>

      <AssociationLegalSection title="5. Autoritatea de supraveghere">
        <p>
          În România, autoritatea de supraveghere în materie de protecție a datelor cu caracter personal este
          Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP /{' '}
          <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer">
            dataprotection.ro
          </a>
          ).
        </p>
      </AssociationLegalSection>
    </AssociationLegalDoc>
  )
}
