import type { Metadata } from 'next'

import { AssociationLegalDoc, AssociationLegalSection } from '@/components/shop/association/AssociationLegalDoc'
import { WithdrawalFormDownloadButton } from '@/components/shop/association/legal/WithdrawalFormDownloadButton'
import { loadAssociationSettingsCached } from '@/lib/association/public-settings'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'

/* DRAFT_LEGAL_REVIEW — conținut provizoriu; revizuire juridică obligatorie înainte de producție */

const title = 'Termeni și condiții — Magazinul Gustă din Bucovina'
const description =
  'Termeni și condiții pentru comenzile plasate prin magazinul online al Asociației Gustă din Bucovina.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
}

export default async function MagazinAsociatieTermeniPage() {
  const settings = await loadAssociationSettingsCached()
  const m = resolveMerchantPublicInfo(settings)
  const zoneDetail =
    settings.marketLocation?.trim() ||
    'municipiul Suceava și localitățile limitrofe (indicativ; detalii la confirmare)'
  const deliveryExtra =
    m.deliveryPolicy?.trim() ||
    'Taxa de livrare: 15 lei pentru comenzi sub 150 lei; livrare gratuită pentru comenzi de cel puțin 150 lei (RON), dacă nu se prevede altfel pe site.'

  const contactBlock = (
    <>
      {m.headquarters ? (
        <p>
          <span className="font-semibold">Sediu: </span>
          {m.headquarters}
        </p>
      ) : (
        <p>Sediu: [completează în setările asociației]</p>
      )}
      {m.cui ? (
        <p>
          <span className="font-semibold">CUI / CIF: </span>
          {m.cui}
        </p>
      ) : null}
      {m.registryNumber ? (
        <p>
          <span className="font-semibold">Nr. registru: </span>
          {m.registryNumber}
        </p>
      ) : null}
      {m.email ? (
        <p>
          <span className="font-semibold">Email: </span>
          <a href={`mailto:${m.email}`}>{m.email}</a>
        </p>
      ) : null}
      {m.phone ? (
        <p>
          <span className="font-semibold">Telefon: </span>
          <a href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a>
        </p>
      ) : null}
      {m.contactPerson ? (
        <p>
          <span className="font-semibold">Persoană de contact: </span>
          {m.contactPerson}
        </p>
      ) : null}
    </>
  )

  return (
    <AssociationLegalDoc title={title}>
      <AssociationLegalSection title="1. Informații despre comerciant">
        <p>
          Produsele din acest magazin sunt oferite spre vânzare de{' '}
          <strong>{m.legalName}</strong>
          {m.legalForm ? (
            <>
              {' '}
              (<span>{m.legalForm}</span>)
            </>
          ) : null}
          .
        </p>
        <div className="mt-3 space-y-2">{contactBlock}</div>
        <p className="mt-3">
          Platforma <strong>Zmeurel OS</strong> (<a href="https://zmeurel.ro">zmeurel.ro</a>) este furnizorul tehnic
          al magazinului online (găzduire, transmitere comenzi și instrumente digitale), nu comerciantul bunurilor.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="2. Plasarea comenzilor">
        <p>
          Prin plasarea unei comenzi, clientul încheie un raport contractual de vânzare-cumpărare cu{' '}
          <strong>{m.legalName}</strong>, nu cu operatorul platformei tehnice.
        </p>
        <p>
          Comanda devine fermă după confirmarea acesteia de către reprezentanții asociației (sau conform fluxului
          comunicat pe canalul oficial).
        </p>
        <p>Pașii tehnici tipici: adăugare produse în coș → completare date de livrare și contact → plasare comenzii cu obligație de plată (cash la livrare) → confirmare.</p>
      </AssociationLegalSection>

      <AssociationLegalSection title="3. Prețuri și plată">
        <p>Prețurile sunt exprimate în lei (RON) și includ TVA, acolo unde legea impune afișarea cu TVA.</p>
        <p>Plata se face numerar la livrare, direct către reprezentantul desemnat de asociație, în condițiile comunicate la confirmare.</p>
        <p>{deliveryExtra}</p>
      </AssociationLegalSection>

      <AssociationLegalSection title="4. Livrare">
        <p>Livrarea este organizată de {m.legalName}, prin reprezentanți sau curieri agreați.</p>
        <p>
          <strong>Zona de livrare:</strong> municipiul Suceava și localitățile limitrofe.
        </p>
        <p>
          Pentru comenzi din afara zonei de livrare standard, contactați {m.legalName} pentru disponibilitate și
          costuri.
        </p>
        <p>
          Program orientativ: comenzi plasate până marți ora 12:00 → livrare miercurea următoare (în funcție de
          capacitate și confirmare; pot exista excepții comunicate în prealabil).
        </p>
        <p className="text-[13px] text-[#6B7A72]">Notă suplimentară: {zoneDetail}</p>
      </AssociationLegalSection>

      <AssociationLegalSection title="5. Dreptul de retragere">
        <p>
          Produsele alimentare proaspete sau perisabile pot intra sub incidența excepțiilor de la dreptul de retragere
          în contractele la distanță, conform cadrului legal aplicabil (inclusiv OUG 34/2014 privind drepturile
          consumatorilor în contractele la distanță).
        </p>
        <p>
          Pentru produsele care nu sunt exceptate, dreptul de retragere se poate exercita în termen de 14 zile de la
          primire, prin contactarea asociației la datele de mai jos.
        </p>
        <div className="mt-3 space-y-2">{contactBlock}</div>
      </AssociationLegalSection>

      <AssociationLegalSection title="6. Garanția legală de conformitate">
        {/* DRAFT_LEGAL_REVIEW */}
        <p>
          Produsele beneficiază de garanția legală de conformitate, în condițiile Legii nr. 449/2003 și actelor
          normative conexe (inclusiv OUG nr. 140/2021, acolo unde este aplicabilă categoriei de bunuri).
        </p>
        <p>
          Pentru produsele alimentare perisabile, garanția se aplică în limita termenului de valabilitate și a
          condițiilor de păstrare comunicate.
        </p>
        <p>Reclamațiile privind conformitatea produselor se adresează {m.legalName}:</p>
        <div className="mt-3 space-y-2">{contactBlock}</div>
      </AssociationLegalSection>

      <AssociationLegalSection title="7. Dreptul de retragere — Formular model">
        <p>
          Conform OUG nr. 34/2014, aveți dreptul de a vă retrage din contract în termen de 14 zile, fără a indica
          motive, acolo unde legea nu prevede altfel.
        </p>
        <p>
          <strong>Excepție:</strong> produsele alimentare perisabile pot fi exceptate de la dreptul de retragere (art.
          16 lit. d din OUG 34/2014, în interpretarea și aplicarea practică relevantă).
        </p>
        <p>
          Pentru produsele neperisabile eligibile, puteți folosi formularul-model de mai jos și îl puteți transmite la
          datele de contact ale {m.legalName}.
        </p>
        <div
          className="mt-4 rounded-xl border border-black/10 bg-[#faf9f6] p-4 font-mono text-[13px] leading-relaxed text-[#3D4543]"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {`FORMULAR DE RETRAGERE\n(completați și returnați acest formular doar dacă doriți retragerea din contract)\n\nCătre: ${m.legalName}, ${m.headquarters?.trim() || '[adresă]'}, ${m.email?.trim() || '[email]'}\n\nSubsemnatul/Subsemnata ______ notifică/notificăm prin prezenta retragerea mea/noastră din contractul de vânzare a următoarelor produse: ______\n\nComandate la data ______ / primite la data ______\n\nNumele consumatorului: ______\n\nAdresa consumatorului: ______\n\nSemnătura consumatorului (doar în caz de formular pe hârtie): ______\n\nData: ______`}
        </div>
        <WithdrawalFormDownloadButton merchant={m} />
        <p className="mt-2 text-[11px] text-[#94a0a8]">/* DRAFT_LEGAL_REVIEW — formular conform Anexei din OUG 34/2014 */</p>
      </AssociationLegalSection>

      <AssociationLegalSection title="8. Reclamații">
        <p>Pentru reclamații privind produsele, calitatea sau livrarea, contactați direct {m.legalName}:</p>
        <div className="mt-3 space-y-2">{contactBlock}</div>
        {m.complaintsPolicy?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap">{m.complaintsPolicy.trim()}</p>
        ) : null}
        <p className="mt-3">
          Pentru probleme tehnice ale platformei (acces, erori de afișare, transmisie comandă), puteți folosi canalul
          indicat pe <a href="https://zmeurel.ro">zmeurel.ro</a>.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="9. Limitare de răspundere">
        <p>
          Platforma Zmeurel OS facilitează afișarea produselor și transmiterea comenzilor către comerciant. Rolul
          platformei este predominant tehnic și logistic informațional.
        </p>
        <p>
          Răspunderea pentru calitatea produselor, conformitatea acestora cu descrierea, livrarea fizică și
          încasarea revine în principal comerciantului (asociației și producătorilor din rețea), în limitele legii.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="10. Modificări">
        <p>
          Acești termeni pot fi actualizați. Versiunea aplicabilă este cea publicată la momentul plasării comenzii,
          cu excepția modificărilor impuse de lege sau în măsura în care sunt acceptate expres de consumator.
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="11. Soluționarea litigiilor">
        <p>
          Pentru reclamații, vă puteți adresa Autorității Naționale pentru Protecția Consumatorilor (ANPC), precum și
          instanțelor competente, conform legii.
        </p>
        <p>
          Soluționarea alternativă a litigiilor (SAL), conform OG 38/2015:{' '}
          <a href="https://www.anpc.gov.ro/categorie/1271/sal" target="_blank" rel="noopener noreferrer">
            https://www.anpc.gov.ro/categorie/1271/sal
          </a>
        </p>
        <p>
          Soluționarea online a litigiilor — platforma UE (ODR), conform Regulamentului UE nr. 524/2013:{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr
          </a>
        </p>
      </AssociationLegalSection>
    </AssociationLegalDoc>
  )
}
