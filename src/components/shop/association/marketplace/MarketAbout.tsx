import { Heart, Leaf, Users } from 'lucide-react'

import { M, PX } from './marketTokens'

const VALUES = [
  { icon: Leaf, title: 'Calitate', desc: 'Produse atent selectate de la fermieri din zonă.' },
  { icon: Users, title: 'Comunitate', desc: 'Sprijinim producătorii locali și relația directă cu clienții.' },
  { icon: Heart, title: 'Tradiție', desc: 'Respectăm gustul autentic al Bucovinei.' },
] as const

export function MarketAbout() {
  return (
    <section className="border-t py-12 md:py-16" style={{ backgroundColor: M.cream, borderColor: M.border }}>
      <div className={PX}>
        <h2 className="assoc-heading text-center text-2xl font-extrabold sm:text-3xl" style={{ color: M.green }}>
          Despre asociație
        </h2>
        <p className="assoc-body mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed sm:text-base" style={{ color: M.text }}>
          Asociația „Gustă din Bucovina” reunește producători locali și le oferă un canal simplu de vânzare — tu comanzi
          direct, fără cont obligatoriu.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl border bg-[#FFFCF0] p-5 sm:p-6"
              style={{ borderColor: M.border }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: M.orange }}>
                <v.icon className="h-5 w-5 text-[#3D4543]" strokeWidth={2.2} />
              </div>
              <h3 className="assoc-heading mt-4 text-lg font-bold" style={{ color: M.green }}>
                {v.title}
              </h3>
              <p className="assoc-body mt-2 text-sm leading-relaxed" style={{ color: M.muted }}>
                {v.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
