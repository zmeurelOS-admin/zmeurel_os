'use client'

import { useState } from 'react'
import Image from 'next/image'

import Reveal from '@/components/landing/reveal'

const photos = [
  { src: '/landing/landing_raspberry_1.webp', alt: 'Plantație de zmeură în Suceava', index: 1 },
  { src: '/landing/landing_raspberry_box.webp', alt: 'Zmeură proaspăt culeasă', index: 2 },
  { src: '/landing/landing_raspberry_boxes.webp', alt: 'Casolete Zmeurel - producător local Suceava', index: 3 },
]

function FarmPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[color:rgba(49,46,63,0.06)] bg-[#f0ede8] shadow-sm">
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <svg
            aria-hidden="true"
            className="h-8 w-8 text-[color:rgba(49,46,63,0.2)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
          <span className="px-1 text-center text-[10px] leading-tight text-[color:rgba(49,46,63,0.35)]">
            Foto plantație
          </span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 hover:scale-[1.02]"
          onError={() => setFailed(true)}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 30vw, 20vw"
        />
      )}
    </div>
  )
}

export default function About() {
  return (
    <section
      id="despre-mine"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <Reveal className="rounded-[32px] border border-[color:rgba(47,111,78,0.10)] bg-white/80 p-6 shadow-[0_16px_48px_rgba(49,46,63,0.07)] sm:p-10 lg:p-14">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          {/* Text */}
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--landing-leaf)]">
                Cine a făcut aplicația
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
                Făcut de un fermier, pentru fermieri.
              </h2>
            </div>

            <p className="text-base leading-7 text-[color:var(--agri-text-muted)]">
              Mă numesc Andrei și sunt fermier de zmeură în Suceava, de 5 ani. Am trecut prin caiet,
              notițe în telefon și Excel până am ajuns să îmi construiesc propria aplicație.
              Zmeurel OS a apărut din nevoia mea reală de a ține evidența fermei simplu, direct de pe
              telefon. Acum vreau să o ofer tuturor fermierilor care au aceeași nevoie.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-4">
              <a
                href="https://www.facebook.com/ZmeuraSuceava/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook Zmeurel"
                className="inline-flex items-center gap-2 rounded-xl border border-[color:rgba(49,46,63,0.10)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--landing-dark)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <svg aria-hidden="true" className="h-4 w-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97H15.83c-1.491 0-1.956.931-1.956 1.886v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
                Facebook
              </a>
              <a
                href="https://www.instagram.com/zmeurel_sv/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram Zmeurel"
                className="inline-flex items-center gap-2 rounded-xl border border-[color:rgba(49,46,63,0.10)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--landing-dark)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="url(#ig-grad)" viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f09433" />
                      <stop offset="25%" stopColor="#e6683c" />
                      <stop offset="50%" stopColor="#dc2743" />
                      <stop offset="75%" stopColor="#cc2366" />
                      <stop offset="100%" stopColor="#bc1888" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                Instagram
              </a>
            </div>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {photos.map((photo) => (
              <FarmPhoto key={photo.index} src={photo.src} alt={photo.alt} />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
