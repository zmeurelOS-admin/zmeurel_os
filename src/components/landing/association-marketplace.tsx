import { Store, Users } from 'lucide-react'

import { BulletList, SectionIntro, SectionShell } from '@/components/landing/landing-shared'

export function AssociationMarketplace() {
  return (
    <SectionShell
      id="asociatie"
      label="Magazin online pentru asociații"
      className="border-t-2 border-[#B7DFC9] py-16 md:py-24"
    >
      <div
        className="rounded-[28px] border border-[#B7DFC9] px-6 py-8 md:px-10 md:py-12"
        style={{ backgroundImage: 'linear-gradient(170deg, #E8F5EE 0%, #FAFAF6 100%)' }}
      >
        <SectionIntro
          badge="Nou în platformă"
          badgeClassName="border-[#FAD8D0] bg-[#FFF0EC] text-[#E76F51]"
          title="Magazin online pentru asociații de producători"
          description="Membrii unei asociații își pot vinde produsele împreună, dintr-un singur magazin online cu branding propriu. Clienții comandă simplu, asociația livrează organizat."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0EC] text-[#E76F51]">
              <Store className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">Ce vede clientul</h3>
            <div className="mt-4">
              <BulletList
                items={[
                  'Pagină publică cu produse, imagini și prețuri',
                  'Coș de cumpărături și checkout ușor',
                  'Branding propriu al asociației',
                  'Funcționează pe telefon, tabletă, calculator',
                ]}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-white">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">Ce administrează asociația</h3>
            <div className="mt-4">
              <BulletList
                items={[
                  'Administrare produse și disponibilitate',
                  'Vizibilitate pe comenzi și statusuri',
                  'Producători cu profil și produse proprii',
                  'Notificări (inbox, toast, push)',
                ]}
              />
            </div>
          </article>
        </div>
      </div>
    </SectionShell>
  )
}
