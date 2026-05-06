import Image from 'next/image'

import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const photos = [
  {
    src: '/landing/landing_raspberry_1.webp',
    alt: 'Andrei în plantația de zmeură din Suceava',
    width: 900,
    height: 1200,
  },
  {
    src: '/landing/landing_raspberry_box.webp',
    alt: 'Lădiță cu zmeură proaspătă pregătită pentru livrare',
    width: 1200,
    height: 900,
  },
  {
    src: '/landing/landing_raspberry_boxes.webp',
    alt: 'Mai multe caserole cu zmeură pregătite pentru clienți',
    width: 1200,
    height: 900,
  },
]

export function Story() {
  return (
    <SectionShell label="Povestea Zmeurel OS" className="border-t border-slate-200 bg-white py-16 md:py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <SectionIntro
            badge="De la fermă la aplicație"
            title="Făcut de un fermier, pentru fermieri."
            align="left"
            description="Mă numesc Andrei și sunt fermier de zmeură în Suceava, de 5 ani. Am trecut prin caiet, notițe în telefon și Excel până am ajuns să îmi construiesc propria aplicație. Zmeurel OS a apărut din nevoia mea reală de a ține evidența fermei simplu, direct de pe telefon. Acum vreau să o ofer tuturor fermierilor care au aceeași nevoie."
          />

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://facebook.com/ZmeuraSuceava"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
            >
              Facebook
            </a>
            <a
              href="https://instagram.com/zmeurel_sv"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
            >
              Instagram
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <Image
                src={photos[0].src}
                alt={photos[0].alt}
                width={photos[0].width}
                height={photos[0].height}
                loading="lazy"
                quality={80}
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 40vw, 320px"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="space-y-4 pt-6">
            {photos.slice(1).map((photo) => (
              <div key={photo.src} className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  quality={80}
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 40vw, 320px"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
